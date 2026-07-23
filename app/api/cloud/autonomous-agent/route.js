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

const SUPPORTED = SPORTS.flatMap((group) => group.leagues.map((league) => ({ key: league.key, title: league.title, sport: group.sport })));
const SUPPORTED_KEYS = new Set(SUPPORTED.map((item) => item.key));
const DEFAULT_SETTINGS = {
  enabled: false,
  sports: [],
  daily_pick_limit: 3,
  min_priority_score: 0.62,
  min_odds: 1.2,
  max_odds: 5,
  autonomy_profile: "conservative",
  learning_enabled: true,
  auto_paper_promotion: true,
  max_consecutive_losses: 6,
  max_drawdown_percent: 12,
  minimum_provider_health: 60
};

function missingV12(error) {
  return error?.code === "42P01" || error?.code === "42703" || /does not exist|schema cache/i.test(error?.message || "");
}

function normalizeSports(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 120)).filter((item) => SUPPORTED_KEYS.has(item)))].sort().slice(0, 6);
}

function profile(value) {
  const next = cleanText(value, 30);
  return ["conservative", "balanced", "research"].includes(next) ? next : "conservative";
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
  const limited = await enforceRateLimit(auth, requestId, { bucket: "autonomous_agent_read", limit: 60, windowSeconds: 60 });
  if (limited) return limited;

  const [settingsResult, stateResult, runsResult, learningResult, modelsResult, incidentsResult] = await Promise.all([
    auth.supabase.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,autonomy_profile,learning_enabled,auto_paper_promotion,max_consecutive_losses,max_drawdown_percent,minimum_provider_health,created_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_state")
      .select("next_check_at,lease_expires_at,last_started_at,last_completed_at,last_status,last_error,last_run_id,last_candidate_count,last_selected_count,last_saved_count,last_skipped_count,last_total_stake,operating_mode,health_score,kill_switch_active,kill_switch_reason,next_interval_minutes,champion_model_key,challenger_model_key,promotion_ready_streak,last_learning_at,updated_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("autonomous_agent_runs")
      .select("id,status,candidate_count,selected_count,saved_count,skipped_count,total_stake,sports,operating_mode,health_score,learning_snapshot,incident_count,summary,error,started_at,completed_at,created_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(20),
    auth.supabase.from("autonomous_agent_learning_snapshots")
      .select("id,operating_mode,health_score,sample_size,champion_model_key,challenger_model_key,promotion_action,performance,provider_health,model_lab,control_plane,captured_at")
      .eq("user_id", auth.user.id).order("captured_at", { ascending: false }).limit(30),
    auth.supabase.from("autonomous_agent_models")
      .select("id,model_key,model_type,parameters,status,sample_size,train_metrics,holdout_metrics,promotion_evidence,probability_applied_to_published_model,paper_risk_policy_only,promoted_at,retired_at,updated_at")
      .eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(20),
    auth.supabase.from("autonomous_agent_incidents")
      .select("id,fingerprint,incident_type,severity,title,message,details,active,first_seen_at,last_seen_at,resolved_at")
      .eq("user_id", auth.user.id).order("last_seen_at", { ascending: false }).limit(50)
  ]);

  const baseError = settingsResult.error || stateResult.error || runsResult.error;
  const configuration = autonomousAgentConfiguration();
  if (baseError && missingV12(baseError)) {
    return jsonResponse({
      ok: true,
      available: false,
      version: "autonomous-intelligence-v12",
      warning: "Autonomous Agent migration is not active",
      paperOnly: true,
      realMoneyBetting: false,
      agentActive: false,
      configuration: { enabledFlag: configuration.enabledFlag, configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured },
      settings: DEFAULT_SETTINGS,
      state: null,
      runs: [],
      learning: [],
      models: [],
      incidents: [],
      supportedSports: SUPPORTED
    }, 200, requestId);
  }
  if (baseError) return jsonResponse({ ok: false, error: publicError(baseError, "Autonomous Agent status could not be loaded") }, 500, requestId);

  const v12Error = learningResult.error || modelsResult.error || incidentsResult.error;
  const v12Active = !v12Error;
  if (v12Error && !missingV12(v12Error)) {
    return jsonResponse({ ok: false, error: publicError(v12Error, "Autonomous Intelligence V12 status could not be loaded") }, 500, requestId);
  }

  return jsonResponse({
    ok: true,
    available: true,
    version: "autonomous-intelligence-v12",
    v12Active,
    warning: v12Active ? null : "Autonomous Intelligence V12 migration is not active; V1 paper automation remains available.",
    paperOnly: true,
    realMoneyBetting: false,
    publishedProbabilityChangedByLearning: false,
    agentActive: configuration.agentActive,
    schedulingManagedExternally: configuration.schedulingManagedExternally,
    intervalMinutes: configuration.intervalMinutes,
    configuration: { enabledFlag: configuration.enabledFlag, configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured },
    settings: { ...DEFAULT_SETTINGS, ...(settingsResult.data || {}) },
    state: stateResult.data || null,
    runs: runsResult.data || [],
    learning: v12Active ? learningResult.data || [] : [],
    models: v12Active ? modelsResult.data || [] : [],
    incidents: v12Active ? incidentsResult.data || [] : [],
    supportedSports: SUPPORTED,
    limits: { dailyPickLimit: 3, sports: 6, maxOdds: 20, minimumPromotionSamples: 300 },
    safety: {
      paperOnly: true,
      realMoneyExecution: false,
      automaticKillSwitch: true,
      automaticPaperPromotionOnly: true,
      publishedProbabilityChanged: false,
      contextCanUpgradeToPlay: false
    }
  }, 200, requestId);
}

export async function PUT(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "autonomous_agent_settings_write", limit: 20, windowSeconds: 300 });
  if (limited) return limited;

  const body = await readJsonBody(request, 24 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  if (typeof body.data?.enabled !== "boolean") return jsonResponse({ ok: false, error: "Autonomous Agent enabled state is required" }, 400, requestId);

  const minOdds = boundedNumber(body.data?.minOdds ?? body.data?.min_odds, { min: 1.01, max: 20, fallback: 1.2 });
  const maxOdds = boundedNumber(body.data?.maxOdds ?? body.data?.max_odds, { min: 1.01, max: 20, fallback: 5 });
  if (minOdds === null || maxOdds === null || maxOdds < minOdds) return jsonResponse({ ok: false, error: "Autonomous Agent odds range is invalid" }, 400, requestId);

  const row = {
    user_id: auth.user.id,
    enabled: body.data.enabled,
    sports: normalizeSports(body.data?.sports),
    daily_pick_limit: Math.trunc(boundedNumber(body.data?.dailyPickLimit ?? body.data?.daily_pick_limit, { min: 1, max: 3, fallback: 3 })),
    min_priority_score: boundedNumber(body.data?.minPriorityScore ?? body.data?.min_priority_score, { min: 0.5, max: 1, fallback: 0.62 }),
    min_odds: minOdds,
    max_odds: maxOdds,
    autonomy_profile: profile(body.data?.autonomyProfile ?? body.data?.autonomy_profile),
    learning_enabled: body.data?.learningEnabled ?? body.data?.learning_enabled ?? true,
    auto_paper_promotion: body.data?.autoPaperPromotion ?? body.data?.auto_paper_promotion ?? true,
    max_consecutive_losses: Math.trunc(boundedNumber(body.data?.maxConsecutiveLosses ?? body.data?.max_consecutive_losses, { min: 3, max: 20, fallback: 6 })),
    max_drawdown_percent: boundedNumber(body.data?.maxDrawdownPercent ?? body.data?.max_drawdown_percent, { min: 3, max: 30, fallback: 12 }),
    minimum_provider_health: boundedNumber(body.data?.minimumProviderHealth ?? body.data?.minimum_provider_health, { min: 30, max: 90, fallback: 60 })
  };

  const { data, error } = await auth.supabase.from("autonomous_agent_settings").upsert(row, { onConflict: "user_id" })
    .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,autonomy_profile,learning_enabled,auto_paper_promotion,max_consecutive_losses,max_drawdown_percent,minimum_provider_health,created_at,updated_at").single();
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Autonomous Agent settings could not be saved") }, missingV12(error) ? 503 : 500, requestId);
  return jsonResponse({ ok: true, version: "autonomous-intelligence-v12", paperOnly: true, realMoneyBetting: false, settings: data }, 200, requestId);
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  const guarded = await requireAuth(request, requestId);
  if (guarded.response) return guarded.response;
  const auth = guarded.auth;
  const limited = await enforceRateLimit(auth, requestId, { bucket: "autonomous_agent_run_request", limit: 4, windowSeconds: 3600 });
  if (limited) return limited;

  const { data, error } = await auth.supabase.rpc("request_autonomous_agent_run");
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Autonomous Agent run could not be requested") }, missingV12(error) ? 503 : 500, requestId);
  if (!data) return jsonResponse({ ok: false, error: "Enable Autonomous Agent before requesting a run" }, 409, requestId);
  return jsonResponse({ ok: true, accepted: true, version: "autonomous-intelligence-v12", paperOnly: true, message: "Autonomous Intelligence V12 run was queued for the next protected worker cycle" }, 202, requestId);
}
