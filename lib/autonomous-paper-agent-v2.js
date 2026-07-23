import { createHash } from "node:crypto";
import { calculateAgentPerformance } from "./agent-learning.js";
import { applyModelLabSafety } from "./agent-model-governance.mjs";
import { buildSelfLearningReport } from "./agent-self-learning.mjs";
import { buildAgentV9Portfolio } from "./agent-v9-engine.mjs";
import {
  applyAutonomousSystemCaps,
  buildAutonomousRiskGovernor,
  buildDailyPaperUsage
} from "./autonomous-risk-governor.mjs";
import { SPORTS } from "./sports.js";
import { GET as getTopPicks } from "../app/api/top-picks/route.js";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const MAX_USERS_PER_RUN = 10;
const MAX_SPORTS_PER_USER = 6;
const MAX_SOURCE_GROUPS_PER_RUN = 6;
const MAX_PICKS_PER_USER = 3;
const MAX_SAVED_PICKS_PER_RUN = 30;
const MAX_HISTORY_PER_USER = 500;
const MAX_OPEN_BETS_PER_USER = 200;
const MAX_AUDIT_DECISIONS = 50;

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
  const scale = 10 ** digits;
  return Math.round(finite(value) * scale) / scale;
}

function normalized(value) {
  return text(value, 240).toLowerCase().replace(/\s+/g, " ");
}

function safeList(value, maximum = 8, itemLength = 240) {
  return (Array.isArray(value) ? value : [])
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item), itemLength))
    .filter(Boolean)
    .slice(0, maximum);
}

function pickEventId(pick = {}) {
  return text(pick.eventId || pick.event_id || pick.gameId || pick.game_id || pick.id, 180);
}

function pickSelection(pick = {}) {
  return text(pick.selection || pick.label || pick.pick, 160);
}

function pickMatch(pick = {}) {
  return text(
    pick.match ||
    [pick.homeTeam || pick.home_team, pick.awayTeam || pick.away_team].filter(Boolean).join(" vs "),
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

function historyRow(row) {
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
    modelProbability: row.raw_pick?.modelProbability ?? null,
    raw_pick: row.raw_pick || null
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
    dailyPickLimit: Math.max(1, Math.min(MAX_PICKS_PER_USER, Math.trunc(finite(row.daily_pick_limit, 3)))),
    minPriorityScore: Math.max(0.5, Math.min(1, finite(row.min_priority_score, 0.62))),
    minOdds: Math.max(1.01, Math.min(20, finite(row.min_odds, 1.2))),
    maxOdds: Math.max(1.01, Math.min(20, finite(row.max_odds, 5)))
  };
}

function normalizeBankroll(row = {}) {
  return applyAutonomousSystemCaps({
    bankroll: Math.max(0, finite(row.bankroll, 1000)),
    maxStakePercent: finite(row.max_stake_percent, 0.75),
    maxTotalExposurePercent: finite(row.max_daily_exposure_percent, 4),
    maxLeagueExposurePercent: finite(row.max_single_league_exposure_percent, 2.5),
    minEdge: Math.max(0, Math.min(0.5, finite(row.min_edge, 0.025))),
    minConfidence: Math.max(0, Math.min(1, finite(row.min_confidence, 0.58))),
    paperTradingMode: row.paper_trading_mode !== false
  });
}

function utcDayStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_autonomous_agent_users", { p_limit: MAX_USERS_PER_RUN });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadUserContext(admin, userId, now) {
  const dayStart = utcDayStart(now).toISOString();
  const [settingsResult, bankrollResult, openResult, historyResult, todayResult] = await Promise.all([
    admin.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds")
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
      .select("id,created_at,stake,league,sport,match,status,raw_pick")
      .eq("user_id", userId).gte("created_at", dayStart)
      .order("created_at", { ascending: true }).limit(100)
  ]);
  const error = settingsResult.error || bankrollResult.error || openResult.error || historyResult.error || todayResult.error;
  if (error) throw error;
  return {
    settings: normalizeSettings(settingsResult.data || {}),
    bankroll: normalizeBankroll(bankrollResult.data || {}),
    openBets: openResult.data || [],
    history: (historyResult.data || []).map(historyRow),
    todayBets: todayResult.data || [],
    dayStart
  };
}

async function completeUser(admin, userId, result) {
  const { error } = await admin.rpc("complete_autonomous_agent_user", {
    p_user_id: userId,
    p_status: result.status,
    p_run_id: result.runId || null,
    p_candidate_count: result.candidateCount || 0,
    p_selected_count: result.selectedCount || 0,
    p_saved_count: result.savedCount || 0,
    p_skipped_count: result.skippedCount || 0,
    p_total_stake: result.totalStake || 0,
    p_error: result.error ? text(result.error, 500) : null
  });
  if (error) throw error;
}

async function createRun(admin, userId, sports, now) {
  const { data, error } = await admin.from("autonomous_agent_runs")
    .insert({ user_id: userId, status: "running", sports, started_at: now.toISOString() })
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
      error: result.error ? text(result.error, 500) : null,
      completed_at: completedAt.toISOString()
    })
    .eq("id", runId);
  if (error) throw error;
}

async function loadTopPicks(origin, sports) {
  const target = new URL("/api/top-picks", origin);
  if (sports.length) target.searchParams.set("sports", sports.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "Autonomous Agent source data could not be loaded");
  return {
    picks: Array.isArray(payload?.data) ? payload.data : [],
    source: text(payload?.source, 100, "no-vig-market-consensus"),
    fixtureSource: text(payload?.fixtureSource, 100, "live-odds-provider-only")
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

function chooseDecisions(decisions, context, riskGovernor) {
  const { settings, bankroll, openBets } = context;
  const exposure = existingExposure(openBets, bankroll);
  const daily = buildDailyPaperUsage(context.todayBets);
  const dailyCap = bankroll.bankroll * bankroll.maxTotalExposurePercent / 100;
  let remainingTotal = Math.max(0, Math.min(exposure.totalCap - exposure.total, dailyCap - daily.totalStake));
  const leagueUsed = new Map(exposure.league);
  const usedEvents = new Set([...exposure.events, ...daily.events]);
  const selected = [];
  const skipped = [];
  const remainingDailyPicks = Math.max(0, settings.dailyPickLimit - daily.pickCount);
  const requiredPriority = Math.min(1, settings.minPriorityScore + riskGovernor.priorityPenalty);

  for (const decision of decisions) {
    const odds = finite(decision.odds);
    const edge = finite(decision.edge, -1);
    const confidence = finite(decision.confidence, -1);
    const event = eventIdentity(decision);
    const league = leagueIdentity(decision);
    const reasons = [];
    if (!riskGovernor.allowNewExposure) reasons.push("system_circuit_breaker");
    if (decision.decision !== "PLAY" || finite(decision.allocatedStake || decision.suggestedStake) <= 0) reasons.push("not_play");
    if (finite(decision.priorityScore) < requiredPriority) reasons.push("priority_below_dynamic_threshold");
    if (odds < settings.minOdds || odds > settings.maxOdds) reasons.push("odds_outside_user_range");
    if (edge < bankroll.minEdge) reasons.push("edge_below_bankroll_threshold");
    if (confidence < bankroll.minConfidence) reasons.push("confidence_below_bankroll_threshold");
    if (!event) reasons.push("missing_event_identity");
    if (event && usedEvents.has(event)) reasons.push("event_already_exposed_today");
    if (selected.length >= remainingDailyPicks) reasons.push("daily_pick_limit_reached");
    if (reasons.length) {
      skipped.push({ decision, reasons });
      continue;
    }

    const leagueExposure = leagueUsed.get(league) || 0;
    const remainingLeague = Math.max(0, exposure.leagueCap - leagueExposure);
    const requested = Math.max(0, finite(decision.allocatedStake || decision.suggestedStake)) * riskGovernor.stakeMultiplier;
    const stake = round(Math.min(requested, exposure.singleCap, remainingTotal, remainingLeague), 2);
    if (stake < 0.01) {
      skipped.push({
        decision,
        reasons: [
          remainingTotal < 0.01
            ? daily.totalStake >= dailyCap
              ? "daily_exposure_full"
              : "open_exposure_full"
            : "league_exposure_full"
        ]
      });
      continue;
    }

    selected.push({ ...decision, autonomousStake: stake });
    usedEvents.add(event);
    remainingTotal = Math.max(0, remainingTotal - stake);
    leagueUsed.set(league, leagueExposure + stake);
  }
  return { selected, skipped, exposure, daily, dailyCap, remainingDailyPicks, requiredPriority };
}

function clientRef(userId, decision, now) {
  const day = now.toISOString().slice(0, 10);
  const key = [userId, day, pickEventId(decision) || pickMatch(decision), pickSelection(decision)].join("|");
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `autonomous-v2-${day}-${digest}`;
}

function contextAudit(decision = {}) {
  return {
    usedDataSources: safeList([
      decision.source,
      decision.provider,
      decision.bookmaker,
      ...(Array.isArray(decision.dataSources) ? decision.dataSources : []),
      ...(Array.isArray(decision.usedDataSources) ? decision.usedDataSources : [])
    ]),
    unusedOrMissingData: safeList(
      decision.missingEvidence || decision.missingData || decision.unusedDataSources || []
    ),
    evidence: safeList(decision.evidence),
    counterArguments: safeList(decision.counterArguments),
    blockers: safeList(decision.blockers),
    contextSignals: {
      startersConfirmed: Boolean(decision.lineup?.startersConfirmed || decision.startersConfirmed),
      injurySignals: Array.isArray(decision.injuries) ? decision.injuries.length : 0,
      newsSignals: Array.isArray(decision.newsItems) ? decision.newsItems.length : 0,
      restSignal: decision.restSignal || decision.rest || null,
      travelSignal: decision.travelSignal || decision.travel || null,
      weatherSignal: decision.weatherSignal || decision.weather || null
    },
    dataQuality: decision.dataQuality || null,
    priceGuard: decision.priceGuard || null,
    learningSignal: decision.learningSignal || null,
    selfLearning: decision.selfLearning || null,
    autonomyV12: decision.autonomyV12 || null,
    unifiedSportsData: decision.unifiedSportsData || null
  };
}

function paperRow(userId, runId, decision, source, fixtureSource, now, riskGovernor) {
  const odds = finite(decision.odds);
  const eventId = pickEventId(decision);
  const probability = decision.stressTest?.probability ?? decision.consensusProbability ?? decision.modelProbability ?? null;
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
      source: "scorecaster-autonomous-v12",
      eventId,
      modelProbability: probability,
      originalProbability: decision.consensusProbability ?? decision.modelProbability ?? null,
      impliedProbability: odds > 1 ? 1 / odds : null,
      decision: "PLAY",
      decisionReasons: safeList(decision.portfolioReason ? [decision.portfolioReason] : decision.reasons),
      qualityGrade: text(decision.qualityGrade, 8),
      qualityScore: decision.qualityScore ?? null,
      agentVersion: "Autonomous-Scorecaster-V12-Daily-Governor",
      portfolioAgentVersion: decision.agentVersion || "V11-model-lab-shadow",
      priorityScore: round(decision.priorityScore, 6),
      robustnessScore: round(decision.robustnessScore, 6),
      minimumPlayOdds: decision.priceGuard?.minimumPlayOdds ?? decision.stressTest?.targetPlayOdds ?? null,
      autonomousRunId: runId,
      providerSource: source,
      fixtureSource,
      riskGovernor: {
        version: riskGovernor.version,
        mode: riskGovernor.mode,
        stakeMultiplier: riskGovernor.stakeMultiplier,
        hardReasons: riskGovernor.hardReasons,
        cautionReasons: riskGovernor.cautionReasons
      },
      decisionTicket: contextAudit(decision),
      generatedAt: now.toISOString(),
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

function summaryDecision(decision, saved, reasons = []) {
  return {
    eventId: pickEventId(decision) || null,
    match: pickMatch(decision),
    selection: pickSelection(decision),
    sport: pickSport(decision),
    league: pickLeague(decision),
    odds: round(decision.odds, 4),
    stake: round(decision.autonomousStake || 0, 2),
    priorityScore: round(decision.priorityScore, 6),
    robustnessScore: round(decision.robustnessScore, 6),
    autonomyMode: decision.autonomyV12?.mode || null,
    saved,
    reasons: safeList(reasons, 8, 120)
  };
}

async function processUser(admin, entry, source, now, globalBudget) {
  let runId = null;
  try {
    runId = await createRun(admin, entry.userId, entry.context.settings.sports, now);
    const modelLab = buildSelfLearningReport(entry.context.history);
    const learning = calculateAgentPerformance(entry.context.history);
    const riskGovernor = buildAutonomousRiskGovernor(entry.context.history, { modelLab });
    const portfolio = buildAgentV9Portfolio(source.picks, {
      bankroll: entry.context.bankroll.bankroll,
      maxStakePercent: entry.context.bankroll.maxStakePercent,
      maxTotalExposurePercent: entry.context.bankroll.maxTotalExposurePercent,
      maxLeagueExposurePercent: entry.context.bankroll.maxLeagueExposurePercent,
      learning
    });
    const governed = applyModelLabSafety(portfolio.decisions, modelLab);
    const choice = chooseDecisions(governed, entry.context, riskGovernor);
    const selected = choice.selected.slice(0, Math.max(0, globalBudget));
    const audit = choice.skipped.slice(0, MAX_AUDIT_DECISIONS).map((item) => summaryDecision(item.decision, false, item.reasons));
    let savedCount = 0;
    let duplicateCount = 0;
    let riskRejectedCount = 0;
    let saveErrorCount = 0;
    let totalStake = 0;

    for (const decision of selected) {
      const saveResult = await saveDecision(
        admin,
        paperRow(entry.userId, runId, decision, source.source, source.fixtureSource, now, riskGovernor)
      );
      if (saveResult.saved) {
        savedCount += 1;
        totalStake += decision.autonomousStake;
        audit.push(summaryDecision(decision, true, ["saved_paper_play"]));
      } else if (saveResult.duplicate) {
        duplicateCount += 1;
        audit.push(summaryDecision(decision, false, ["duplicate_daily_decision"]));
      } else if (saveResult.riskRejected) {
        riskRejectedCount += 1;
        audit.push(summaryDecision(decision, false, ["database_risk_limit"]));
      } else {
        saveErrorCount += 1;
        audit.push(summaryDecision(decision, false, ["save_failed"]));
      }
    }

    const result = {
      status: saveErrorCount ? "error" : "success",
      runId,
      candidateCount: governed.length,
      selectedCount: selected.length,
      savedCount,
      skippedCount: choice.skipped.length + duplicateCount + riskRejectedCount + Math.max(0, choice.selected.length - selected.length),
      totalStake: round(totalStake, 2),
      error: saveErrorCount ? `${saveErrorCount} autonomous paper decisions could not be saved` : null
    };
    const summary = {
      paperOnly: true,
      agentVersion: "Autonomous-Scorecaster-V12-Daily-Governor",
      source: source.source,
      fixtureSource: source.fixtureSource,
      modelLabStatus: modelLab?.status || null,
      riskGovernor,
      dayStart: entry.context.dayStart,
      dailyPickLimit: entry.context.settings.dailyPickLimit,
      dailyPicksBefore: choice.daily.pickCount,
      dailyStakeBefore: round(choice.daily.totalStake, 2),
      dailyExposureCap: round(choice.dailyCap, 2),
      remainingDailyPicksBeforeRun: choice.remainingDailyPicks,
      requiredPriority: round(choice.requiredPriority, 4),
      openExposureBefore: round(choice.exposure.total, 2),
      openExposureCap: round(choice.exposure.totalCap, 2),
      duplicateCount,
      riskRejectedCount,
      decisions: audit.slice(0, MAX_AUDIT_DECISIONS)
    };
    await finishRun(admin, runId, result, summary, now);
    await completeUser(admin, entry.userId, result);
    return result;
  } catch (error) {
    const failure = {
      status: "error",
      runId,
      candidateCount: 0,
      selectedCount: 0,
      savedCount: 0,
      skippedCount: 0,
      totalStake: 0,
      error: text(error?.message, 500, "Autonomous Agent processing failed")
    };
    if (runId) {
      try {
        await finishRun(admin, runId, failure, {
          paperOnly: true,
          agentVersion: "Autonomous-Scorecaster-V12-Daily-Governor",
          failureStage: "user_processing"
        }, now);
      } catch {
        // State completion below remains the authoritative retry signal.
      }
    }
    await completeUser(admin, entry.userId, failure);
    return failure;
  }
}

async function recordSourceFailure(admin, entry, error, now) {
  const failure = {
    status: "error",
    runId: null,
    candidateCount: 0,
    selectedCount: 0,
    savedCount: 0,
    skippedCount: 0,
    totalStake: 0,
    error: text(error?.message, 500, "Autonomous Agent source data could not be loaded")
  };
  try {
    const runId = await createRun(admin, entry.userId, entry.context.settings.sports, now);
    failure.runId = runId;
    await finishRun(admin, runId, failure, {
      paperOnly: true,
      agentVersion: "Autonomous-Scorecaster-V12-Daily-Governor",
      failureStage: "source_loading",
      sourceGroup: entry.sourceKey
    }, now);
  } catch {
    // The user state still records the bounded error and short retry interval.
  }
  await completeUser(admin, entry.userId, failure);
  return failure;
}

export async function runAutonomousPaperAgentV2({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Paper Agent V2 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Paper Agent V2 requires a request origin");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Autonomous Paper Agent V2 requires a valid clock value");

  const userIds = await claimUsers(admin);
  const entries = [];
  const deferred = [];
  for (const userId of userIds) {
    try {
      const context = await loadUserContext(admin, userId, startedAt);
      if (!context.settings.enabled) {
        deferred.push({ userId, reason: "Autonomous Agent is no longer enabled" });
      } else if (!context.bankroll.paperTradingMode || context.bankroll.bankroll <= 0) {
        deferred.push({ userId, reason: "Virtual bankroll or paper trading mode is not active" });
      } else if (context.openBets.length > MAX_OPEN_BETS_PER_USER) {
        deferred.push({ userId, reason: `Open paper bet limit exceeds ${MAX_OPEN_BETS_PER_USER}` });
      } else {
        entries.push({ userId, context, sourceKey: sourceGroupKey(context.settings.sports) });
      }
    } catch (error) {
      await completeUser(admin, userId, {
        status: "error",
        error: text(error?.message, 500, "Autonomous Agent context could not be loaded")
      });
    }
  }

  const allowedGroups = new Set([...new Set(entries.map((entry) => entry.sourceKey))].slice(0, MAX_SOURCE_GROUPS_PER_RUN));
  const selectedEntries = entries.filter((entry) => allowedGroups.has(entry.sourceKey));
  const groupDeferred = entries.filter((entry) => !allowedGroups.has(entry.sourceKey));
  deferred.push(...groupDeferred.map((entry) => ({ userId: entry.userId, reason: "Deferred by the per-run source-group budget" })));

  for (const item of deferred) {
    await completeUser(admin, item.userId, { status: "deferred", error: item.reason });
  }

  const sourceCache = new Map();
  const sourceFailures = new Map();
  for (const entry of selectedEntries) {
    if (sourceCache.has(entry.sourceKey) || sourceFailures.has(entry.sourceKey)) continue;
    try {
      sourceCache.set(entry.sourceKey, await loadTopPicks(origin, entry.context.settings.sports));
    } catch (error) {
      sourceFailures.set(entry.sourceKey, error);
    }
  }

  const results = [];
  for (const entry of selectedEntries.filter((item) => sourceFailures.has(item.sourceKey))) {
    try {
      results.push({ userId: entry.userId, ...await recordSourceFailure(admin, entry, sourceFailures.get(entry.sourceKey), startedAt) });
    } catch {
      // A completion failure is surfaced by the outer worker route without exposing credentials.
    }
  }

  let remainingGlobalBudget = MAX_SAVED_PICKS_PER_RUN;
  for (const entry of selectedEntries.filter((item) => sourceCache.has(item.sourceKey))) {
    const result = await processUser(admin, entry, sourceCache.get(entry.sourceKey), startedAt, remainingGlobalBudget);
    remainingGlobalBudget = Math.max(0, remainingGlobalBudget - result.savedCount);
    results.push({ userId: entry.userId, ...result });
  }

  return {
    ok: true,
    version: "autonomous-paper-agent-v2",
    paperOnly: true,
    realMoneyBetting: false,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    deferredUsers: deferred.length,
    sourceFailureUsers: results.filter((item) => item.status === "error" && item.savedCount === 0).length,
    candidates: results.reduce((sum, item) => sum + item.candidateCount, 0),
    selected: results.reduce((sum, item) => sum + item.selectedCount, 0),
    savedPaperPicks: results.reduce((sum, item) => sum + item.savedCount, 0),
    skipped: results.reduce((sum, item) => sum + item.skippedCount, 0),
    totalVirtualStake: round(results.reduce((sum, item) => sum + item.totalStake, 0), 2),
    sourceGroups: sourceCache.size,
    failedSourceGroups: sourceFailures.size,
    limits: {
      usersPerRun: MAX_USERS_PER_RUN,
      sportsPerUser: MAX_SPORTS_PER_USER,
      sourceGroupsPerRun: MAX_SOURCE_GROUPS_PER_RUN,
      picksPerUserPerDay: MAX_PICKS_PER_USER,
      savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN,
      openBetsPerUser: MAX_OPEN_BETS_PER_USER,
      hardMaxStakePercent: 1,
      hardMaxDailyExposurePercent: 5,
      hardMaxLeagueExposurePercent: 2.5
    },
    generatedAt: startedAt.toISOString()
  };
}

export const AUTONOMOUS_AGENT_V2_LIMITS = {
  usersPerRun: MAX_USERS_PER_RUN,
  sportsPerUser: MAX_SPORTS_PER_USER,
  sourceGroupsPerRun: MAX_SOURCE_GROUPS_PER_RUN,
  picksPerUserPerDay: MAX_PICKS_PER_USER,
  savedPicksPerRun: MAX_SAVED_PICKS_PER_RUN,
  openBetsPerUser: MAX_OPEN_BETS_PER_USER,
  hardMaxStakePercent: 1,
  hardMaxDailyExposurePercent: 5,
  hardMaxLeagueExposurePercent: 2.5
};
