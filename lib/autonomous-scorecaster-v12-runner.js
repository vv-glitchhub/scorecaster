import { runAutonomousPaperAgent } from "./autonomous-paper-agent.js";
import { buildSelfLearningReport } from "./agent-self-learning.mjs";
import {
  buildAutonomyJournal,
  buildAutonomyState
} from "./autonomous-scorecaster-v12.mjs";

const PREFLIGHT_LIMIT = 20;
const HISTORY_LIMIT = 500;
const OPEN_LIMIT = 200;

function clean(value, limit = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function iso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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

async function loadUserRiskContext(admin, userId) {
  const [settingsResult, bankrollResult, historyResult, openResult] = await Promise.all([
    admin.from("autonomous_agent_settings")
      .select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bankroll_settings")
      .select("bankroll,max_stake_percent,max_daily_exposure_percent,max_single_league_exposure_percent,min_edge,min_confidence,paper_trading_mode")
      .eq("user_id", userId).maybeSingle(),
    admin.from("bets")
      .select("id,status,created_at,updated_at,stake,odds,profit,closing_odds,clv,sport,league,market,raw_pick")
      .eq("user_id", userId)
      .neq("status", "open")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    admin.from("bets")
      .select("id,stake,league,sport,match,status,raw_pick")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(OPEN_LIMIT)
  ]);
  const error = settingsResult.error || bankrollResult.error || historyResult.error || openResult.error;
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
    modelLab: buildSelfLearningReport(history)
  };
}

async function insertDeferredRun(admin, userId, context, state, now) {
  const journal = buildAutonomyJournal({ state });
  const { data, error } = await admin.from("autonomous_agent_runs")
    .insert({
      user_id: userId,
      status: "deferred",
      sports: Array.isArray(context.settings?.sports) ? context.settings.sports : [],
      summary: {
        paperOnly: true,
        realMoneyBetting: false,
        agentVersion: "Autonomous-Scorecaster-V12",
        failureStage: "v12_preflight",
        autonomyV12: state,
        autonomyJournal: journal
      },
      error: clean(`V12 circuit breaker: ${state.blockers.join(", ") || state.reason}`, 500),
      started_at: now.toISOString(),
      completed_at: now.toISOString()
    })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

function cooldownHours(state) {
  if (state.blockers.includes("loss_streak_cooldown") || state.blockers.includes("rolling_loss_limit")) return 24;
  if (state.blockers.includes("critical_model_drift")) return 6;
  return 3;
}

async function deferFrozenUser(admin, row, context, state, now) {
  const runId = await insertDeferredRun(admin, row.user_id, context, state, now);
  const next = new Date(now.getTime() + cooldownHours(state) * 3_600_000).toISOString();
  const message = clean(`Autonomous Scorecaster V12 frozen: ${state.blockers.join(", ") || state.reason}`, 500);
  const { error } = await admin.from("autonomous_agent_state")
    .update({
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
    })
    .eq("user_id", row.user_id);
  if (error) throw error;
  return { userId: row.user_id, runId, nextCheckAt: next, state };
}

async function runPreflight(admin, now) {
  const nowIso = now.toISOString();
  const { data, error } = await admin.from("autonomous_agent_state")
    .select("user_id,next_check_at,lease_expires_at,last_status")
    .lte("next_check_at", nowIso)
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
    .order("next_check_at", { ascending: true })
    .limit(PREFLIGHT_LIMIT);
  if (error) throw error;

  const checked = [];
  const frozen = [];
  const failed = [];
  for (const row of data || []) {
    try {
      const context = await loadUserRiskContext(admin, row.user_id);
      if (!context.settings?.enabled) continue;
      const state = buildAutonomyState({
        history: context.history,
        modelLab: context.modelLab,
        bankroll: context.bankroll,
        openBets: context.openBets,
        now
      });
      checked.push({ userId: row.user_id, mode: state.mode });
      if (state.mode === "FROZEN") frozen.push(await deferFrozenUser(admin, row, context, state, now));
    } catch (error) {
      failed.push({ userId: row.user_id, error: clean(error?.message || error, 300) });
    }
  }
  return { checked, frozen, failed };
}

async function enrichRecentRuns(admin, startedAt, now) {
  const { data: runs, error } = await admin.from("autonomous_agent_runs")
    .select("id,user_id,status,summary,started_at")
    .gte("started_at", new Date(startedAt.getTime() - 1000).toISOString())
    .order("started_at", { ascending: true })
    .limit(50);
  if (error) throw error;

  let enriched = 0;
  for (const run of runs || []) {
    if (run.summary?.autonomyV12) continue;
    try {
      const context = await loadUserRiskContext(admin, run.user_id);
      const state = buildAutonomyState({
        history: context.history,
        modelLab: context.modelLab,
        bankroll: context.bankroll,
        openBets: context.openBets,
        now
      });
      const journal = buildAutonomyJournal({
        state,
        selected: Array.isArray(run.summary?.decisions) ? run.summary.decisions.filter((item) => item.saved) : [],
        skipped: []
      });
      const { error: updateError } = await admin.from("autonomous_agent_runs")
        .update({
          summary: {
            ...(run.summary || {}),
            agentVersion: "Autonomous-Scorecaster-V12",
            autonomyV12: state,
            autonomyJournal: journal,
            probabilityChangedByAutonomy: false,
            realMoneyBetting: false,
            paperOnly: true
          }
        })
        .eq("id", run.id);
      if (updateError) throw updateError;
      enriched += 1;
    } catch {
      // The original run remains authoritative even if journal enrichment fails.
    }
  }
  return enriched;
}

export async function runAutonomousScorecasterV12({ admin, origin, now = new Date() } = {}) {
  if (!admin) throw new Error("Autonomous Scorecaster V12 requires a Supabase admin client");
  if (!origin) throw new Error("Autonomous Scorecaster V12 requires a request origin");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Autonomous Scorecaster V12 requires a valid clock value");

  const preflight = await runPreflight(admin, startedAt);
  const base = await runAutonomousPaperAgent({ admin, origin, now: startedAt });
  const enrichedRuns = await enrichRecentRuns(admin, startedAt, new Date());

  return {
    ...base,
    version: "autonomous-scorecaster-v12",
    baseAgentVersion: base.version,
    v12: {
      preflightChecked: preflight.checked.length,
      circuitBreakerUsers: preflight.frozen.length,
      preflightFailures: preflight.failed.length,
      enrichedRuns,
      modes: preflight.checked.reduce((acc, item) => {
        acc[item.mode] = (acc[item.mode] || 0) + 1;
        return acc;
      }, {}),
      safety: {
        unifiedDataGate: true,
        modelDriftCircuitBreaker: true,
        drawdownCircuitBreaker: true,
        losingStreakCooldown: true,
        probabilityChanged: false,
        realMoneyBetting: false,
        paperOnly: true
      }
    },
    generatedAt: iso(startedAt)
  };
}
