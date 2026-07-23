import { createHash } from "node:crypto";
import { calculateAgentPerformance } from "./agent-learning.js";
import { applyModelLabSafety } from "./agent-model-governance.mjs";
import { buildSelfLearningReport } from "./agent-self-learning.mjs";
import { buildAgentV9Portfolio } from "./agent-v9-engine.mjs";
import {
  applyAutonomousControl,
  buildAutonomousControlPlane,
  buildAutonomousIncidents
} from "./autonomous-intelligence-v12.mjs";
import { runAutonomousPaperAgent } from "./autonomous-paper-agent.js";
import { SPORTS } from "./sports.js";
import { GET as getTopPicks } from "../app/api/top-picks/route.js";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const MAX_USERS_PER_RUN = 10;
const MAX_SPORTS_PER_USER = 6;
const MAX_SOURCE_GROUPS_PER_RUN = 6;
const MAX_PICKS_PER_USER = 3;
const MAX_SAVED_PICKS_PER_RUN = 30;
const MAX_HISTORY_PER_USER = 1000;
const MAX_OPEN_BETS_PER_USER = 200;

function clean(value, maximum = 500, fallback = "") {
  return String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const number = finite(value);
  return Number(number.toFixed(digits));
}

function normalized(value) {
  return clean(value, 240).toLowerCase().replace(/\s+/g, " ");
}

function missingV12(error) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "42883" || /does not exist|schema cache/i.test(error?.message || "");
}

function eventId(pick = {}) {
  return clean(pick.eventId || pick.event_id || pick.gameId || pick.game_id || pick.id, 180);
}

function selection(pick = {}) {
  return clean(pick.selection || pick.label || pick.pick, 160);
}

function match(pick = {}) {
  return clean(pick.match || [pick.homeTeam || pick.home_team, pick.awayTeam || pick.away_team].filter(Boolean).join(" vs "), 240);
}

function league(pick = {}) {
  return clean(pick.league || pick.leagueTitle || pick.sportKey || pick.sport, 120, "unknown");
}

function sport(pick = {}) {
  return clean(pick.sportKey || pick.sport || pick.league, 120, "unknown");
}

function historyRow(row = {}) {
  return {
    id: row.id,
    result: row.status === "won" ? "win" : row.status === "lost" ? "loss" : row.status,
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.updated_at,
    stake: finite(row.stake),
    odds: finite(row.odds),
    profit: row.profit === null ? null : finite(row.profit),
    closingOdds: row.closing_odds === null ? null : finite(row.closing_odds),
    clv: row.clv === null ? null : finite(row.clv),
    sportKey: row.sport || row.league || "unknown",
    league: row.league || row.sport || "unknown",
    marketKey: row.market || "h2h",
    modelProbability: row.raw_pick?.modelProbability ?? null,
    raw_pick: row.raw_pick || {}
  };
}

function normalizeSettings(row = {}) {
  const sports = Array.isArray(row.sports)
    ? [...new Set(row.sports.map((value) => clean(value, 120)).filter((value) => SUPPORTED_SPORTS.has(value)))].sort().slice(0, MAX_SPORTS_PER_USER)
    : [];
  return {
    enabled: row.enabled === true,
    sports,
    dailyPickLimit: Math.max(1, Math.min(MAX_PICKS_PER_USER, Math.trunc(finite(row.daily_pick_limit, 3)))),
    minPriorityScore: Math.max(0.5, Math.min(1, finite(row.min_priority_score, 0.62))),
    minOdds: Math.max(1.01, Math.min(20, finite(row.min_odds, 1.2))),
    maxOdds: Math.max(1.01, Math.min(20, finite(row.max_odds, 5))),
    autonomyProfile: clean(row.autonomy_profile, 30, "conservative"),
    learningEnabled: row.learning_enabled !== false,
    autoPaperPromotion: row.auto_paper_promotion !== false,
    maxConsecutiveLosses: Math.max(3, Math.min(20, Math.trunc(finite(row.max_consecutive_losses, 6)))),
    maxDrawdownPercent: Math.max(3, Math.min(30, finite(row.max_drawdown_percent, 12))),
    minimumProviderHealth: Math.max(30, Math.min(90, finite(row.minimum_provider_health, 60)))
  };
}

function normalizeBankroll(row = {}) {
  return {
    bankroll: Math.max(0, finite(row.bankroll, 1000)),
    maxStakePercent: Math.max(0.1, Math.min(5, finite(row.max_stake_percent, 2))),
    maxTotalExposurePercent: Math.max(0.5, Math.min(20, finite(row.max_daily_exposure_percent, 8))),
    maxLeagueExposurePercent: Math.max(0.25, Math.min(10, finite(row.max_single_league_exposure_percent, 4))),
    minEdge: Math.max(0, Math.min(0.5, finite(row.min_edge, 0.025))),
    minConfidence: Math.max(0, Math.min(1, finite(row.min_confidence, 0.58))),
    paperTradingMode: row.paper_trading_mode !== false
  };
}

async function v12MigrationReady(admin) {
  const { error } = await admin.from("autonomous_agent_learning_snapshots").select("id").limit(1);
  if (!error) return true;
  if (missingV12(error)) return false;
  throw error;
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_autonomous_agent_users", { p_limit: MAX_USERS_PER_RUN });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
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
  if (observationsResult.error && !missingV12(observationsResult.error)) throw observationsResult.error;
  if (incidentsResult.error && !missingV12(incidentsResult.error)) throw incidentsResult.error;
  return {
    observations: observationsResult.error ? [] : observationsResult.data || [],
    incidents: incidentsResult.error ? [] : incidentsResult.data || []
  };
}

async function loadUserContext(admin, userId) {
  const [settingsResult, bankrollResult, openResult, historyResult, stateResult, modelsResult] = await Promise.all([
    admin.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,autonomy_profile,learning_enabled,auto_paper_promotion,max_consecutive_losses,max_drawdown_percent,minimum_provider_health")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bets").select("id,stake,league,sport,match,status,raw_pick")
      .eq("user_id", userId).eq("status", "open").order("created_at", { ascending: true }).limit(MAX_OPEN_BETS_PER_USER + 1),
    admin.from("bets").select("id,status,created_at,updated_at,stake,odds,profit,closing_odds,clv,sport,league,market,raw_pick")
      .eq("user_id", userId).neq("status", "open").order("created_at", { ascending: false }).limit(MAX_HISTORY_PER_USER),
    admin.from("autonomous_agent_state")
      .select("operating_mode,health_score,kill_switch_active,kill_switch_reason,next_interval_minutes,champion_model_key,challenger_model_key,promotion_ready_streak,last_learning_at")
      .eq("user_id", userId).maybeSingle(),
    admin.from("autonomous_agent_models")
      .select("model_key,status,parameters,sample_size,train_metrics,holdout_metrics,promotion_evidence,updated_at")
      .eq("user_id", userId).in("status", ["champion", "challenger"]).order("updated_at", { ascending: false }).limit(10)
  ]);
  const error = settingsResult.error || bankrollResult.error || openResult.error || historyResult.error || stateResult.error || modelsResult.error;
  if (error) throw error;
  return {
    settings: normalizeSettings(settingsResult.data || {}),
    bankroll: normalizeBankroll(bankrollResult.data || {}),
    openBets: openResult.data || [],
    history: (historyResult.data || []).map(historyRow),
    state: stateResult.data || {},
    models: modelsResult.data || []
  };
}

async function loadTopPicks(origin, sports) {
  const target = new URL("/api/top-picks", origin);
  if (sports.length) target.searchParams.set("sports", sports.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || payload?.reason || "Autonomous source data unavailable");
  return {
    picks: Array.isArray(payload?.data) ? payload.data : [],
    source: clean(payload?.source, 100, "no-vig-market-consensus"),
    fixtureSource: clean(payload?.fixtureSource, 100, "live-odds-provider-only")
  };
}

function sourceGroupKey(sports) {
  return sports.length ? sports.join(",") : "__default__";
}

function existingExposure(openBets, bankroll) {
  const leagues = new Map();
  const events = new Set();
  let total = 0;
  for (const row of openBets) {
    const stake = Math.max(0, finite(row.stake));
    total += stake;
    const leagueKey = normalized(row.league || row.sport || "unknown");
    leagues.set(leagueKey, (leagues.get(leagueKey) || 0) + stake);
    const identity = normalized(row.raw_pick?.eventId || row.match);
    if (identity) events.add(identity);
  }
  return {
    total,
    leagues,
    events,
    singleCap: bankroll.bankroll * bankroll.maxStakePercent / 100,
    totalCap: bankroll.bankroll * bankroll.maxTotalExposurePercent / 100,
    leagueCap: bankroll.bankroll * bankroll.maxLeagueExposurePercent / 100
  };
}

function chooseDecisions(decisions, context, control) {
  const exposure = existingExposure(context.openBets, context.bankroll);
  let remainingTotal = Math.max(0, exposure.totalCap - exposure.total);
  const leagueUsed = new Map(exposure.leagues);
  const events = new Set(exposure.events);
  const selected = [];
  const skipped = [];
  const maximumPicks = Math.min(context.settings.dailyPickLimit, control.riskPolicy.maximumPicks);

  for (const decision of decisions) {
    const reasons = [];
    const odds = finite(decision.odds);
    const edge = finite(decision.edge, -1);
    const confidence = finite(decision.confidence, -1);
    const identity = normalized(eventId(decision) || match(decision));
    const leagueKey = normalized(league(decision));
    if (control.killSwitch.active) reasons.push("autonomous_kill_switch");
    if (decision.decision !== "PLAY" || finite(decision.allocatedStake || decision.suggestedStake) <= 0) reasons.push("not_play");
    if (finite(decision.priorityScore) < context.settings.minPriorityScore) reasons.push("priority_below_user_threshold");
    if (odds < context.settings.minOdds || odds > context.settings.maxOdds) reasons.push("odds_outside_user_range");
    if (edge < context.bankroll.minEdge) reasons.push("edge_below_bankroll_threshold");
    if (confidence < context.bankroll.minConfidence) reasons.push("confidence_below_bankroll_threshold");
    if (!identity) reasons.push("missing_event_identity");
    if (events.has(identity)) reasons.push("event_already_exposed");
    if (selected.length >= maximumPicks) reasons.push("autonomous_pick_limit");
    if (reasons.length) { skipped.push({ decision, reasons }); continue; }

    const currentLeague = leagueUsed.get(leagueKey) || 0;
    const remainingLeague = Math.max(0, exposure.leagueCap - currentLeague);
    const requested = Math.max(0, finite(decision.allocatedStake || decision.suggestedStake));
    const stake = round(Math.min(requested, exposure.singleCap, remainingTotal, remainingLeague), 2);
    if (stake < 0.01) { skipped.push({ decision, reasons: [remainingTotal < 0.01 ? "total_exposure_full" : "league_exposure_full"] }); continue; }
    selected.push({ ...decision, autonomousStake: stake });
    events.add(identity);
    remainingTotal -= stake;
    leagueUsed.set(leagueKey, currentLeague + stake);
  }
  return { selected, skipped, exposure };
}

function clientRef(userId, decision, now) {
  const day = now.toISOString().slice(0, 10);
  const digest = createHash("sha256").update([userId, day, eventId(decision) || match(decision), selection(decision)].join("|")).digest("hex").slice(0, 32);
  return `autonomous-v12-${day}-${digest}`;
}

function paperRow(userId, runId, decision, source, fixtureSource, now, control) {
  const odds = finite(decision.odds);
  return {
    user_id: userId,
    client_ref: clientRef(userId, decision, now),
    label: selection(decision),
    match: match(decision),
    market: clean(decision.marketKey || decision.market, 80, "h2h"),
    bookmaker: clean(decision.bookmaker, 120, "verified-market"),
    sport: sport(decision),
    league: league(decision),
    home_team: clean(decision.homeTeam || decision.home_team, 160),
    away_team: clean(decision.awayTeam || decision.away_team, 160),
    odds,
    stake: decision.autonomousStake,
    edge: finite(decision.edge),
    ev: finite(decision.ev),
    confidence: finite(decision.confidence),
    status: "open",
    raw_pick: {
      source: "scorecaster-autonomous-v12",
      eventId: eventId(decision),
      modelProbability: decision.stressTest?.probability ?? decision.consensusProbability ?? decision.modelProbability ?? null,
      impliedProbability: odds > 1 ? 1 / odds : null,
      decision: "PLAY",
      agentVersion: "Autonomous-Intelligence-V12",
      portfolioAgentVersion: decision.agentVersion || "V12-autonomous-intelligence",
      priorityScore: round(decision.priorityScore, 6),
      robustnessScore: round(decision.robustnessScore, 6),
      autonomousRunId: runId,
      autonomousControl: {
        operatingMode: control.operatingMode,
        healthScore: control.healthScore,
        stakeMultiplier: control.riskPolicy.stakeMultiplier,
        championModelKey: control.modelLab.promotion.championKey,
        challengerModelKey: control.modelLab.promotion.challengerKey,
        promotionAction: control.modelLab.promotion.action,
        reasons: control.reasons,
        probabilityAdjustedByLearning: false
      },
      providerSource: source,
      fixtureSource,
      generatedAt: now.toISOString(),
      paperOnly: true,
      realMoneyBetting: false
    }
  };
}

async function saveDecision(admin, row) {
  const { data, error } = await admin.from("bets").upsert(row, { onConflict: "user_id,client_ref", ignoreDuplicates: true }).select("id,client_ref,stake").maybeSingle();
  if (error) return { saved: false, duplicate: false, riskRejected: error.code === "23514", error };
  if (!data) return { saved: false, duplicate: true, riskRejected: false, error: null };
  return { saved: true, duplicate: false, riskRejected: false, error: null, data };
}

async function createRun(admin, userId, sports, now) {
  const { data, error } = await admin.from("autonomous_agent_runs")
    .insert({ user_id: userId, status: "running", sports, started_at: now.toISOString(), operating_mode: "learning", health_score: 50 })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

async function persistLearning(admin, userId, control, modelLab, now) {
  const promotion = control.modelLab.promotion;
  const { data: snapshot, error: snapshotError } = await admin.from("autonomous_agent_learning_snapshots").insert({
    user_id: userId,
    operating_mode: control.operatingMode,
    health_score: control.healthScore,
    sample_size: control.performance.sampleSize,
    champion_model_key: promotion.championKey,
    challenger_model_key: promotion.challengerKey,
    promotion_action: promotion.action,
    performance: control.performance,
    provider_health: control.provider,
    model_lab: modelLab || {},
    control_plane: control,
    captured_at: now.toISOString()
  }).select("id").single();
  if (snapshotError) throw snapshotError;

  const challenger = modelLab?.challenger;
  if (challenger?.id) {
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
      const { error: retireError } = await admin.from("autonomous_agent_models")
        .update({ status: "retired", retired_at: now.toISOString() })
        .eq("user_id", userId).eq("status", "champion").neq("model_key", challenger.id);
      if (retireError) throw retireError;
    }
  }
  return snapshot.id;
}

async function syncIncidents(admin, userId, incidents, now) {
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

async function finishRun(admin, runId, result, summary, control, learningSnapshotId, incidentCount, now) {
  const { error } = await admin.from("autonomous_agent_runs").update({
    status: result.status,
    candidate_count: result.candidateCount,
    selected_count: result.selectedCount,
    saved_count: result.savedCount,
    skipped_count: result.skippedCount,
    total_stake: result.totalStake,
    operating_mode: control.operatingMode,
    health_score: control.healthScore,
    learning_snapshot: { id: learningSnapshotId, model: control.modelLab, performance: control.performance, provider: control.provider },
    incident_count: incidentCount,
    summary,
    error: result.error,
    completed_at: now.toISOString()
  }).eq("id", runId);
  if (error) throw error;
}

async function completeUser(admin, userId, result, control) {
  const promotion = control.modelLab.promotion;
  const { error } = await admin.rpc("complete_autonomous_agent_user_v12", {
    p_user_id: userId,
    p_status: result.status,
    p_run_id: result.runId || null,
    p_candidate_count: result.candidateCount || 0,
    p_selected_count: result.selectedCount || 0,
    p_saved_count: result.savedCount || 0,
    p_skipped_count: result.skippedCount || 0,
    p_total_stake: result.totalStake || 0,
    p_error: result.error || null,
    p_operating_mode: control.operatingMode,
    p_health_score: control.healthScore,
    p_kill_switch_active: control.killSwitch.active,
    p_kill_switch_reason: control.killSwitch.reason,
    p_next_check_minutes: control.riskPolicy.nextCheckMinutes,
    p_champion_model_key: promotion.championKey,
    p_challenger_model_key: promotion.challengerKey,
    p_promotion_ready_streak: promotion.readyStreak
  });
  if (error) throw error;
}

async function processUser(admin, entry, source, providerContext, now, globalBudget) {
  const runId = await createRun(admin, entry.userId, entry.context.settings.sports, now);
  try {
    const modelLab = buildSelfLearningReport(entry.context.history);
    const control = buildAutonomousControlPlane({
      history: entry.context.history,
      bankroll: entry.context.bankroll.bankroll,
      modelLab,
      providerObservations: providerContext.observations,
      providerIncidents: providerContext.incidents,
      settings: entry.context.settings,
      previousState: entry.context.state
    });
    const learning = calculateAgentPerformance(entry.context.history);
    const portfolio = buildAgentV9Portfolio(source.picks, {
      bankroll: entry.context.bankroll.bankroll,
      maxStakePercent: entry.context.bankroll.maxStakePercent,
      maxTotalExposurePercent: entry.context.bankroll.maxTotalExposurePercent,
      maxLeagueExposurePercent: entry.context.bankroll.maxLeagueExposurePercent,
      learning
    });
    const modelGoverned = applyModelLabSafety(portfolio.decisions, modelLab);
    const autonomouslyGoverned = applyAutonomousControl(modelGoverned, control);
    const choice = chooseDecisions(autonomouslyGoverned, entry.context, control);
    const selected = choice.selected.slice(0, Math.max(0, globalBudget));
    const audit = [];
    let savedCount = 0;
    let duplicateCount = 0;
    let riskRejectedCount = 0;
    let saveErrorCount = 0;
    let totalStake = 0;

    for (const decision of selected) {
      const saved = await saveDecision(admin, paperRow(entry.userId, runId, decision, source.source, source.fixtureSource, now, control));
      if (saved.saved) { savedCount += 1; totalStake += decision.autonomousStake; }
      else if (saved.duplicate) duplicateCount += 1;
      else if (saved.riskRejected) riskRejectedCount += 1;
      else saveErrorCount += 1;
      audit.push({ eventId: eventId(decision), match: match(decision), selection: selection(decision), odds: round(decision.odds, 4), stake: round(decision.autonomousStake, 2), saved: saved.saved, reason: saved.saved ? null : saved.duplicate ? "duplicate_daily_decision" : saved.riskRejected ? "database_risk_limit" : "save_failed" });
    }

    const result = {
      status: saveErrorCount ? "error" : "success",
      runId,
      candidateCount: autonomouslyGoverned.length,
      selectedCount: selected.length,
      savedCount,
      skippedCount: choice.skipped.length + duplicateCount + riskRejectedCount + Math.max(0, choice.selected.length - selected.length),
      totalStake: round(totalStake, 2),
      error: saveErrorCount ? `${saveErrorCount} autonomous paper decisions could not be saved` : null
    };
    const incidents = buildAutonomousIncidents(control);
    const learningSnapshotId = await persistLearning(admin, entry.userId, control, modelLab, now);
    const incidentCount = await syncIncidents(admin, entry.userId, incidents, now);
    const summary = {
      paperOnly: true,
      realMoneyBetting: false,
      agentVersion: "Autonomous-Intelligence-V12",
      source: source.source,
      fixtureSource: source.fixtureSource,
      operatingMode: control.operatingMode,
      healthScore: control.healthScore,
      killSwitch: control.killSwitch,
      riskPolicy: control.riskPolicy,
      modelPromotion: control.modelLab.promotion,
      providerHealth: control.provider,
      performance: control.performance,
      duplicateCount,
      riskRejectedCount,
      decisions: audit
    };
    await finishRun(admin, runId, result, summary, control, learningSnapshotId, incidentCount, now);
    await completeUser(admin, entry.userId, result, control);
    return { ...result, operatingMode: control.operatingMode, healthScore: control.healthScore, incidentCount, promotionAction: control.modelLab.promotion.action };
  } catch (error) {
    const fallbackControl = buildAutonomousControlPlane({ history: entry.context.history, bankroll: entry.context.bankroll.bankroll, settings: entry.context.settings, previousState: entry.context.state });
    fallbackControl.operatingMode = "frozen";
    fallbackControl.healthScore = 0;
    fallbackControl.killSwitch = { active: true, reason: "worker_processing_error", blockers: ["worker_processing_error"], warnings: [], automaticRecoveryAllowed: true };
    fallbackControl.riskPolicy = { ...fallbackControl.riskPolicy, stakeMultiplier: 0, maximumPicks: 0, nextCheckMinutes: 60 };
    const failure = { status: "error", runId, candidateCount: 0, selectedCount: 0, savedCount: 0, skippedCount: 0, totalStake: 0, error: clean(error?.message, 500, "Autonomous Intelligence V12 processing failed") };
    try { await finishRun(admin, runId, failure, { paperOnly: true, agentVersion: "Autonomous-Intelligence-V12", failureStage: "user_processing" }, fallbackControl, null, 1, now); } catch {}
    try { await syncIncidents(admin, entry.userId, buildAutonomousIncidents(fallbackControl), now); } catch {}
    await completeUser(admin, entry.userId, failure, fallbackControl);
    return { ...failure, operatingMode: "frozen", healthScore: 0, incidentCount: 1, promotionAction: "KEEP_CHALLENGER_SHADOW" };
  }
}

export async function runAutonomousIntelligenceV12({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Intelligence V12 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Intelligence V12 requires a request origin");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Autonomous Intelligence V12 requires a valid clock value");

  if (!(await v12MigrationReady(admin))) {
    const fallback = await runAutonomousPaperAgent({ admin, origin, now: startedAt });
    return { ...fallback, fallbackVersion: fallback.version, version: "autonomous-intelligence-v12-fallback-v1", v12MigrationActive: false, warning: "Autonomous Intelligence V12 migration is not active; V1 paper automation completed safely." };
  }

  const [userIds, providerContext] = await Promise.all([claimUsers(admin), loadProviderContext(admin)]);
  const entries = [];
  const deferred = [];
  for (const userId of userIds) {
    try {
      const context = await loadUserContext(admin, userId);
      if (!context.settings.enabled) deferred.push({ userId, reason: "Autonomous Agent disabled" });
      else if (!context.bankroll.paperTradingMode || context.bankroll.bankroll <= 0) deferred.push({ userId, reason: "Virtual bankroll or paper mode inactive" });
      else if (context.openBets.length > MAX_OPEN_BETS_PER_USER) deferred.push({ userId, reason: "Open paper bet limit exceeded" });
      else entries.push({ userId, context, sourceKey: sourceGroupKey(context.settings.sports) });
    } catch (error) {
      deferred.push({ userId, reason: clean(error?.message, 300, "User context unavailable") });
    }
  }

  const allowedGroups = new Set([...new Set(entries.map((entry) => entry.sourceKey))].slice(0, MAX_SOURCE_GROUPS_PER_RUN));
  const selectedEntries = entries.filter((entry) => allowedGroups.has(entry.sourceKey));
  deferred.push(...entries.filter((entry) => !allowedGroups.has(entry.sourceKey)).map((entry) => ({ userId: entry.userId, reason: "Deferred by source-group budget" })));

  const sources = new Map();
  const failures = new Map();
  for (const entry of selectedEntries) {
    if (sources.has(entry.sourceKey) || failures.has(entry.sourceKey)) continue;
    try { sources.set(entry.sourceKey, await loadTopPicks(origin, entry.context.settings.sports)); }
    catch (error) { failures.set(entry.sourceKey, error); }
  }

  const results = [];
  let remainingGlobalBudget = MAX_SAVED_PICKS_PER_RUN;
  for (const entry of selectedEntries) {
    if (failures.has(entry.sourceKey)) {
      const control = buildAutonomousControlPlane({ history: entry.context.history, bankroll: entry.context.bankroll.bankroll, settings: entry.context.settings, previousState: entry.context.state });
      control.operatingMode = "frozen";
      control.healthScore = 0;
      control.killSwitch = { active: true, reason: "source_loading_error", blockers: ["source_loading_error"], warnings: [], automaticRecoveryAllowed: true };
      control.riskPolicy = { ...control.riskPolicy, stakeMultiplier: 0, maximumPicks: 0, nextCheckMinutes: 60 };
      const result = { status: "error", runId: null, candidateCount: 0, selectedCount: 0, savedCount: 0, skippedCount: 0, totalStake: 0, error: clean(failures.get(entry.sourceKey)?.message, 500, "Source loading failed") };
      try { await syncIncidents(admin, entry.userId, buildAutonomousIncidents(control), startedAt); await completeUser(admin, entry.userId, result, control); } catch {}
      results.push({ userId: entry.userId, ...result, operatingMode: "frozen", healthScore: 0, incidentCount: 1 });
      continue;
    }
    const result = await processUser(admin, entry, sources.get(entry.sourceKey), providerContext, startedAt, remainingGlobalBudget);
    remainingGlobalBudget = Math.max(0, remainingGlobalBudget - result.savedCount);
    results.push({ userId: entry.userId, ...result });
  }

  return {
    ok: true,
    version: "autonomous-intelligence-v12",
    v12MigrationActive: true,
    paperOnly: true,
    realMoneyBetting: false,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    deferredUsers: deferred.length,
    activeUsers: results.filter((row) => row.operatingMode === "active").length,
    cautiousUsers: results.filter((row) => ["cautious", "recovery", "learning"].includes(row.operatingMode)).length,
    frozenUsers: results.filter((row) => row.operatingMode === "frozen").length,
    candidates: results.reduce((sum, row) => sum + row.candidateCount, 0),
    selected: results.reduce((sum, row) => sum + row.selectedCount, 0),
    savedPaperPicks: results.reduce((sum, row) => sum + row.savedCount, 0),
    skipped: results.reduce((sum, row) => sum + row.skippedCount, 0),
    totalVirtualStake: round(results.reduce((sum, row) => sum + row.totalStake, 0), 2),
    incidents: results.reduce((sum, row) => sum + finite(row.incidentCount), 0),
    promotions: results.filter((row) => row.promotionAction === "PROMOTE_PAPER_CHAMPION").length,
    providerHealthSamples: providerContext.observations.length,
    limits: { usersPerRun: MAX_USERS_PER_RUN, sportsPerUser: MAX_SPORTS_PER_USER, picksPerUser: MAX_PICKS_PER_USER, savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN, openBetsPerUser: MAX_OPEN_BETS_PER_USER },
    generatedAt: startedAt.toISOString()
  };
}
