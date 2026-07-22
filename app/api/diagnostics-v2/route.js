import {
  boundedNumber,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../lib/api-security";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import {
  analyzeDecisionOutcomes,
  buildDiagnosticSnapshot,
  evaluateDiagnosticAlerts,
  simulateDecisionThresholds
} from "../../../lib/decision-diagnostics-v2.mjs";
import {
  diagnoseProviderRootCauses,
  summarizeDiagnosticTrends
} from "../../../lib/decision-diagnostics-v21.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BET_SELECT = "id,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at";

function isMissingTable(error) {
  return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message || "");
}

function thresholdOptions(url) {
  return {
    minimumPlayEdge: boundedNumber(url.searchParams.get("playEdge"), { min: 0.005, max: 0.15, fallback: 0.02 }),
    minimumPlayEv: boundedNumber(url.searchParams.get("playEv"), { min: 0.005, max: 0.25, fallback: 0.03 }),
    minimumPlayConfidence: boundedNumber(url.searchParams.get("playConfidence"), { min: 0.35, max: 0.95, fallback: 0.55 }),
    minimumPlayBookmakers: boundedNumber(url.searchParams.get("playBookmakers"), { min: 2, max: 12, fallback: 4 })
  };
}

function normalizeHistory(row) {
  return {
    id: row.id,
    capturedAt: row.captured_at,
    status: row.status,
    total: Number(row.total || 0),
    counts: {
      PLAY: Number(row.play_count || 0),
      CAUTION: Number(row.caution_count || 0),
      SKIP: Number(row.skip_count || 0)
    },
    staleRate: Number(row.stale_rate || 0),
    averageBookmakers: row.average_bookmakers === null ? null : Number(row.average_bookmakers),
    averageConfidence: row.average_confidence === null ? null : Number(row.average_confidence),
    averageAgeHours: row.average_age_hours === null ? null : Number(row.average_age_hours),
    providerHealth: row.provider_health || {},
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    leagues: Array.isArray(row.leagues) ? row.leagues : []
  };
}

async function loadHistory(client, limit) {
  if (!client) return { available: false, warning: "Supabase history is not configured", items: [] };
  const { data, error } = await client
    .from("decision_diagnostic_snapshots")
    .select("id,captured_at,status,total,play_count,caution_count,skip_count,stale_rate,average_bookmakers,average_confidence,average_age_hours,provider_health,reasons,leagues")
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return { available: false, warning: "Run scorecaster_decision_diagnostics.sql", items: [] };
    return { available: false, warning: publicError(error, "Diagnostic history could not be loaded"), items: [] };
  }
  return { available: true, warning: null, items: (data || []).map(normalizeHistory) };
}

async function loadAlerts(client) {
  if (!client) return { available: false, warning: "Supabase alerts are not configured", items: [] };
  const { data, error } = await client
    .from("decision_diagnostic_alerts")
    .select("id,fingerprint,alert_type,severity,title,message,details,active,first_seen_at,last_seen_at,resolved_at")
    .order("active", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingTable(error)) return { available: false, warning: "Run scorecaster_decision_diagnostics.sql", items: [] };
    return { available: false, warning: publicError(error, "Diagnostic alerts could not be loaded"), items: [] };
  }
  return { available: true, warning: null, items: data || [] };
}

async function loadOutcomes(auth) {
  if (!auth?.ok) {
    return {
      available: false,
      authenticated: false,
      warning: "Sign in to analyze your settled paper results and CLV",
      analysis: analyzeDecisionOutcomes([])
    };
  }
  const { data, error } = await auth.supabase
    .from("bets")
    .select(BET_SELECT)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return {
      available: false,
      authenticated: true,
      warning: publicError(error, "Paper outcomes could not be loaded"),
      analysis: analyzeDecisionOutcomes([])
    };
  }
  return {
    available: true,
    authenticated: true,
    warning: null,
    analysis: analyzeDecisionOutcomes(data || [])
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const allowed = new Set(["limit", "playEdge", "playEv", "playConfidence", "playBookmakers"]);
  const unknown = [...url.searchParams.keys()].filter((key) => !allowed.has(key));
  if (unknown.length) return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);

  const limit = boundedNumber(url.searchParams.get("limit"), { min: 1, max: 168, fallback: 72 });
  const thresholds = thresholdOptions(url);

  try {
    const topPicksResponse = await fetch(`${url.origin}/api/top-picks`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const topPicks = await topPicksResponse.json();
    if (!topPicksResponse.ok || topPicks?.ok === false) {
      return jsonResponse({ ok: false, error: topPicks?.error || topPicks?.reason || "Top Picks unavailable" }, 503, requestId);
    }

    const current = buildDiagnosticSnapshot(topPicks);
    const simulation = simulateDecisionThresholds(current.picks.map((item) => {
      const original = (topPicks.data || []).find((pick) => String(pick.id || pick.gameId || pick.eventId) === String(item.id));
      return original || item;
    }), thresholds);

    const auth = await getAuthenticatedContext(request);
    const admin = getSupabaseAdmin();
    const readClient = admin || (auth.ok ? auth.supabase : null);
    const [history, storedAlerts, outcomes] = await Promise.all([
      loadHistory(readClient, limit),
      loadAlerts(readClient),
      loadOutcomes(auth)
    ]);
    const liveAlerts = evaluateDiagnosticAlerts(current, history.items);
    const trends = summarizeDiagnosticTrends([current, ...history.items]);
    const providerDiagnosis = diagnoseProviderRootCauses(current.providerHealth, current);

    return jsonResponse({
      ok: true,
      version: "decision-diagnostics-v2.1",
      generatedAt: new Date().toISOString(),
      current,
      trends,
      providerHealth: current.providerHealth,
      providerDiagnosis,
      history,
      alerts: {
        available: storedAlerts.available,
        warning: storedAlerts.warning,
        live: liveAlerts,
        stored: storedAlerts.items
      },
      outcomes,
      simulator: simulation,
      productionThresholds: current.thresholds,
      report: {
        json: "/api/diagnostics-v2/report?format=json",
        csv: "/api/diagnostics-v2/report?format=csv"
      },
      paperOnly: true,
      disclaimer: "Diagnostics, root-cause guidance and threshold simulation are descriptive. They do not change production probabilities, decisions or paper-risk limits."
    }, 200, requestId, { "Cache-Control": "no-store" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Decision Diagnostics V2 could not be loaded" : String(error)
    }, 500, requestId);
  }
}
