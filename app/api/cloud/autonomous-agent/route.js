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
  max_odds: 5,
  risk_profile: "balanced",
  min_data_coverage: 0.6,
  min_provider_count: 1,
  max_provider_disagreement: 0.12,
  max_drawdown_percent: 12,
  max_daily_loss_percent: 4,
  pause_after_losses: 5,
  cooldown_hours: 12,
  max_open_picks: 12,
  minimum_minutes_before_start: 20,
  maximum_hours_before_start: 72,
  auto_pause_on_incident: true,
  require_unified_data: true,
  adaptive_cadence: true,
  shadow_learning_enabled: true
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

function booleanValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

async function requireAuth(request, requestId) {
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return { response: jsonResponse({ ok: false, error: auth.error }, auth.status, requestId) };
  return { auth };
}

function readiness(configuration, settings, state, bankroll) {
  const blockers = [];
  if (!configuration.enabledFlag) blockers.push("worker_disabled");
  if (!configuration.configured) blockers.push("production_configuration_incomplete");
  if (!settings.enabled) blockers.push("user_opt_in_disabled");
  if (bankroll && bankroll.paper_trading_mode === false) blockers.push("paper_mode_disabled");
  if (Number(bankroll?.bankroll || 0) <= 0) blockers.push("virtual_bankroll_missing");
  if (state?.paused_until && Date.parse(state.paused_until) > Date.now()) blockers.push("safety_cooldown_active");
  if (state?.health_status === "blocked" || state?.health_status === "paused") blockers.push(`health_${state.health_status}`);
  return {
    ready: blockers.length === 0,
    blockers,
    healthStatus: state?.health_status || "learning",
    healthScore: Number(state?.health_score ?? 50),
    paperOnly: true
  };
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

  const [settingsResult, stateResult, runsResult, auditResult, briefsResult, bankrollResult] = await Promise.all([
    auth.supabase.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,risk_profile,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,paused_until,pause_reason,health_status,health_score,resolved_sample,consecutive_losses,drawdown_percent,roi,average_clv,last_brief,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs")
      .select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,summary,guard_summary,health_status,health_score,next_check_minutes,error,started_at,completed_at,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    auth.supabase.from("autonomous_agent_decision_audit")
      .select("id,run_id,event_id,match,selection,sport,league,allowed,reasons,warnings,quality_score,priority_score,odds,edge,confidence,data_coverage,provider_count,provider_disagreement,context_impact,minutes_before_start,risk_profile,risk_policy,proposed_stake,saved_bet_id,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    auth.supabase.from("autonomous_agent_daily_briefs")
      .select("id,brief_date,brief,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("brief_date", { ascending: false })
      .limit(14),
    auth.supabase.from("bankroll_settings")
      .select("bankroll,paper_trading_mode,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence")
      .eq("user_id", auth.user.id).maybeSingle()
  ]);

  const error = settingsResult.error || stateResult.error || runsResult.error || auditResult.error || briefsResult.error || bankrollResult.error;
  const configuration = autonomousAgentConfiguration();
  const configurationSummary = {
    enabledFlag: configuration.enabledFlag,
    configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured,
    version: configuration.version,
    intervalMinutes: configuration.intervalMinutes,
    adaptiveCadence: configuration.adaptiveCadence,
    shadowLearningOnly: configuration.shadowLearningOnly
  };
  if (error && missingTable(error)) {
    return jsonResponse({
      ok: true,
      available: false,
      warning: "Autonomous Agent V2 migration is not active",
      paperOnly: true,
      agentActive: false,
      configuration: configurationSummary,
      settings: DEFAULT_SETTINGS,
      state: null,
      runs: [],
      audit: [],
      briefs: [],
      bankroll: bankrollResult.data || null,
      readiness: { ready: false, blockers: ["migration_inactive"], healthStatus: "blocked", healthScore: 0, paperOnly: true },
      supportedSports: SUPPORTED
    }, 200, requestId);
  }
  if (error) {
    return jsonResponse({ ok: false, error: publicError(error, "Autonomous Agent status could not be loaded") }, 500, requestId);
  }

  const settings = { ...DEFAULT_SETTINGS, ...(settingsResult.data || {}) };
  const state = stateResult.data || null;
  return jsonResponse({
    ok: true,
    version: "autonomous-paper-agent-api-v2",
    available: true,
    paperOnly: true,
    realMoneyBetting: false,
    learningMode: "shadow-only",
    productionProbabilityChangedByLearning: false,
    agentActive: configuration.agentActive,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    intervalMinutes: configuration.intervalMinutes,
    configuration: configurationSummary,
    settings,
    state,
    runs: runsResult.data || [],
    audit: auditResult.data || [],
    briefs: briefsResult.data || [],
    bankroll: bankrollResult.data || null,
    readiness: readiness(configurationSummary, settings, state, bankrollResult.data || null),
    supportedSports: SUPPORTED,
    limits: { dailyPickLimit: 3, sports: 6, maxOdds: 20, maxProviderCount: 5, maximumCooldownHours: 168 }
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

  const row = {
    user_id: auth.user.id,
    enabled: body.data.enabled,
    sports: normalizeSports(body.data?.sports),
    daily_pick_limit: Math.trunc(boundedNumber(body.data?.dailyPickLimit ?? body.data?.daily_pick_limit, { min: 1, max: 3, fallback: 3 })),
    min_priority_score: boundedNumber(body.data?.minPriorityScore ?? body.data?.min_priority_score, { min: 0.5, max: 1, fallback: 0.62 }),
    min_odds: minOdds,
    max_odds: maxOdds,
    min_data_coverage: boundedNumber(body.data?.minDataCoverage ?? body.data?.min_data_coverage, { min: 0, max: 1, fallback: 0.6 }),
    min_provider_count: Math.trunc(boundedNumber(body.data?.minProviderCount ?? body.data?.min_provider_count, { min: 1, max: 5, fallback: 1 })),
    max_provider_disagreement: boundedNumber(body.data?.maxProviderDisagreement ?? body.data?.max_provider_disagreement, { min: 0.01, max: 0.5, fallback: 0.12 }),
    max_drawdown_percent: boundedNumber(body.data?.maxDrawdownPercent ?? body.data?.max_drawdown_percent, { min: 2, max: 50, fallback: 12 }),
    max_daily_loss_percent: boundedNumber(body.data?.maxDailyLossPercent ?? body.data?.max_daily_loss_percent, { min: 1, max: 25, fallback: 4 }),
    pause_after_losses: Math.trunc(boundedNumber(body.data?.pauseAfterLosses ?? body.data?.pause_after_losses, { min: 2, max: 20, fallback: 5 })),
    cooldown_hours: Math.trunc(boundedNumber(body.data?.cooldownHours ?? body.data?.cooldown_hours, { min: 1, max: 168, fallback: 12 })),
    max_open_picks: Math.trunc(boundedNumber(body.data?.maxOpenPicks ?? body.data?.max_open_picks, { min: 1, max: 100, fallback: 12 })),
    minimum_minutes_before_start: Math.trunc(boundedNumber(body.data?.minimumMinutesBeforeStart ?? body.data?.minimum_minutes_before_start, { min: 5, max: 240, fallback: 20 })),
    maximum_hours_before_start: Math.trunc(boundedNumber(body.data?.maximumHoursBeforeStart ?? body.data?.maximum_hours_before_start, { min: 2, max: 168, fallback: 72 })),
    auto_pause_on_incident: booleanValue(body.data?.autoPauseOnIncident ?? body.data?.auto_pause_on_incident, true),
    require_unified_data: booleanValue(body.data?.requireUnifiedData ?? body.data?.require_unified_data, true),
    adaptive_cadence: booleanValue(body.data?.adaptiveCadence ?? body.data?.adaptive_cadence, true),
    shadow_learning_enabled: booleanValue(body.data?.shadowLearningEnabled ?? body.data?.shadow_learning_enabled, true)
  };

  const { data, error } = await auth.supabase.from("autonomous_agent_settings")
    .upsert(row, { onConflict: "user_id" })
    .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,created_at,updated_at")
    .single();
  if (error) {
    return jsonResponse({
      ok: false,
      error: publicError(error, "Autonomous Agent settings could not be saved")
    }, missingTable(error) ? 503 : 500, requestId);
  }
  return jsonResponse({ ok: true, version: "autonomous-paper-agent-api-v2", paperOnly: true, settings: data }, 200, requestId);
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
  if (!data) return jsonResponse({ ok: false, error: "Enable Autonomous Agent and wait for any active safety cooldown to end before requesting a run" }, 409, requestId);
  return jsonResponse({
    ok: true,
    accepted: true,
    paperOnly: true,
    message: "Autonomous Agent V2 run was queued for the next protected worker cycle"
  }, 202, requestId);
}
