import { createHash } from "node:crypto";
import { calculateAgentPerformance } from "./agent-learning.js";
import { applyModelLabSafety } from "./agent-model-governance.mjs";
import { buildSelfLearningReport } from "./agent-self-learning.mjs";
import { buildAgentV9Portfolio } from "./agent-v9-engine.mjs";
import { normalizeAgentRiskProfile } from "./agent-risk-profile-v1.mjs";
import {
  mergeAutonomousMarketCandidates,
  scanAutonomousMarketUniverse
} from "./autonomous-market-scanner-v1.mjs";
import {
  adaptiveNextCheckMinutes,
  buildAutonomousDailyBrief,
  buildPerformanceGuard,
  buildSystemGuard,
  evaluateAutonomousCandidate,
  normalizeAutonomousV2Settings
} from "./autonomous-agent-v2.mjs";
import { SPORTS } from "./sports.js";
import { GET as getTopPicks } from "../app/api/top-picks/route.js";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const MAX_USERS_PER_RUN = 10;
const MAX_SPORTS_PER_USER = 6;
const MAX_SOURCE_GROUPS_PER_RUN = 6;
const MAX_PICKS_PER_USER = 3;
const MAX_SAVED_PICKS_PER_RUN = 30;
const MAX_HISTORY_PER_USER = 750;
const MAX_OPEN_BETS_PER_USER = 200;
const MAX_AUDIT_ROWS_PER_USER = 100;

function text(value, maximum = 500, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function normalized(value) {
  return text(value, 240).toLowerCase().replace(/\s+/g, " ");
}

function missingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function pickEventId(pick = {}) {
  return text(pick.eventId || pick.event_id || pick.gameId || pick.game_id || pick.id, 180);
}

function pickSelection(pick = {}) {
  return text(pick.selection || pick.label || pick.pick, 160);
}

function pickMatch(pick = {}) {
  return text(
    pick.match || [pick.homeTeam || pick.home_team, pick.awayTeam || pick.away_team].filter(Boolean).join(" vs "),
    240
  );
}

function pickLeague(pick = {}) {
  return text(pick.league || pick.leagueTitle || pick.sportKey || pick.sport, 120, "unknown");
}

function pickSport(pick = {}) {
  return text(pick.sportKey || pick.sport || pick.league, 120, "unknown");
}

function eventIdentity(pick = {}) {
  return normalized(pickEventId(pick) || pickMatch(pick));
}

function leagueIdentity(pick = {}) {
  return normalized(pickLeague(pick) || pickSport(pick) || "unknown");
}

function historyRow(row = {}) {
  const result = row.status === "won"
    ? "win"
    : row.status === "lost"
      ? "loss"
      : row.status === "push" || row.status === "void"
        ? "push"
        : "pending";
  return {
    id: row.id,
    result,
    createdAt: row.created_at,
    stake: finite(row.stake),
    odds: finite(row.odds),
    closingOdds: row.closing_odds === null ? null : finite(row.closing_odds),
    sportKey: row.sport || row.league || "unknown",
    league: row.league || row.sport || "unknown",
    marketKey: row.market || "h2h",
    modelProbability: row.raw_pick?.modelProbability ?? null
  };
}

function normalizeSettings(row = {}) {
  const sports = Array.isArray(row.sports)
    ? [...new Set(row.sports.map((value) => text(value, 120)).filter((value) => SUPPORTED_SPORTS.has(value)))]
      .sort()
      .slice(0, MAX_SPORTS_PER_USER)
    : [];
  return {
    enabled: row.enabled === true,
    sports,
    riskProfile: normalizeAgentRiskProfile(row.risk_profile),
    dailyPickLimit: Math.max(1, Math.min(MAX_PICKS_PER_USER, Math.trunc(finite(row.daily_pick_limit, 3)))),
    minPriorityScore: Math.max(0.5, Math.min(1, finite(row.min_priority_score, 0.62))),
    minOdds: Math.max(1.01, Math.min(20, finite(row.min_odds, 1.2))),
    maxOdds: Math.max(1.01, Math.min(20, finite(row.max_odds, 5))),
    ...normalizeAutonomousV2Settings(row)
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

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_autonomous_agent_users", { p_limit: MAX_USERS_PER_RUN });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadUserContext(admin, userId, now) {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const [settingsResult, bankrollResult, openResult, historyResult, todayResult] = await Promise.all([
    admin.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,risk_profile")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bets")
      .select("id,stake,league,sport,match,status,raw_pick")
      .eq("user_id", userId).eq("status", "open")
      .order("created_at", { ascending: true }).limit(MAX_OPEN_BETS_PER_USER + 1),
    admin.from("bets")
      .select("id,status,created_at,stake,odds,closing_odds,sport,league,market,raw_pick")
      .eq("user_id", userId).neq("status", "open")
      .order("created_at", { ascending: false }).limit(MAX_HISTORY_PER_USER),
    admin.from("bets")
      .select("id,raw_pick,created_at")
      .eq("user_id", userId)
      .gte("created_at", dayStart.toISOString())
      .order("created_at", { ascending: false }).limit(250)
  ]);
  const error = settingsResult.error || bankrollResult.error || openResult.error || historyResult.error || todayResult.error;
  if (error) throw error;
  const todayAutonomousCount = (todayResult.data || []).filter((row) => String(row.raw_pick?.source || "").startsWith("scorecaster-autonomous-v2")).length;
  return {
    settings: normalizeSettings(settingsResult.data || {}),
    bankroll: normalizeBankroll(bankrollResult.data || {}),
    openBets: openResult.data || [],
    history: (historyResult.data || []).map(historyRow),
    todayAutonomousCount
  };
}

async function safeRows(query) {
  const { data, error } = await query;
  if (error && missingTable(error)) return [];
  if (error) throw error;
  return data || [];
}

async function loadSystemSafety(admin) {
  const [decisionAlerts, unifiedIncidents, diagnosticsRows] = await Promise.all([
    safeRows(admin.from("decision_diagnostic_alerts")
      .select("alert_type,severity,title,message,active,last_seen_at")
      .eq("active", true).order("last_seen_at", { ascending: false }).limit(30)),
    safeRows(admin.from("unified_data_incidents")
      .select("incident_type,severity,title,message,event_id,provider_key,details,active,last_seen_at")
      .eq("active", true).order("last_seen_at", { ascending: false }).limit(30)),
    safeRows(admin.from("decision_diagnostic_snapshots")
      .select("status,provider_health,captured_at")
      .order("captured_at", { ascending: false }).limit(1))
  ]);
  return { decisionAlerts, unifiedIncidents, diagnostics: diagnosticsRows[0] || null };
}

async function completeUser(admin, userId, result, performance, brief, pauseReason = null) {
  const pauseMinutes = result.status === "paused"
    ? Math.max(60, Math.trunc(finite(performance.cooldownHours, 12) * 60))
    : 0;
  const { error } = await admin.rpc("complete_autonomous_agent_user_v2", {
    p_user_id: userId,
    p_status: result.status,
    p_run_id: result.runId || null,
    p_candidate_count: result.candidateCount || 0,
    p_selected_count: result.selectedCount || 0,
    p_saved_count: result.savedCount || 0,
    p_skipped_count: result.skippedCount || 0,
    p_total_stake: result.totalStake || 0,
    p_error: result.error ? text(result.error, 500) : null,
    p_next_check_minutes: result.nextCheckMinutes || 180,
    p_health_status: result.healthStatus || performance.status || "learning",
    p_health_score: result.healthScore ?? performance.score ?? 50,
    p_resolved_sample: performance.resolvedSample || 0,
    p_consecutive_losses: performance.consecutiveLosses || 0,
    p_drawdown_percent: round(finite(performance.drawdown) * 100, 4) || 0,
    p_roi: performance.roi,
    p_average_clv: performance.clv?.average ?? null,
    p_pause_minutes: pauseMinutes,
    p_pause_reason: pauseReason,
    p_last_brief: brief || {}
  });
  if (error) throw error;
}

async function createRun(admin, userId, sports, now) {
  const { data, error } = await admin.from("autonomous_agent_runs")
    .insert({ user_id: userId, status: "running", sports, started_at: now.toISOString(), health_status: "learning", health_score: 50 })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishRun(admin, runId, result, summary, completedAt = new Date()) {
  const { error } = await admin.from("autonomous_agent_runs")
    .update({
      status: result.status,
      candidate_count: result.candidateCount || 0,
      selected_count: result.selectedCount || 0,
      saved_count: result.savedCount || 0,
      skipped_count: result.skippedCount || 0,
      total_stake: result.totalStake || 0,
      summary,
      guard_summary: summary?.guards || {},
      health_status: result.healthStatus || null,
      health_score: result.healthScore ?? null,
      next_check_minutes: result.nextCheckMinutes || null,
      error: result.error ? text(result.error, 500) : null,
      completed_at: completedAt.toISOString()
    })
    .eq("id", runId);
  if (error) throw error;
}

async function saveBrief(admin, userId, brief, now) {
  const briefDate = now.toISOString().slice(0, 10);
  const { error } = await admin.from("autonomous_agent_daily_briefs")
    .upsert({ user_id: userId, brief_date: briefDate, brief }, { onConflict: "user_id,brief_date" });
  if (error) throw error;
}

async function loadTopPicks(origin, sports, now = new Date()) {
  const target = new URL("/api/top-picks", origin);
  if (sports.length) target.searchParams.set("sports", sports.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Autonomous Agent source data could not be loaded");

  const basePicks = Array.isArray(payload?.data) ? payload.data : [];
  let marketScanner = {
    version: "autonomous-market-scanner-v1",
    enabled: true,
    due: false,
    scanned: false,
    candidates: 0,
    providerFailures: 0,
    paperOnly: true,
    probabilityChangedByScanner: false
  };
  let advancedPicks = [];
  try {
    const scan = await scanAutonomousMarketUniverse({ picks: basePicks, origin, now });
    advancedPicks = scan.candidates;
    marketScanner = scan.diagnostics;
  } catch {
    marketScanner = {
      ...marketScanner,
      due: true,
      providerFailures: 1,
      failureMode: "h2h-fallback"
    };
  }

  return {
    picks: mergeAutonomousMarketCandidates(basePicks, advancedPicks),
    basePickCount: basePicks.length,
    advancedPickCount: advancedPicks.length,
    source: advancedPicks.length
      ? `${text(payload?.source, 100, "no-vig-market-consensus")}+market-universe-v1`
      : text(payload?.source, 100, "no-vig-market-consensus"),
    fixtureSource: text(payload?.fixtureSource, 100, "live-odds-provider-only"),
    marketScanner
  };
}

function sourceGroupKey(sports) {
  return sports.length ? sports.join(",") : "__default__";
}

function existingExposure(openBets, bankroll) {
  const league = new Map();
  let total = 0;
  const events = new Set();
  for (const row of openBets) {
    const stake = Math.max(0, finite(row.stake));
    total += stake;
    const key = normalized(row.league || row.sport || "unknown");
    league.set(key, (league.get(key) || 0) + stake);
    const event = normalized(row.raw_pick?.eventId || row.match);
    if (event) events.add(event);
  }
  return {
    total,
    league,
    events,
    totalCap: bankroll.bankroll * bankroll.maxTotalExposurePercent / 100,
    leagueCap: bankroll.bankroll * bankroll.maxLeagueExposurePercent / 100,
    singleCap: bankroll.bankroll * bankroll.maxStakePercent / 100
  };
}

function allocateSelections(audited, context, performance, globalBudget) {
  const exposure = existingExposure(context.openBets, context.bankroll);
  const selected = [];
  const dailyRemaining = Math.max(0, context.settings.dailyPickLimit - context.todayAutonomousCount);
  const pickLimit = Math.min(dailyRemaining, MAX_PICKS_PER_USER, Math.max(0, globalBudget));
  let remainingTotal = Math.max(0, exposure.totalCap - exposure.total);
  const leagueUsed = new Map(exposure.league);
  const ordered = audited
    .filter((item) => item.audit.allowed)
    .sort((left, right) => finite(right.audit.qualityScore) - finite(left.audit.qualityScore) || finite(right.decision.priorityScore) - finite(left.decision.priorityScore));

  for (const item of ordered) {
    if (selected.length >= pickLimit) break;
    const decision = item.decision;
    const league = leagueIdentity(decision);
    const leagueExposure = leagueUsed.get(league) || 0;
    const remainingLeague = Math.max(0, exposure.leagueCap - leagueExposure);
    const requested = Math.max(0, finite(decision.allocatedStake ?? decision.suggestedStake));
    const stake = round(Math.min(
      requested * Math.max(0, finite(performance.stakeMultiplier, 0.5)),
      exposure.singleCap,
      remainingTotal,
      remainingLeague
    ), 2);
    if (stake < 0.01) {
      item.audit.allowed = false;
      item.audit.reasons.push(remainingTotal < 0.01 ? "total_exposure_full" : "league_exposure_full");
      continue;
    }
    selected.push({ ...decision, autonomousStake: stake, autonomousAudit: item.audit });
    remainingTotal = Math.max(0, remainingTotal - stake);
    leagueUsed.set(league, leagueExposure + stake);
  }
  return { selected, exposure, dailyRemaining, pickLimit };
}

function clientRef(userId, decision, now) {
  const day = now.toISOString().slice(0, 10);
  const key = [userId, day, pickEventId(decision) || pickMatch(decision), pickSelection(decision)].join("|");
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `autonomous-v2-${day}-${digest}`;
}

function paperRow(userId, runId, decision, source, fixtureSource, now, performance, system) {
  const odds = finite(decision.odds);
  const eventId = pickEventId(decision);
  return {
    user_id: userId,
    client_ref: clientRef(userId, decision, now),
    label: pickSelection(decision),
    match: pickMatch(decision),
    market: text(decision.marketKey || decision.market, 80, "h2h"),
    bookmaker: text(decision.bookmaker, 120, "verified-market"),
    sport: pickSport(decision),
    league: pickLeague(decision),
    home_team: text(decision.homeTeam || decision.home_team, 160),
    away_team: text(decision.awayTeam || decision.away_team, 160),
    odds,
    stake: decision.autonomousStake,
    edge: finite(decision.edge),
    ev: finite(decision.ev),
    confidence: finite(decision.confidence),
    status: "open",
    raw_pick: {
      source: "scorecaster-autonomous-v2",
      eventId,
      modelProbability: decision.stressTest?.probability ?? decision.consensusProbability ?? decision.modelProbability ?? null,
      impliedProbability: odds > 1 ? 1 / odds : null,
      decision: "PLAY",
      qualityGrade: text(decision.qualityGrade, 8),
      qualityScore: decision.qualityScore ?? null,
      agentVersion: "Autonomous-Paper-Agent-V2",
      portfolioAgentVersion: decision.agentVersion || "V11-model-lab-shadow",
      priorityScore: round(decision.priorityScore, 6),
      robustnessScore: round(decision.robustnessScore, 6),
      riskProfile: decision.riskProfile,
      riskPolicy: decision.riskPolicy || null,
      probabilityChangedByRisk: false,
      minimumPlayOdds: decision.priceGuard?.minimumPlayOdds ?? null,
      autonomousRunId: runId,
      autonomousAudit: decision.autonomousAudit,
      performanceGuard: {
        status: performance.status,
        score: performance.score,
        resolvedSample: performance.resolvedSample,
        roi: performance.roi,
        averageClv: performance.clv?.average ?? null,
        stakeMultiplier: performance.stakeMultiplier
      },
      systemGuard: {
        status: system.status,
        activeIncidentCount: system.activeIncidentCount,
        blockingIncidentCount: system.blockingIncidentCount
      },
      unifiedData: decision.unifiedSportsData || null,
      providerSource: source,
      fixtureSource,
      generatedAt: now.toISOString(),
      learningMode: "shadow-only",
      productionProbabilityChangedByLearning: false,
      paperOnly: true,
      realMoneyBetting: false
    }
  };
}

async function saveDecision(admin, row) {
  const { data, error } = await admin.from("bets")
    .upsert(row, { onConflict: "user_id,client_ref", ignoreDuplicates: true })
    .select("id,client_ref,stake")
    .maybeSingle();
  if (error) return { saved: false, duplicate: false, riskRejected: error.code === "23514", error };
  if (!data) return { saved: false, duplicate: true, riskRejected: false, error: null };
  return { saved: true, duplicate: false, riskRejected: false, error: null, data };
}

function auditRow(userId, runId, decision, audit, proposedStake = 0, savedBetId = null) {
  return {
    user_id: userId,
    run_id: runId,
    event_id: pickEventId(decision) || null,
    match: pickMatch(decision),
    selection: pickSelection(decision),
    sport: pickSport(decision),
    league: pickLeague(decision),
    allowed: audit.allowed === true,
    reasons: audit.reasons || [],
    warnings: audit.warnings || [],
    quality_score: audit.qualityScore,
    priority_score: round(decision.priorityScore, 6),
    odds: round(decision.odds, 4),
    edge: round(decision.edge, 6),
    confidence: round(decision.confidence, 6),
    data_coverage: audit.data?.coverage ?? null,
    provider_count: audit.data?.providerCount ?? null,
    provider_disagreement: audit.data?.providerDisagreement ?? null,
    context_impact: audit.data?.contextImpact ?? null,
    minutes_before_start: audit.data?.minutesBeforeStart ?? null,
    risk_profile: decision.riskProfile,
    risk_policy: decision.riskPolicy || {},
    proposed_stake: round(proposedStake, 2) || 0,
    saved_bet_id: savedBetId
  };
}

async function saveAuditRows(admin, rows) {
  if (!rows.length) return;
  const { error } = await admin.from("autonomous_agent_decision_audit").insert(rows.slice(0, MAX_AUDIT_ROWS_PER_USER));
  if (error) throw error;
}

async function processUser(admin, entry, source, globalSafety, now, globalBudget) {
  let runId = null;
  let performance = buildPerformanceGuard({ history: entry.context.history, bankroll: entry.context.bankroll.bankroll, settings: entry.context.settings, now: now.getTime() });
  let system = buildSystemGuard({ ...globalSafety, settings: entry.context.settings });
  try {
    runId = await createRun(admin, entry.userId, entry.context.settings.sports, now);
    const modelLab = buildSelfLearningReport(entry.context.history);
    const learning = calculateAgentPerformance(entry.context.history);
    const portfolio = buildAgentV9Portfolio(source.picks, {
      bankroll: entry.context.bankroll.bankroll,
      maxStakePercent: entry.context.bankroll.maxStakePercent,
      maxTotalExposurePercent: entry.context.bankroll.maxTotalExposurePercent,
      maxLeagueExposurePercent: entry.context.bankroll.maxLeagueExposurePercent,
      riskProfile: entry.context.settings.riskProfile,
      learning
    });
    const riskBoundedContext = {
      ...entry.context,
      bankroll: {
        ...entry.context.bankroll,
        maxStakePercent: portfolio.effectiveLimits.maxStakePercent,
        maxTotalExposurePercent: portfolio.effectiveLimits.maxTotalExposurePercent,
        maxLeagueExposurePercent: portfolio.effectiveLimits.maxLeagueExposurePercent
      }
    };
    const governed = applyModelLabSafety(portfolio.decisions, modelLab);
    const exposure = existingExposure(riskBoundedContext.openBets, riskBoundedContext.bankroll);
    const openEventIds = new Set(exposure.events);
    if (entry.context.openBets.length >= entry.context.settings.maxOpenPicks) {
      system = { ...system, status: "blocked", reasons: [...(system.reasons || []), "maximum_open_picks_reached"], score: 0 };
    }
    if (modelLab?.drift?.status === "critical" || modelLab?.status === "frozen") {
      system = { ...system, status: "blocked", reasons: [...(system.reasons || []), "critical_model_drift"], score: 0 };
    }

    const audited = governed.map((decision) => ({
      decision,
      audit: evaluateAutonomousCandidate(decision, {
        settings: entry.context.settings,
        bankroll: riskBoundedContext.bankroll,
        performance,
        system,
        openEventIds,
        now: now.getTime()
      })
    }));
    const allocation = allocateSelections(audited, riskBoundedContext, performance, globalBudget);
    const selected = allocation.selected;
    const saveByKey = new Map();
    let savedCount = 0;
    let duplicateCount = 0;
    let riskRejectedCount = 0;
    let saveErrorCount = 0;
    let totalStake = 0;

    for (const decision of selected) {
      const saveResult = await saveDecision(admin, paperRow(entry.userId, runId, decision, source.source, source.fixtureSource, now, performance, system));
      const key = `${eventIdentity(decision)}|${normalized(pickSelection(decision))}`;
      if (saveResult.saved) {
        savedCount += 1;
        totalStake += decision.autonomousStake;
        saveByKey.set(key, { savedBetId: saveResult.data.id, stake: decision.autonomousStake });
      } else if (saveResult.duplicate) {
        duplicateCount += 1;
        decision.autonomousAudit.allowed = false;
        decision.autonomousAudit.reasons.push("duplicate_daily_decision");
      } else if (saveResult.riskRejected) {
        riskRejectedCount += 1;
        decision.autonomousAudit.allowed = false;
        decision.autonomousAudit.reasons.push("database_risk_limit");
      } else {
        saveErrorCount += 1;
        decision.autonomousAudit.allowed = false;
        decision.autonomousAudit.reasons.push("save_failed");
      }
    }

    const auditRows = audited.map(({ decision, audit }) => {
      const key = `${eventIdentity(decision)}|${normalized(pickSelection(decision))}`;
      const saved = saveByKey.get(key);
      return auditRow(entry.userId, runId, decision, audit, saved?.stake || 0, saved?.savedBetId || null);
    });
    await saveAuditRows(admin, auditRows);

    const paused = system.status === "blocked" || performance.status === "paused";
    const provisional = {
      status: paused ? "paused" : saveErrorCount ? "error" : "success",
      runId,
      candidateCount: governed.length,
      selectedCount: selected.length,
      savedCount,
      skippedCount: Math.max(0, governed.length - savedCount) + duplicateCount + riskRejectedCount,
      totalStake: round(totalStake, 2),
      error: saveErrorCount ? `${saveErrorCount} autonomous paper decisions could not be saved` : null,
      healthStatus: paused ? "paused" : performance.status,
      healthScore: paused ? 0 : performance.score
    };
    provisional.nextCheckMinutes = adaptiveNextCheckMinutes({ result: provisional, settings: entry.context.settings, system, performance });
    const brief = buildAutonomousDailyBrief({ performance, system, result: provisional, audits: audited.map((item) => item.audit), generatedAt: now.toISOString() });
    const summary = {
      paperOnly: true,
      agentVersion: "Autonomous-Paper-Agent-V2",
      riskProfile: portfolio.riskProfile,
      riskPolicy: portfolio.riskPolicy,
      effectiveRiskLimits: portfolio.effectiveLimits,
      probabilityChangedByRisk: false,
      source: source.source,
      fixtureSource: source.fixtureSource,
      marketScanner: source.marketScanner || null,
      basePickCount: source.basePickCount ?? source.picks.length,
      advancedPickCount: source.advancedPickCount || 0,
      probabilityChangedByScanner: false,
      modelLabStatus: modelLab?.status || null,
      shadowLearningEnabled: entry.context.settings.shadowLearningEnabled,
      productionLearningApplied: false,
      openExposureBefore: round(allocation.exposure.total, 2),
      openExposureCap: round(allocation.exposure.totalCap, 2),
      dailyRemainingBeforeCycle: allocation.dailyRemaining,
      duplicateCount,
      riskRejectedCount,
      guards: { performance, system },
      brief,
      auditSummary: {
        total: auditRows.length,
        allowed: auditRows.filter((row) => row.allowed).length,
        blocked: auditRows.filter((row) => !row.allowed).length
      }
    };
    await finishRun(admin, runId, provisional, summary, now);
    await saveBrief(admin, entry.userId, brief, now);
    const pauseReason = paused ? [...(system.reasons || []), ...(performance.reasons || [])].join(", ") : null;
    await completeUser(admin, entry.userId, provisional, performance, brief, pauseReason);
    return provisional;
  } catch (error) {
    const failure = {
      status: "error",
      runId,
      candidateCount: 0,
      selectedCount: 0,
      savedCount: 0,
      skippedCount: 0,
      totalStake: 0,
      error: text(error?.message, 500, "Autonomous Agent V2 processing failed"),
      nextCheckMinutes: 60,
      healthStatus: performance.status || "watch",
      healthScore: performance.score ?? 25
    };
    const brief = buildAutonomousDailyBrief({ performance, system, result: failure, audits: [], generatedAt: now.toISOString() });
    if (runId) {
      try {
        await finishRun(admin, runId, failure, {
          paperOnly: true,
          agentVersion: "Autonomous-Paper-Agent-V2",
          failureStage: "user_processing",
          guards: { performance, system },
          brief
        }, now);
      } catch {
        // State completion remains the authoritative retry signal.
      }
    }
    await completeUser(admin, entry.userId, failure, performance, brief);
    return failure;
  }
}

async function recordSourceFailure(admin, entry, error, now) {
  const performance = buildPerformanceGuard({ history: entry.context.history, bankroll: entry.context.bankroll.bankroll, settings: entry.context.settings, now: now.getTime() });
  const system = { status: "blocked", score: 0, reasons: ["source_loading_failed"], activeIncidentCount: 0, blockingIncidentCount: 1 };
  const failure = {
    status: "error",
    runId: null,
    candidateCount: 0,
    selectedCount: 0,
    savedCount: 0,
    skippedCount: 0,
    totalStake: 0,
    error: text(error?.message, 500, "Autonomous Agent source data could not be loaded"),
    nextCheckMinutes: 60,
    healthStatus: "blocked",
    healthScore: 0
  };
  const brief = buildAutonomousDailyBrief({ performance, system, result: failure, audits: [], generatedAt: now.toISOString() });
  try {
    const runId = await createRun(admin, entry.userId, entry.context.settings.sports, now);
    failure.runId = runId;
    await finishRun(admin, runId, failure, {
      paperOnly: true,
      agentVersion: "Autonomous-Paper-Agent-V2",
      failureStage: "source_loading",
      sourceGroup: entry.sourceKey,
      guards: { performance, system },
      brief
    }, now);
  } catch {
    // State completion below records the bounded error and retry interval.
  }
  await completeUser(admin, entry.userId, failure, performance, brief);
  return failure;
}

export async function runAutonomousPaperAgentV2({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Paper Agent V2 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Paper Agent V2 requires a request origin");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Autonomous Paper Agent V2 requires a valid clock value");

  const [userIds, globalSafety] = await Promise.all([claimUsers(admin), loadSystemSafety(admin)]);
  const entries = [];
  const deferred = [];
  for (const userId of userIds) {
    try {
      const context = await loadUserContext(admin, userId, startedAt);
      if (!context.settings.enabled) deferred.push({ userId, context, reason: "Autonomous Agent is no longer enabled" });
      else if (!context.bankroll.paperTradingMode || context.bankroll.bankroll <= 0) deferred.push({ userId, context, reason: "Virtual bankroll or paper trading mode is not active" });
      else if (context.openBets.length > MAX_OPEN_BETS_PER_USER) deferred.push({ userId, context, reason: `Open paper bet limit exceeds ${MAX_OPEN_BETS_PER_USER}` });
      else entries.push({ userId, context, sourceKey: sourceGroupKey(context.settings.sports) });
    } catch (error) {
      const performance = buildPerformanceGuard({ history: [], settings: {}, now: startedAt.getTime() });
      const failure = { status: "error", error: text(error?.message, 500, "Autonomous Agent context could not be loaded"), nextCheckMinutes: 60, healthStatus: "blocked", healthScore: 0 };
      const brief = buildAutonomousDailyBrief({ performance, system: { status: "blocked" }, result: failure, audits: [], generatedAt: startedAt.toISOString() });
      await completeUser(admin, userId, failure, performance, brief);
    }
  }

  const allowedGroups = new Set([...new Set(entries.map((entry) => entry.sourceKey))].slice(0, MAX_SOURCE_GROUPS_PER_RUN));
  const selectedEntries = entries.filter((entry) => allowedGroups.has(entry.sourceKey));
  deferred.push(...entries.filter((entry) => !allowedGroups.has(entry.sourceKey)).map((entry) => ({ ...entry, reason: "Deferred by the per-run source-group budget" })));

  for (const item of deferred) {
    const performance = buildPerformanceGuard({ history: item.context?.history || [], bankroll: item.context?.bankroll?.bankroll || 1000, settings: item.context?.settings || {}, now: startedAt.getTime() });
    const result = { status: "deferred", error: item.reason, nextCheckMinutes: 180, healthStatus: performance.status, healthScore: performance.score };
    const brief = buildAutonomousDailyBrief({ performance, system: { status: "healthy" }, result, audits: [], generatedAt: startedAt.toISOString() });
    await completeUser(admin, item.userId, result, performance, brief);
  }

  const sourceCache = new Map();
  const sourceFailures = new Map();
  for (const entry of selectedEntries) {
    if (sourceCache.has(entry.sourceKey) || sourceFailures.has(entry.sourceKey)) continue;
    try {
      sourceCache.set(entry.sourceKey, await loadTopPicks(origin, entry.context.settings.sports, startedAt));
    } catch (error) {
      sourceFailures.set(entry.sourceKey, error);
    }
  }

  const results = [];
  for (const entry of selectedEntries.filter((item) => sourceFailures.has(item.sourceKey))) {
    results.push({ userId: entry.userId, ...await recordSourceFailure(admin, entry, sourceFailures.get(entry.sourceKey), startedAt) });
  }

  let remainingGlobalBudget = MAX_SAVED_PICKS_PER_RUN;
  for (const entry of selectedEntries.filter((item) => sourceCache.has(item.sourceKey))) {
    const result = await processUser(admin, entry, sourceCache.get(entry.sourceKey), globalSafety, startedAt, remainingGlobalBudget);
    remainingGlobalBudget = Math.max(0, remainingGlobalBudget - result.savedCount);
    results.push({ userId: entry.userId, ...result });
  }

  return {
    ok: true,
    version: "autonomous-paper-agent-v2",
    paperOnly: true,
    realMoneyBetting: false,
    learningMode: "shadow-only",
    productionProbabilityChangedByLearning: false,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    deferredUsers: deferred.length,
    pausedUsers: results.filter((item) => item.status === "paused").length,
    sourceFailureUsers: results.filter((item) => item.status === "error" && item.savedCount === 0).length,
    candidates: results.reduce((sum, item) => sum + finite(item.candidateCount), 0),
    selected: results.reduce((sum, item) => sum + finite(item.selectedCount), 0),
    savedPaperPicks: results.reduce((sum, item) => sum + finite(item.savedCount), 0),
    skipped: results.reduce((sum, item) => sum + finite(item.skippedCount), 0),
    totalVirtualStake: round(results.reduce((sum, item) => sum + finite(item.totalStake), 0), 2),
    sourceGroups: sourceCache.size,
    failedSourceGroups: sourceFailures.size,
    marketScanner: {
      sourceGroupsDue: [...sourceCache.values()].filter((source) => source.marketScanner?.due).length,
      sourceGroupsScanned: [...sourceCache.values()].filter((source) => source.marketScanner?.scanned).length,
      advancedCandidates: [...sourceCache.values()].reduce((sum, source) => sum + finite(source.advancedPickCount), 0),
      providerFailures: [...sourceCache.values()].reduce((sum, source) => sum + finite(source.marketScanner?.providerFailures), 0),
      priceOnlySkipped: [...sourceCache.values()].reduce((sum, source) => sum + finite(source.marketScanner?.priceOnlySkipped), 0),
      probabilityChangedByScanner: false,
      paperOnly: true
    },
    activeSystemIncidents: globalSafety.decisionAlerts.length + globalSafety.unifiedIncidents.length,
    limits: {
      usersPerRun: MAX_USERS_PER_RUN,
      sportsPerUser: MAX_SPORTS_PER_USER,
      sourceGroupsPerRun: MAX_SOURCE_GROUPS_PER_RUN,
      picksPerUser: MAX_PICKS_PER_USER,
      savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN,
      openBetsPerUser: MAX_OPEN_BETS_PER_USER,
      auditRowsPerUser: MAX_AUDIT_ROWS_PER_USER
    },
    generatedAt: startedAt.toISOString()
  };
}

export const AUTONOMOUS_AGENT_V2_LIMITS = {
  usersPerRun: MAX_USERS_PER_RUN,
  sportsPerUser: MAX_SPORTS_PER_USER,
  sourceGroupsPerRun: MAX_SOURCE_GROUPS_PER_RUN,
  picksPerUser: MAX_PICKS_PER_USER,
  savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN,
  openBetsPerUser: MAX_OPEN_BETS_PER_USER,
  auditRowsPerUser: MAX_AUDIT_ROWS_PER_USER
};
