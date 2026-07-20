import {
  boundedNumber,
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../lib/api-security";
import { autonomousAgentConfiguration } from "../../../../lib/autonomous-agent-config.js";
import { SPORTS } from "../../../../lib/sports.js";

export const dynamic = "force-dynamic";

const SUPPORTED = SPORTS.flatMap((group) => group.leagues.map((league) => ({
  key: league.key,
  title: league.title,
  sport: group.sport
}));
const SUPPORTED_KEYS = new Set(SUPPORTED.map((item) => item.key));
const DEFAULT_SETTINGS = {
  enabled: false,
  sports: [],
  daily_pick_limit: 3,
  min_priority_score: 0.62,
  min_odds: 1.2,
  max_odds: 5
};

function missingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function normalizeSports(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 120)).filter((item) => SUPPORTED_KEYS.has(item)))]
    .sort()
    .slice(0, 6);
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { response: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return { auth };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomous_agent_read",
    limit: 60,
    windowSeconds: 60
  });
  if (limited) return limited;

  const [settingsResult, stateResult, runsResult] = await Promise.all([
    auth.supabase.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,created_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs")
      .select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,summary,error,started_at,completed_at,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const error = settingsResult.error || stateResult.error || runsResult.error;
  const configuration = autonomousAgentConfiguration();
  if (error && missingTable(error)) {
    return jsonResponse({
      ok: true,
      available: false,
      warning: "Autonomous Agent migration is not active",
      paperOnly: true,
      agentActive: false,
      configuration: {
        enabledFlag: configuration.enabledFlag,
        configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured
      },
      settings: DEFAULT_SETTINGS,
      state: null,
      runs: [],
      supportedSports: SUPPORTED
    }, 200, requestId);
  }
  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Autonomous Agent status could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    available: true,
    paperOnly: true,
    realMoneyBetting: false,
    agentActive: configuration.agentActive,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    intervalMinutes: configuration.intervalMinutes,
    configuration: {
      enabledFlag: configuration.enabledFlag,
      configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured
    },
    settings: { ...DEFAULT_SETTINGS, ...(settingsResult.data || {}) },
    state: stateResult.data || null,
    runs: runsResult.data || [],
    supportedSports: SUPPORTED,
    limits: { dailyPickLimit: 3, sports: 6, maxOdds: 20 }
  }, 200, requestId);
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomous_agent_settings_write",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  if (typeof body.data?.enabled !== "boolean") {
    return jsonResponse({ ok: false, error: "Autonomous Agent enabled state is required" }, 400, requestId);
  }

  const minOdds = boundedNumber(body.data?.minOdds ?? body.data?.min_odds, { min: 1.01, max: 20, fallback: 1.2 });
  const maxOdds = boundedNumber(body.data?.maxOdds ?? body.data?.max_odds, { min: 1.01, max: 20, fallback: 5 });
  if (minOdds === null || maxOdds === null || maxOdds < minOdds) {
    return jsonResponse({ ok: false, error: "Autonomous Agent odds range is invalid" }, 400, requestId);
  }

  const row = {
    user_id: auth.user.id,
    enabled: body.data.enabled,
    sports: normalizeSports(body.data?.sports),
    daily_pick_limit: Math.trunc(boundedNumber(body.data?.dailyPickLimit ?? body.data?.daily_pick_limit, {
      min: 1,
      max: 3,
      fallback: 3
    })),
    min_priority_score: boundedNumber(body.data?.minPriorityScore ?? body.data?.min_priority_score, {
      min: 0.5,
      max: 1,
      fallback: 0.62
    }),
    min_odds: minOdds,
    max_odds: maxOdds
  };

  const { data, error } = await auth.supabase.from("autonomous_agent_settings")
    .upsert(row, { onConflict: "user_id" })
    .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,created_at,updated_at")
    .single();
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Autonomous Agent settings could not be saved")
    }, missingTable(error) ? 503 : 500, requestId);
  }
  return jsonResponse({ ok: true, paperOnly: true, settings: data }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomous_agent_run_request",
    limit: 4,
    windowSeconds: 3600
  });
  if (limited) return limited;

  const { data, error } = await auth.supabase.rpc("request_autonomous_agent_run");
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Autonomous Agent run could not be requested")
    }, missingTable(error) ? 503 : 500, requestId);
  }
  if (!data) return jsonResponse({ ok: false, error: "Enable Autonomous Agent before requesting a run" }, 409, requestId);
  return jsonResponse({
    ok: true,
    accepted: true,
    paperOnly: true,
    message: "Autonomous Agent run was queued for the next protected worker cycle"
  }, 202, requestId);
}
