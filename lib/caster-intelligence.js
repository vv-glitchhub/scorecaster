const APP = "scorecaster";
const ALLOWED_SEVERITIES = new Set(["info", "warning", "error", "critical"]);
const ALLOWED_CATEGORIES = new Set(["bug", "reliability", "data_quality", "ux", "performance", "test_coverage", "feature", "security", "growth"]);
const SENSITIVE_KEY = /(email|name|password|token|secret|key|auth|cookie|phone|address|message_body|prompt)/i;

function config() {
  const url = process.env.CASTER_INTELLIGENCE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CASTER_INTELLIGENCE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CASTER_INTELLIGENCE_NOT_CONFIGURED");
  return { url: url.replace(/\/$/, ""), key };
}

export function sanitizeTelemetry(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 300);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeTelemetry(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 30).filter(([key]) => !SENSITIVE_KEY.test(key)).map(([key, item]) => [key, sanitizeTelemetry(item, depth + 1)]));
  }
  return String(value).slice(0, 100);
}

export function priorityScore({ impact = 1, confidence = 0.5, urgency = 1, risk = "GREEN" }) {
  const penalty = risk === "RED" ? 10 : risk === "YELLOW" ? 2 : 1;
  return Number(((Math.min(5, Math.max(1, impact)) * Math.min(1, Math.max(0, confidence)) * Math.min(5, Math.max(1, urgency))) / penalty).toFixed(4));
}

async function rest(path, init = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`CASTER_INTELLIGENCE_DB_${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function recordImprovementSignal(input = {}) {
  const eventType = String(input.eventType || "runtime_signal").slice(0, 80);
  const severity = ALLOWED_SEVERITIES.has(input.severity) ? input.severity : "info";
  const message = String(input.message || eventType).slice(0, 300);
  const metadata = sanitizeTelemetry(input.metadata || {});
  const rows = await rest("caster_agent_events", { method: "POST", body: JSON.stringify([{ app: APP, event_type: eventType, severity, source: String(input.source || "runtime").slice(0, 50), route: input.route ? String(input.route).slice(0, 160) : null, message, metadata }]) });
  const event = rows?.[0];

  if (severity === "error" || severity === "critical" || input.createCandidate === true) {
    const category = ALLOWED_CATEGORIES.has(input.category) ? input.category : "reliability";
    const impact = Math.min(5, Math.max(1, Number(input.impact || (severity === "critical" ? 5 : 3))));
    const confidence = Math.min(1, Math.max(0, Number(input.confidence ?? 0.75)));
    const urgency = Math.min(5, Math.max(1, Number(input.urgency || (severity === "critical" ? 5 : 3))));
    const risk = ["GREEN", "YELLOW", "RED"].includes(input.risk) ? input.risk : "GREEN";
    const title = String(input.title || `${eventType}: ${message}`).slice(0, 180);
    const encoded = encodeURIComponent(title);
    const existing = await rest(`caster_improvement_candidates?app=eq.${APP}&title=eq.${encoded}&status=in.(queued,selected,in_progress,pr_open)&select=id&limit=1`);
    if (!existing?.length) {
      await rest("caster_improvement_candidates", { method: "POST", body: JSON.stringify([{ app: APP, title, category, evidence: { event_id: event?.id || null, route: input.route || null, severity, metadata }, impact, confidence, urgency, risk, priority_score: priorityScore({ impact, confidence, urgency, risk }), source_event_id: event?.id || null }]) });
    }
  }
  return event;
}

export async function listImprovementQueue(limit = 20) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  return rest(`caster_improvement_candidates?app=eq.${APP}&status=eq.queued&order=priority_score.desc,created_at.asc&limit=${safeLimit}&select=id,title,category,evidence,impact,confidence,urgency,risk,priority_score,status,created_at`);
}

export async function updateImprovement(id, patch = {}) {
  const allowed = {};
  for (const key of ["status", "before_metric", "after_metric", "outcome"]) if (key in patch) allowed[key] = sanitizeTelemetry(patch[key]);
  return rest(`caster_improvement_candidates?id=eq.${encodeURIComponent(id)}&app=eq.${APP}`, { method: "PATCH", body: JSON.stringify(allowed) });
}

export { APP as CASTER_APP };
