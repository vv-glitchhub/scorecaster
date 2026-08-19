import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../../lib/api-security";
import {
  AGENT_RISK_PROFILES,
  normalizeAgentRiskProfile,
  publicAgentRiskPolicy
} from "../../../../../lib/agent-risk-profile-v1.mjs";

export const dynamic = "force-dynamic";

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { response: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return { auth };
}

function payload(profile) {
  const riskProfile = normalizeAgentRiskProfile(profile);
  return {
    ok: true,
    version: "autonomous-agent-risk-profile-v1",
    paperOnly: true,
    realMoneyBetting: false,
    probabilityChangedByRisk: false,
    edgeChangedByRisk: false,
    evChangedByRisk: false,
    riskProfile,
    riskPolicy: publicAgentRiskPolicy(riskProfile)
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomous_agent_risk_profile_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase
    .from("autonomous_agent_settings")
    .select("risk_profile")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Autonomous Agent risk profile could not be loaded")
    }, 500, requestId);
  }
  return jsonResponse(payload(data?.risk_profile || "balanced"), 200, requestId);
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomous_agent_risk_profile_write",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  const raw = String(body.data?.riskProfile || "").trim().toLowerCase();
  if (!Object.hasOwn(AGENT_RISK_PROFILES, raw)) {
    return jsonResponse({ ok: false, error: "Unsupported autonomous Agent risk profile" }, 400, requestId);
  }
  const riskProfile = normalizeAgentRiskProfile(raw);

  const { data, error } = await auth.supabase
    .from("autonomous_agent_settings")
    .upsert({ user_id: auth.user.id, risk_profile: riskProfile }, { onConflict: "user_id" })
    .select("risk_profile")
    .single();
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Autonomous Agent risk profile could not be saved")
    }, 500, requestId);
  }

  return jsonResponse(payload(data?.risk_profile || riskProfile), 200, requestId);
}
