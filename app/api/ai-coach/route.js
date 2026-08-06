import {
  boundedNumber,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../lib/api-security";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildAiCoachReport, AI_COACH_VERSION } from "../../../lib/ai-coach-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const OBSERVATION_SELECT = "id,bet_id,event_id,sport,league,market,selection,bookmaker,decision,model_version,entry_odds,entry_market_probability,model_probability,closing_consensus_probability,closing_fair_odds,closing_provider_count,closing_captured_at,commence_time,bet_created_at,settled_at,status,outcome_value,stake,profit,price_clv,probability_clv,brier_score,log_loss,exclusion_reason,evidence_version,source_id,created_at";
const AUDIT_SELECT = "id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,proposed_stake,created_at";
const MARKET_SELECT = "event_id,market,selection,bookmaker_key,bookmaker_title,price,provider_last_update,captured_at";
const PREFERENCE_SELECT = "user_id,enabled,notifications_enabled,quiet_start,quiet_end,max_notifications_per_week,minimum_sample,paper_only,created_at,updated_at";
const DEFAULT_PREFERENCES = Object.freeze({
  enabled: true,
  notifications_enabled: false,
  quiet_start: null,
  quiet_end: null,
  max_notifications_per_week: 2,
  minimum_sample: 20,
  paper_only: true
});

function missingPatch(error) {
  return error?.code === "42P01" || /ai_coach_|calibration_observations_v1|market_provider_snapshots_v2|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value, maximum = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function sameText(left, right) {
  return text(left, 180).toLowerCase() === text(right, 180).toLowerCase();
}

function normalizeTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? `${match[1]}:${match[2]}:00` : undefined;
}

async function loadPreferences(auth) {
  const { data, error } = await auth.supabase
    .from("ai_coach_preferences_v1")
    .select(PREFERENCE_SELECT)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error && !missingPatch(error)) throw error;
  return {
    values: { ...DEFAULT_PREFERENCES, ...(data || {}) },
    available: !error,
    warning: error ? "AI Coach production patch is not active" : null
  };
}

function priceChoicesAtEntry(observations, marketRows) {
  const byEvent = new Map();
  for (const row of marketRows || []) {
    const key = text(row.event_id, 180);
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(row);
  }

  const results = [];
  for (const observation of observations || []) {
    const entryAt = Date.parse(observation.bet_created_at || "");
    if (!Number.isFinite(entryAt)) continue;
    const candidates = (byEvent.get(text(observation.event_id, 180)) || []).filter((row) => {
      if (!sameText(row.market, observation.market) || !sameText(row.selection, observation.selection)) return false;
      const capturedAt = Date.parse(row.captured_at || "");
      const providerAt = Date.parse(row.provider_last_update || row.captured_at || "");
      if (!Number.isFinite(capturedAt) || !Number.isFinite(providerAt)) return false;
      return capturedAt <= entryAt && providerAt <= entryAt && entryAt - Math.max(capturedAt, providerAt) <= 30 * 60 * 1000;
    });
    if (!candidates.length) continue;

    const latestByBookmaker = new Map();
    for (const row of candidates) {
      const bookmaker = text(row.bookmaker_key || row.bookmaker_title, 120);
      const previous = latestByBookmaker.get(bookmaker);
      if (!previous || Date.parse(row.captured_at) > Date.parse(previous.captured_at)) latestByBookmaker.set(bookmaker, row);
    }
    const latest = [...latestByBookmaker.values()];
    const prices = latest.map((row) => finite(row.price)).filter((value) => value && value > 1);
    const entryOdds = finite(observation.entry_odds);
    if (!prices.length || !entryOdds || entryOdds <= 1) continue;
    results.push({
      observationId: observation.id,
      eventId: observation.event_id,
      entryOdds,
      bestAvailableOdds: Math.max(...prices),
      providerCount: prices.length,
      evidenceCutoff: new Date(entryAt).toISOString()
    });
  }
  return results;
}

async function persistReport(admin, userId, report, windowDays) {
  const { data: latest, error: latestError } = await admin
    .from("ai_coach_reports_v1")
    .select("id,generated_at")
    .eq("user_id", userId)
    .eq("report_version", AI_COACH_VERSION)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (latest?.generated_at && Date.now() - Date.parse(latest.generated_at) < 6 * 60 * 60 * 1000) {
    return { stored: false, reason: "recent-report-exists", id: latest.id };
  }
  const { data, error } = await admin
    .from("ai_coach_reports_v1")
    .insert({
      user_id: userId,
      report_version: AI_COACH_VERSION,
      window_days: windowDays,
      evidence_count: report.overview?.eligible || 0,
      report,
      generated_at: report.generatedAt,
      paper_only: true
    })
    .select("id")
    .single();
  if (error) throw error;
  return { stored: true, id: data.id };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "ai_coach_read", limit: 20, windowSeconds: 60 });
  if (limited) return limited;

  const url = new URL(request.url);
  const allowed = new Set(["days", "includeAudit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);
  }
  const days = Math.max(7, Math.min(1825, Number.parseInt(url.searchParams.get("days") || "365", 10) || 365));
  const includeAudit = ["1", "true", "yes"].includes(String(url.searchParams.get("includeAudit") || "").toLowerCase());

  try {
    const preferences = await loadPreferences(auth);
    if (!preferences.values.enabled) {
      return jsonResponse({
        ok: true,
        version: AI_COACH_VERSION,
        enabled: false,
        preferences,
        report: null,
        paperOnly: true
      }, 200, requestId, { "Cache-Control": "private, no-store" });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return jsonResponse({ ok: false, error: "Production database is not configured" }, 503, requestId);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [observationsResult, auditsResult] = await Promise.all([
      admin.from("calibration_observations_v1").select(OBSERVATION_SELECT).eq("user_id", auth.user.id).gte("bet_created_at", since).order("bet_created_at", { ascending: true }).limit(5000),
      admin.from("autonomous_agent_decision_audit").select(AUDIT_SELECT).eq("user_id", auth.user.id).gte("created_at", since).order("created_at", { ascending: true }).limit(5000)
    ]);
    if (observationsResult.error) throw observationsResult.error;
    if (auditsResult.error && !missingPatch(auditsResult.error)) throw auditsResult.error;

    const observations = observationsResult.data || [];
    const eventIds = [...new Set(observations.map((row) => text(row.event_id, 180)).filter(Boolean))];
    const marketRows = [];
    for (let index = 0; index < eventIds.length; index += 100) {
      const { data, error } = await admin
        .from("market_provider_snapshots_v2")
        .select(MARKET_SELECT)
        .in("event_id", eventIds.slice(index, index + 100))
        .order("captured_at", { ascending: true })
        .limit(20000);
      if (error) throw error;
      marketRows.push(...(data || []));
    }

    const priceChoices = priceChoicesAtEntry(observations, marketRows);
    const report = buildAiCoachReport({
      generatedAt: new Date().toISOString(),
      windowDays: days,
      minimumSample: preferences.values.minimum_sample,
      observations,
      priceChoices,
      decisionAudits: auditsResult.error ? [] : auditsResult.data || []
    });
    const storage = preferences.available
      ? await persistReport(admin, auth.user.id, report, days)
      : { stored: false, reason: "preferences-storage-unavailable" };

    const safeReport = includeAudit ? report : {
      ...report,
      evidence: {
        ...report.evidence,
        eligibleObservationIds: undefined
      },
      insights: report.insights.map(({ supportingIds: _supportingIds, ...item }) => item)
    };

    return jsonResponse({
      ok: true,
      enabled: true,
      preferences,
      report: safeReport,
      reportStorage: storage,
      dataBoundaries: {
        userIdReturned: false,
        rawProviderPayloadReturned: false,
        privateKeysReturned: false,
        modelProbabilityChanged: false,
        automaticDecisionChanged: false,
        automaticStakeChanged: false
      },
      paperOnly: true
    }, 200, requestId, { "Cache-Control": "private, no-store" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: missingPatch(error) ? "AI Coach dependencies or production patch are not active" : "AI Coach evidence could not be built",
      requiredPatches: missingPatch(error) ? [
        "scripts/apply-market-microstructure-v2.sql",
        "scripts/apply-calibration-lab-v1.sql",
        "scripts/apply-ai-coach-v1.sql"
      ] : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500, requestId);
  }
}

export async function PATCH(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, { bucket: "ai_coach_preferences", limit: 10, windowSeconds: 60 });
  if (limited) return limited;
  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const quietStart = normalizeTime(body.data?.quietStart ?? body.data?.quiet_start);
  const quietEnd = normalizeTime(body.data?.quietEnd ?? body.data?.quiet_end);
  if (quietStart === undefined || quietEnd === undefined) {
    return jsonResponse({ ok: false, error: "Quiet hours must use HH:MM format" }, 400, requestId);
  }
  const maxNotifications = boundedNumber(body.data?.maxNotificationsPerWeek ?? body.data?.max_notifications_per_week, { min: 0, max: 7, fallback: 2 });
  const minimumSample = boundedNumber(body.data?.minimumSample ?? body.data?.minimum_sample, { min: 10, max: 500, fallback: 20 });
  const row = {
    user_id: auth.user.id,
    enabled: body.data?.enabled !== false,
    notifications_enabled: body.data?.notificationsEnabled === true || body.data?.notifications_enabled === true,
    quiet_start: quietStart,
    quiet_end: quietEnd,
    max_notifications_per_week: Math.round(maxNotifications),
    minimum_sample: Math.round(minimumSample),
    paper_only: true
  };

  const { data, error } = await auth.supabase
    .from("ai_coach_preferences_v1")
    .upsert(row, { onConflict: "user_id" })
    .select(PREFERENCE_SELECT)
    .single();
  if (error) {
    return jsonResponse({
      ok: false,
      error: missingPatch(error) ? "AI Coach production patch is not active" : "AI Coach preferences could not be saved",
      requiredPatch: missingPatch(error) ? "scripts/apply-ai-coach-v1.sql" : undefined
    }, missingPatch(error) ? 503 : 500, requestId);
  }
  return jsonResponse({ ok: true, preferences: data, paperOnly: true }, 200, requestId);
}
