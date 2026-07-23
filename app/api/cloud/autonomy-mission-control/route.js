import {
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  publicError
} from "../../../../lib/api-security";
import { autonomousAgentConfiguration } from "../../../../lib/autonomous-agent-config.js";
import { buildSelfLearningReport } from "../../../../lib/agent-self-learning.mjs";
import {
  buildAutonomyState,
  summarizeAutonomousDataReadiness
} from "../../../../lib/autonomous-scorecaster-v12.mjs";
import {
  applyAutonomousSystemCaps,
  AUTONOMOUS_HARD_LIMITS,
  buildDailyPaperUsage
} from "../../../../lib/autonomous-risk-governor.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function missingTable(error) {
  return error?.code === "42P01" || /does not exist|schema cache/i.test(error?.message || "");
}

function historyRow(row = {}) {
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

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function currentPicks(request) {
  try {
    const target = new URL("/api/top-picks", request.url);
    const response = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      return { picks: [], warning: payload?.error || payload?.reason || "Current Top Picks unavailable" };
    }
    return { picks: Array.isArray(payload?.data) ? payload.data : [], warning: null };
  } catch {
    return { picks: [], warning: "Current Top Picks unavailable" };
  }
}

function buildBrief(state, settings, workerState, picksWarning, daily) {
  const recommendations = [];
  if (!settings?.enabled) recommendations.push("Enable Autonomous Agent for this account before requesting protected paper cycles.");
  if (state.mode === "FROZEN") recommendations.push(...state.resumeConditions.map((item) => item.condition));
  if (state.mode === "DEGRADED") recommendations.push("Restore verified provider coverage before normal autonomous sizing resumes.");
  if (state.mode === "BOOTSTRAP") recommendations.push("Keep exposure minimal while the first 30 settled observations are collected.");
  if (state.mode === "GUARDED") recommendations.push("Continue collecting settled outcomes and positive closing-line evidence under reduced sizing.");
  if (state.mode === "ACTIVE") recommendations.push("All primary autonomy gates are healthy; continue monitoring drift, CLV and provider incidents.");
  if (daily.picksRemaining <= 0) recommendations.push("The persistent UTC daily pick limit is full. No more autonomous paper selections may be added today.");
  if (daily.exposureRemaining < 0.01) recommendations.push("The persistent UTC daily virtual-exposure budget is full.");
  if (picksWarning) recommendations.push(picksWarning);

  return {
    headline: state.reason,
    mode: state.mode,
    canCreateNewPaperExposure: Boolean(
      settings?.enabled &&
      state.mode !== "FROZEN" &&
      daily.picksRemaining > 0 &&
      daily.exposureRemaining >= 0.01
    ),
    nextCheckAt: workerState?.next_check_at || null,
    recommendations: [...new Set(recommendations)].slice(0, 8),
    proof: {
      settledSample: state.history.settledCount,
      currentCandidates: state.dataReadiness.candidateCount,
      verifiedCoverage: state.dataReadiness.averageVerifiedCoverage,
      multiProviderRate: state.dataReadiness.multiProviderRate,
      averageClv: state.history.clv.average,
      recentBankrollImpact: state.history.recent30.bankrollImpact,
      modelDrift: state.modelLab.driftStatus,
      dailyPicksUsed: daily.picksUsed,
      dailyPicksRemaining: daily.picksRemaining,
      dailyStakeUsed: daily.stakeUsed,
      dailyExposureRemaining: daily.exposureRemaining
    }
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "autonomy_mission_control_read",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const dayStart = utcDayStart().toISOString();
  const [settingsResult, stateResult, runsResult, bankrollResult, historyResult, openResult, todayResult, picksResult] = await Promise.all([
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
      .limit(30),
    auth.supabase.from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode")
      .eq("user_id", auth.user.id).maybeSingle(),
    auth.supabase.from("bets")
      .select("id,status,created_at,updated_at,stake,odds,profit,closing_odds,clv,sport,league,market,raw_pick")
      .eq("user_id", auth.user.id)
      .neq("status", "open")
      .order("created_at", { ascending: false })
      .limit(500),
    auth.supabase.from("bets")
      .select("id,label,match,market,bookmaker,sport,league,odds,stake,edge,ev,confidence,status,raw_pick,created_at")
      .eq("user_id", auth.user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
    auth.supabase.from("bets")
      .select("id,created_at,stake,match,raw_pick")
      .eq("user_id", auth.user.id)
      .gte("created_at", dayStart)
      .order("created_at", { ascending: true })
      .limit(100),
    currentPicks(request)
  ]);

  const error = settingsResult.error || stateResult.error || runsResult.error || bankrollResult.error || historyResult.error || openResult.error || todayResult.error;
  const configuration = autonomousAgentConfiguration();
  if (error && missingTable(error)) {
    return jsonResponse({
      ok: true,
      available: false,
      warning: "Autonomous Agent production migration is not active",
      paperOnly: true,
      realMoneyBetting: false,
      configuration: {
        enabledFlag: configuration.enabledFlag,
        configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured
      }
    }, 200, requestId);
  }
  if (error) return jsonResponse({ ok: false, error: publicError(error, "Autonomy Mission Control could not be loaded") }, 500, requestId);

  const settings = settingsResult.data || { enabled: false, sports: [], daily_pick_limit: 3 };
  const bankroll = applyAutonomousSystemCaps({
    bankroll: Number(bankrollResult.data?.bankroll || 1000),
    maxStakePercent: Number(bankrollResult.data?.max_stake_percent || 2),
    maxTotalExposurePercent: Number(bankrollResult.data?.max_daily_exposure_percent || 8),
    maxLeagueExposurePercent: Number(bankrollResult.data?.max_single_league_exposure_percent || 4),
    minEdge: Number(bankrollResult.data?.min_edge || 0.025),
    minConfidence: Number(bankrollResult.data?.min_confidence || 0.58),
    paperTradingMode: bankrollResult.data?.paper_trading_mode !== false
  });
  const dailyUsage = buildDailyPaperUsage(todayResult.data || []);
  const dailyPickLimit = Math.max(1, Math.min(3, Number(settings.daily_pick_limit || 3)));
  const dailyExposureCap = bankroll.bankroll * bankroll.maxTotalExposurePercent / 100;
  const daily = {
    dayStart,
    pickLimit: dailyPickLimit,
    picksUsed: dailyUsage.pickCount,
    picksRemaining: Math.max(0, dailyPickLimit - dailyUsage.pickCount),
    stakeUsed: Number(dailyUsage.totalStake.toFixed(2)),
    exposureCap: Number(dailyExposureCap.toFixed(2)),
    exposureRemaining: Number(Math.max(0, dailyExposureCap - dailyUsage.totalStake).toFixed(2)),
    uniqueEvents: dailyUsage.events.size,
    hardLimits: AUTONOMOUS_HARD_LIMITS
  };
  const history = (historyResult.data || []).map(historyRow);
  const modelLab = buildSelfLearningReport(history);
  const picks = picksResult.picks || [];
  const autonomy = buildAutonomyState({
    history,
    decisions: picks,
    modelLab,
    bankroll,
    openBets: openResult.data || [],
    now: new Date()
  });
  const runs = runsResult.data || [];
  const state = stateResult.data || null;
  const latestRun = runs[0] || null;

  return jsonResponse({
    ok: true,
    available: true,
    version: "autonomy-mission-control-v12-daily-governor",
    paperOnly: true,
    realMoneyBetting: false,
    configuration: {
      enabledFlag: configuration.enabledFlag,
      configured: configuration.adminConfigured && configuration.cronSecretConfigured && configuration.oddsProviderConfigured,
      agentActive: configuration.agentActive,
      schedulingManagedExternally: configuration.schedulingManagedExternally,
      intervalMinutes: configuration.intervalMinutes
    },
    settings,
    bankroll,
    daily,
    state,
    autonomy,
    currentDataReadiness: summarizeAutonomousDataReadiness(picks),
    modelLab,
    brief: buildBrief(autonomy, settings, state, picksResult.warning, daily),
    currentCandidates: picks.slice(0, 20).map((pick) => ({
      eventId: pick.gameId || pick.eventId || pick.id || null,
      match: pick.match || `${pick.homeTeam || "Home"} vs ${pick.awayTeam || "Away"}`,
      selection: pick.selection || pick.label,
      decision: pick.productDecision || pick.decision,
      odds: pick.odds,
      edge: pick.edge,
      ev: pick.ev,
      confidence: pick.confidence,
      verifiedCoverage: pick.unifiedSportsData?.coverage?.verifiedCoverageRate ?? null,
      oddsProviders: pick.unifiedSportsData?.coverage?.independentOddsProviders ?? 1,
      safetyAction: pick.unifiedSportsData?.safetyRecommendation?.action || null
    })),
    openPaperPositions: openResult.data || [],
    runs,
    latestRun,
    generatedAt: new Date().toISOString()
  }, 200, requestId);
}
