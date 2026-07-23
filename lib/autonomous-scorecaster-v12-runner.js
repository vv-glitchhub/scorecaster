import { GET as getTopPicks } from "../app/api/top-picks/route.js";
import { buildSelfLearningReport } from "./agent-self-learning.mjs";
import { runAutonomousPaperAgent } from "./autonomous-paper-agent.js";
import {
  buildAutonomyJournal,
  buildAutonomyState
} from "./autonomous-scorecaster-v12.mjs";
import {
  buildV121Control,
  buildV121Incidents
} from "./autonomous-intelligence-v12-1.mjs";

const PREFLIGHT_LIMIT = 20;
const HISTORY_LIMIT = 1000;
const OPEN_LIMIT = 200;

function clean(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function iso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function missingV121(error) {
  return error?.code === "42P01" || error?.code === "42703" || /does not exist|schema cache/i.test(error?.message || "");
}

function modelHistoryRow(row = {}) {
  return {
    id: row.id,
    status: row.status,
    result: row.status === "won" ? "win" : row.status === "lost" ? "loss" : row.status === "push" || row.status === "void" ? "push" : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stake: Number(row.stake || 0),
    odds: Number(row.odds || 0),
    profit: row.profit === null ? null : Number(row.profit),
    closingOdds: row.closing_odds === null ? null : Number(row.closing_odds),
    clv: row.clv === null ? null : Number(row.clv),
    sportKey: row.sport || row.league || "unknown",
    league: row.league || row.sport || "unknown",
    marketKey: row.market || "h2h",
    modelProbability: row.raw_pick?.modelProbability ?? null,
    raw_pick: row.raw_pick || {}
  };
}

async function v121MigrationReady(admin) {
  const { error } = await admin.from("autonomous_agent_learning_snapshots").select("id").limit(1);
  if (!error) return true;
  if (missingV121(error)) return false;
  throw error;
}

async function loadProviderContext(admin) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [observationsResult, incidentsResult] = await Promise.all([
    admin.from("unified_data_provider_observations")
      .select("provider_key,family,mode,ok,trust_score,confidence_score,age_hours,divergence,observed_at")
      .gte("observed_at", since).order("observed_at", { ascending: false }).limit(500),
    admin.from("unified_data_incidents")
      .select("incident_type,severity,title,message,details,active,last_seen_at")
      .eq("active", true).order("last_seen_at", { ascending: false }).limit(100)
  ]);
  if (observationsResult.error && !missingV121(observationsResult.error)) throw observationsResult.error;
  if (incidentsResult.error && !missingV121(incidentsResult.error)) throw incidentsResult.error;
  return {
    observations: observationsResult.error ? [] : observationsResult.data || [],
    incidents: incidentsResult.error ? [] : incidentsResult.data || []
  };
}

async function loadUserRiskContext(admin, userId, v121Active) {
  const requests = [
    admin.from("autonomous_agent_settings").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("bankroll_settings").select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode").eq("user_id", userId).maybeSingle(),
    admin.from("bets").select("id,status,created_at,updated_at,stake,odds,profit,closing_odds,clv,sport,league,market,raw_pick").eq("user_id", userId).neq("status", "open").order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
    admin.from("bets").select("id,stake,league,sport,match,status,raw_pick").eq("user_id", userId).eq("status", "open").order("created_at", { ascending: true }).limit(OPEN_LIMIT),
    admin.from("autonomous_agent_state").select("*").eq("user_id", userId).maybeSingle()
  ];
  const [settingsResult, bankrollResult, historyResult, openResult, stateResult] = await Promise.all(requests);
  const error = settingsResult.error || bankrollResult.error || historyResult.error || openResult.error || stateResult.error;
  if (error) throw error;
  const history = (historyResult.data || []).map(modelHistoryRow);
  const bankroll = {
    bankroll: Number(bankrollResult.data?.bankroll || 1000),
    maxStakePercent: Number(bankrollResult.data?.max_stake_percent || 2),
    maxTotalExposurePercent: Number(bankrollResult.data?.max_daily_exposure_percent || 8),
    maxLeagueExposurePercent: Number(bankrollResult.data?.max_single_league_exposure_percent || 4),
    minEdge: Number(bankrollResult.data?.min_edge || 0.025),
    minConfidence: Number(bankrollResult.data?.min_confidence || 0.58),
    paperTradingMode: bankrollResult.data?.paper_trading_mode !== false
  };
  return {
    settings: settingsResult.data || null,
    bankroll,
    history,
    openBets: openResult.data || [],
    state: stateResult.data || {},
    modelLab: buildSelfLearningReport(history),
    v121Active
  };
}

function sportsKey(settings = {}) {
  return Array.isArray(settings.sports) && settings.sports.length ? [...settings.sports].sort().join(",") : "__default__";
}

async function loadCurrentPicks(origin, settings, cache) {
  const key = sportsKey(settings);
  if (cache.has(key)) return cache.get(key);
  const target = new URL("/api/top-picks", origin);
  if (key !== "__default__") target.searchParams.set("sports", key);
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || payload?.reason || "Current Top Picks unavailable");
  const picks = Array.isArray(payload?.data) ? payload.data : [];
  cache.set(key, picks);
  return picks;
}

async function insertDeferredRun(admin, userId, context, state, control, now) {
  const journal = buildAutonomyJournal({ state });
  const { data, error } = await admin.from("autonomous_agent_runs").insert({
    user_id: userId,
    status: "deferred",
    sports: Array.isArray(context.settings?.sports) ? context.settings.sports : [],
    operating_mode: control?.mode || state.mode,
    health_score: control?.healthScore ?? null,
    learning_snapshot: control || {},
    incident_count: control ? buildV121Incidents(control).length : 0,
    summary: {
      paperOnly: true,
      realMoneyBetting: false,
      agentVersion: control ? "Autonomous-Intelligence-V12.1" : "Autonomous-Scorecaster-V12",
      failureStage: "v12_preflight",
      autonomyV12: state,
      autonomyV121: control || null,
      autonomyJournal: journal
    },
    error: clean(`V12 circuit breaker: ${(control?.blockers || state.blockers).join(", ") || state.reason}`, 500),
    started_at: now.toISOString(),
    completed_at: now.toISOString()
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

function cooldownHours(state) {
  if (state.blockers.includes("loss_streak_cooldown") || state.blockers.includes("rolling_loss_limit") || state.blockers.includes("configured_loss_streak_limit") || state.blockers.includes("configured_drawdown_limit")) return 24;
  if (state.blockers.includes("critical_model_drift")) return 6;
  return 3;
}

async function syncIncidents(admin, userId, control, now) {
  const incidents = buildV121Incidents(control);
  const fingerprints = new Set(incidents.map((incident) => incident.fingerprint));
  for (const incident of incidents) {
    const { error } = await admin.from("autonomous_agent_incidents").upsert({
      user_id: userId,
      fingerprint: incident.fingerprint,
      incident_type: incident.incidentType,
      severity: incident.severity,
      title: incident.title,
      message: incident.message,
      details: incident.details,
      active: true,
      last_seen_at: now.toISOString(),
      resolved_at: null
    }, { onConflict: "user_id,fingerprint" });
    if (error) throw error;
  }
  const { data: active, error: activeError } = await admin.from("autonomous_agent_incidents").select("id,fingerprint").eq("user_id", userId).eq("active", true);
  if (activeError) throw activeError;
  for (const row of active || []) {
    if (fingerprints.has(row.fingerprint)) continue;
    const { error } = await admin.from("autonomous_agent_incidents").update({ active: false, resolved_at: now.toISOString(), last_seen_at: now.toISOString() }).eq("id", row.id);
    if (error) throw error;
  }
  return incidents.length;
}

async function persistModel(admin, userId, control, modelLab, now) {
  const promotion = control.modelLab.promotion;
  const challenger = modelLab?.challenger;
  if (!challenger?.id) return;
  const { error } = await admin.from("autonomous_agent_models").upsert({
    user_id: userId,
    model_key: challenger.id,
    model_type: challenger.candidate?.type || "calibrator",
    parameters: challenger.candidate || {},
    status: promotion.eligible ? "champion" : "challenger",
    sample_size: control.performance.sampleSize,
    train_metrics: challenger.train || {},
    holdout_metrics: challenger.holdout || {},
    promotion_evidence: promotion,
    probability_applied_to_published_model: false,
    paper_risk_policy_only: true,
    promoted_at: promotion.eligible ? now.toISOString() : null
  }, { onConflict: "user_id,model_key" });
  if (error) throw error;
  if (promotion.eligible) {
    const { error: retireError } = await admin.from("autonomous_agent_models").update({ status: "retired", retired_at: now.toISOString() }).eq("user_id", userId).eq("status", "champion").neq("model_key", challenger.id);
    if (retireError) throw retireError;
  }
}

async function persistControl(admin, userId, context, state, control, runId, now) {
  if (!context.v121Active || !control) return { incidentCount: 0, snapshotId: null };
  const promotion = control.modelLab.promotion;
  const { data: snapshot, error: snapshotError } = await admin.from("autonomous_agent_learning_snapshots").insert({
    user_id: userId,
    operating_mode: control.mode,
    health_score: control.healthScore,
    sample_size: control.performance.sampleSize,
    champion_model_key: promotion.championKey,
    challenger_model_key: promotion.challengerKey,
    promotion_action: promotion.action,
    performance: control.performance,
    provider_health: control.provider,
    model_lab: context.modelLab || {},
    control_plane: control,
    captured_at: now.toISOString()
  }).select("id").single();
  if (snapshotError) throw snapshotError;
  await persistModel(admin, userId, control, context.modelLab, now);
  const incidentCount = await syncIncidents(admin, userId, control, now);
  const nextCheckAt = new Date(now.getTime() + control.nextIntervalMinutes * 60_000).toISOString();
  const { error: stateError } = await admin.from("autonomous_agent_state").update({
    operating_mode: control.mode,
    health_score: control.healthScore,
    kill_switch_active: control.killSwitchActive,
    kill_switch_reason: control.killSwitchReason,
    next_interval_minutes: control.nextIntervalMinutes,
    next_check_at: nextCheckAt,
    champion_model_key: promotion.championKey,
    challenger_model_key: promotion.challengerKey,
    promotion_ready_streak: promotion.readyStreak,
    last_learning_at: now.toISOString()
  }).eq("user_id", userId);
  if (stateError) throw stateError;
  if (runId) {
    const { data: run, error: runReadError } = await admin.from("autonomous_agent_runs").select("summary").eq("id", runId).maybeSingle();
    if (runReadError) throw runReadError;
    const { error: runError } = await admin.from("autonomous_agent_runs").update({
      operating_mode: control.mode,
      health_score: control.healthScore,
      learning_snapshot: { id: snapshot.id, performance: control.performance, provider: control.provider, model: control.modelLab },
      incident_count: incidentCount,
      summary: { ...(run?.summary || {}), autonomyV12: state, autonomyV121: control, probabilityChangedByAutonomy: false, realMoneyBetting: false, paperOnly: true }
    }).eq("id", runId);
    if (runError) throw runError;
  }
  return { incidentCount, snapshotId: snapshot.id, nextCheckAt };
}

async function deferFrozenUser(admin, row, context, state, control, now) {
  const runId = await insertDeferredRun(admin, row.user_id, context, state, control, now);
  const hours = control ? Math.max(1, control.nextIntervalMinutes / 60) : cooldownHours(state);
  const next = new Date(now.getTime() + hours * 3_600_000).toISOString();
  const message = clean(`Autonomous Scorecaster frozen: ${(control?.blockers || state.blockers).join(", ") || state.reason}`, 500);
  const { error } = await admin.from("autonomous_agent_state").update({
    lease_expires_at: null,
    next_check_at: next,
    last_started_at: now.toISOString(),
    last_completed_at: now.toISOString(),
    last_status: "deferred",
    last_error: message,
    last_run_id: runId,
    last_candidate_count: 0,
    last_selected_count: 0,
    last_saved_count: 0,
    last_skipped_count: 0,
    last_total_stake: 0
  }).eq("user_id", row.user_id);
  if (error) throw error;
  await persistControl(admin, row.user_id, context, state, control, runId, now);
  return { userId: row.user_id, runId, nextCheckAt: next, state, control };
}

async function runPreflight(admin, origin, providerContext, now, v121Active) {
  const nowIso = now.toISOString();
  const { data, error } = await admin.from("autonomous_agent_state").select("user_id,next_check_at,lease_expires_at,last_status").lte("next_check_at", nowIso).or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`).order("next_check_at", { ascending: true }).limit(PREFLIGHT_LIMIT);
  if (error) throw error;

  const checked = [];
  const frozen = [];
  const failed = [];
  const picksCache = new Map();
  for (const row of data || []) {
    try {
      const context = await loadUserRiskContext(admin, row.user_id, v121Active);
      if (!context.settings?.enabled) continue;
      const decisions = await loadCurrentPicks(origin, context.settings, picksCache);
      const state = buildAutonomyState({ history: context.history, decisions, modelLab: context.modelLab, bankroll: context.bankroll, openBets: context.openBets, now });
      const control = v121Active ? buildV121Control({ baseState: state, history: context.history, bankroll: context.bankroll.bankroll, modelLab: context.modelLab, providerObservations: providerContext.observations, providerIncidents: providerContext.incidents, settings: context.settings, previousState: context.state }) : null;
      const effectiveState = control ? { ...state, mode: control.mode, blockers: control.blockers, warnings: control.warnings } : state;
      checked.push({ userId: row.user_id, mode: effectiveState.mode, context, state: effectiveState, control });
      if (effectiveState.mode === "FROZEN") frozen.push(await deferFrozenUser(admin, row, context, effectiveState, control, now));
    } catch (preflightError) {
      failed.push({ userId: row.user_id, error: clean(preflightError?.message || preflightError, 300) });
    }
  }
  return { checked, frozen, failed };
}

async function enrichRecentRuns(admin, preflight, startedAt, providerContext, now, v121Active) {
  const { data: runs, error } = await admin.from("autonomous_agent_runs").select("id,user_id,status,summary,started_at").gte("started_at", new Date(startedAt.getTime() - 1000).toISOString()).order("started_at", { ascending: true }).limit(50);
  if (error) throw error;

  const preflightByUser = new Map(preflight.checked.map((item) => [item.userId, item]));
  let enriched = 0;
  let persisted = 0;
  for (const run of runs || []) {
    if (run.summary?.autonomyV121) continue;
    try {
      let item = preflightByUser.get(run.user_id);
      if (!item) {
        const context = await loadUserRiskContext(admin, run.user_id, v121Active);
        const state = buildAutonomyState({ history: context.history, modelLab: context.modelLab, bankroll: context.bankroll, openBets: context.openBets, now });
        const control = v121Active ? buildV121Control({ baseState: state, history: context.history, bankroll: context.bankroll.bankroll, modelLab: context.modelLab, providerObservations: providerContext.observations, providerIncidents: providerContext.incidents, settings: context.settings, previousState: context.state }) : null;
        item = { context, state, control };
      }
      const journal = buildAutonomyJournal({ state: item.state, selected: Array.isArray(run.summary?.decisions) ? run.summary.decisions.filter((decision) => decision.saved) : [], skipped: [] });
      const { error: updateError } = await admin.from("autonomous_agent_runs").update({ summary: { ...(run.summary || {}), agentVersion: v121Active ? "Autonomous-Intelligence-V12.1" : "Autonomous-Scorecaster-V12", autonomyV12: item.state, autonomyV121: item.control || null, autonomyJournal: journal, probabilityChangedByAutonomy: false, realMoneyBetting: false, paperOnly: true } }).eq("id", run.id);
      if (updateError) throw updateError;
      enriched += 1;
      if (v121Active && item.control) {
        await persistControl(admin, run.user_id, item.context, item.state, item.control, run.id, now);
        persisted += 1;
      }
    } catch {
      // The original paper run remains authoritative if optional V12.1 enrichment fails.
    }
  }
  return { enriched, persisted };
}

export async function runAutonomousScorecasterV12({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Scorecaster V12 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Scorecaster V12 requires a request origin");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Autonomous Scorecaster V12 requires a valid clock value");

  const [v121Active, providerContext] = await Promise.all([v121MigrationReady(admin), loadProviderContext(admin)]);
  const preflight = await runPreflight(admin, origin, providerContext, startedAt, v121Active);
  const base = await runAutonomousPaperAgent({ admin, origin, now: startedAt });
  const enrichment = await enrichRecentRuns(admin, preflight, startedAt, providerContext, new Date(), v121Active);

  return {
    ...base,
    version: v121Active ? "autonomous-intelligence-v12.1" : "autonomous-scorecaster-v12",
    baseAgentVersion: base.version,
    v121MigrationActive: v121Active,
    v12: {
      preflightChecked: preflight.checked.length,
      circuitBreakerUsers: preflight.frozen.length,
      preflightFailures: preflight.failed.length,
      enrichedRuns: enrichment.enriched,
      persistedLearningSnapshots: enrichment.persisted,
      providerHealthSamples: providerContext.observations.length,
      activeProviderIncidents: providerContext.incidents.length,
      modes: preflight.checked.reduce((acc, item) => { acc[item.mode] = (acc[item.mode] || 0) + 1; return acc; }, {}),
      safety: {
        unifiedDataGate: true,
        realHistoryGate: true,
        providerHealthGate: v121Active,
        modelDriftCircuitBreaker: true,
        drawdownCircuitBreaker: true,
        losingStreakCooldown: true,
        adaptiveScheduling: v121Active,
        persistentChampionChallenger: v121Active,
        automaticPaperPromotionOnly: true,
        probabilityChanged: false,
        realMoneyBetting: false,
        paperOnly: true
      }
    },
    generatedAt: iso(startedAt)
  };
}
