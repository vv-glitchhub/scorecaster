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
})));
const SUPPORTED_KEYS = new Set(SUPPORTED.map((item) => item.key));
const DEFAULT_SETTINGS = {
  enabled: false,
  sports: [],
  daily_pick_limit: 3,
  min_priority_score: 0.62,
  min_odds: 1.2,
  max_odds: 5
};
const DEFAULT_V12_CONTROLS = {
  kill_switch: false,
  autonomy_level: "balanced",
  max_daily_loss_percent: 4,
  max_drawdown_percent: 15,
  max_loss_streak: 10,
  allow_shadow_learning: true,
  allow_automatic_risk_tightening: true
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

function normalizeAutonomyLevel(value) {
  const level = cleanText(value, 20).toLowerCase();
  return ["observe", "conservative", "balanced"].includes(level) ? level : "balanced";
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

  const [settingsResult, stateResult, runsResult, controlsResult, v12StateResult, learningResult, auditResult] = await Promise.all([
    auth.supabase.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,created_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs")
      .select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,summary,error,started_at,completed_at,created_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30),
    auth.supabase.from("autonomous_agent_v12_controls")
      .select("kill_switch,autonomy_level,max_daily_loss_percent,max_drawdown_percent,max_loss_streak,allow_shadow_learning,allow_automatic_risk_tightening,created_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_v12_state")
      .select("operating_state,policy,circuit_breakers,learning_report,shadow_champion_id,last_audit,last_learning_at,last_decision_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_v12_learning_cycles")
      .select("id,status,sample_size,clv_sample,probability_sample,metrics,calibration,challenger,policy,created_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30),
    auth.supabase.from("autonomous_agent_v12_audit")
      .select("id,run_id,event_id,selection,action,reasons,evidence,created_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100)
  ]);

  const baseError = settingsResult.error || stateResult.error || runsResult.error;
  const configuration = autonomousAgentConfiguration();
  if (baseError && missingTable(baseError)) {
    return jsonResponse({
      ok: true,
      available: false,
      v12Available: false,
      warning: "Autonomous Agent migration is not active",
      paperOnly: true,
      realMoneyBetting: false,
      agentActive: false,
      configuration: {
        enabledFlag: configuration.enabledFlag,
        configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured
      },
      settings: DEFAULT_SETTINGS,
      controls: DEFAULT_V12_CONTROLS,
      state: null,
      v12State: null,
      runs: [],
      learningCycles: [],
      audit: [],
      supportedSports: SUPPORTED
    }, 200, requestId);
  }
  if (baseError) {
    return jsonResponse({ ok: false, error: publicError(baseError, "Autonomous Agent status could not be loaded") }, 500, requestId);
  }

  const v12Error = controlsResult.error || v12StateResult.error || learningResult.error || auditResult.error;
  const v12Available = !v12Error;
  if (v12Error && !missingTable(v12Error)) {
    return jsonResponse({ ok: false, error: publicError(v12Error, "Autonomous V12 status could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    version: "autonomous-scorecaster-v12-api-v1",
    available: true,
    v12Available,
    v12Warning: v12Available ? null : "Autonomous V12 migration is not active",
    migrationRequired: v12Available ? null : "supabase/scorecaster_autonomous_v12.sql",
    paperOnly: true,
    realMoneyBetting: false,
    productionProbabilityChanged: false,
    automaticRiskRelaxation: false,
    agentActive: configuration.agentActive,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    intervalMinutes: 15,
    configuration: {
      enabledFlag: configuration.enabledFlag,
      configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured
    },
    settings: { ...DEFAULT_SETTINGS, ...(settingsResult.data || {}) },
    controls: { ...DEFAULT_V12_CONTROLS, ...(controlsResult.data || {}) },
    state: stateResult.data || null,
    v12State: v12StateResult.data || null,
    runs: runsResult.data || [],
    learningCycles: learningResult.data || [],
    audit: auditResult.data || [],
    supportedSports: SUPPORTED,
    limits: {
      dailyPickLimit: 3,
      sports: 6,
      maxOdds: 20,
      autonomyLevels: ["observe", "conservative", "balanced"],
      paperOnly: true
    }
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

  const body = await readJsonBody(request, 24 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  if (typeof body.data?.enabled !== "boolean") {
    return jsonResponse({ ok: false, error: "Autonomous Agent enabled state is required" }, 400, requestId);
  }

  const minOdds = boundedNumber(body.data?.minOdds ?? body.data?.min_odds, { min: 1.01, max: 20, fallback: 1.2 });
  const maxOdds = boundedNumber(body.data?.maxOdds ?? body.data?.max_odds, { min: 1.01, max: 20, fallback: 5 });
  if (minOdds === null || maxOdds === null || maxOdds < minOdds) {
    return jsonResponse({ ok: false, error: "Autonomous Agent odds range is invalid" }, 400, requestId);
  }

  const settingsRow = {
    user_id: auth.user.id,
    enabled: body.data.enabled,
    sports: normalizeSports(body.data?.sports),
    daily_pick_limit: Math.trunc(boundedNumber(body.data?.dailyPickLimit ?? body.data?.daily_pick_limit, { min: 1, max: 3, fallback: 3 })),
    min_priority_score: boundedNumber(body.data?.minPriorityScore ?? body.data?.min_priority_score, { min: 0.5, max: 1, fallback: 0.62 }),
    min_odds: minOdds,
    max_odds: maxOdds
  };
  const controlsRow = {
    user_id: auth.user.id,
    kill_switch: body.data?.killSwitch === true || body.data?.kill_switch === true,
    autonomy_level: normalizeAutonomyLevel(body.data?.autonomyLevel ?? body.data?.autonomy_level),
    max_daily_loss_percent: boundedNumber(body.data?.maxDailyLossPercent ?? body.data?.max_daily_loss_percent, { min: 0.5, max: 10, fallback: 4 }),
    max_drawdown_percent: boundedNumber(body.data?.maxDrawdownPercent ?? body.data?.max_drawdown_percent, { min: 2, max: 30, fallback: 15 }),
    max_loss_streak: Math.trunc(boundedNumber(body.data?.maxLossStreak ?? body.data?.max_loss_streak, { min: 3, max: 20, fallback: 10 })),
    allow_shadow_learning: body.data?.allowShadowLearning !== false && body.data?.allow_shadow_learning !== false,
    allow_automatic_risk_tightening: body.data?.allowAutomaticRiskTightening !== false && body.data?.allow_automatic_risk_tightening !== false
  };

  const [settingsWrite, controlsWrite] = await Promise.all([
    auth.supabase.from("autonomous_agent_settings").upsert(settingsRow, { onConflict: "user_id" })
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,created_at,updated_at").single(),
    auth.supabase.from("autonomous_agent_v12_controls").upsert(controlsRow, { onConflict: "user_id" })
      .select("kill_switch,autonomy_level,max_daily_loss_percent,max_drawdown_percent,max_loss_streak,allow_shadow_learning,allow_automatic_risk_tightening,created_at,updated_at").single()
  ]);
  const error = settingsWrite.error || controlsWrite.error;
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, missingTable(error) ? "Autonomous V12 migration is not active" : "Autonomous V12 settings could not be saved"),
      migrationRequired: missingTable(error) ? "supabase/scorecaster_autonomous_v12.sql" : null
    }, missingTable(error) ? 503 : 500, requestId);
  }
  return jsonResponse({
    ok: true,
    version: "autonomous-scorecaster-v12-api-v1",
    paperOnly: true,
    realMoneyBetting: false,
    settings: settingsWrite.data,
    controls: controlsWrite.data
  }, 200, requestId);
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
      error: publicError(error, "Autonomous V12 run could not be requested")
    }, missingTable(error) ? 503 : 500, requestId);
  }
  if (!data) return jsonResponse({ ok: false, error: "Enable Autonomous Agent before requesting a run" }, 409, requestId);
  return jsonResponse({
    ok: true,
    accepted: true,
    paperOnly: true,
    realMoneyBetting: false,
    message: "Autonomous Scorecaster V12 was queued for the next protected worker cycle"
  }, 202, requestId);
}
