import { findScoreEventForBet, settlePaperBetFromScore } from "./paper-settlement-engine.mjs";
import { loadScoreEvents } from "./paper-score-provider.js";
import { SPORTS } from "./sports.js";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const BET_SELECT = "id,user_id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at";
const MAX_USERS_PER_RUN = 20;
const MAX_OPEN_BETS_PER_USER = 100;
const MAX_SPORTS_PER_RUN = 12;
const MAX_SETTLEMENTS_PER_RUN = 200;

function text(value, maximum = 500, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function supportedH2hBet(bet) {
  return bet?.status === "open" &&
    String(bet?.market || "h2h").toLowerCase() === "h2h" &&
    SUPPORTED_SPORTS.has(String(bet?.sport || ""));
}

async function claimUsers(admin) {
  const { data, error } = await admin.rpc("claim_paper_settlement_monitor_users", {
    p_limit: MAX_USERS_PER_RUN
  });
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadOpenBets(admin, userId) {
  const { data, error } = await admin
    .from("bets")
    .select(BET_SELECT)
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(MAX_OPEN_BETS_PER_USER + 1);
  if (error) throw error;
  return data || [];
}

async function completeUser(admin, userId, {
  status,
  openCount = 0,
  settledCount = 0,
  pendingCount = 0,
  providerWarningsCount = 0,
  error = null
}) {
  const { error: completionError } = await admin.rpc("complete_paper_settlement_monitor_user", {
    p_user_id: userId,
    p_status: status,
    p_open_count: openCount,
    p_settled_count: settledCount,
    p_pending_count: pendingCount,
    p_provider_warnings_count: providerWarningsCount,
    p_error: error ? text(error, 500) : null
  });
  if (completionError) throw completionError;
}

function chooseEntriesWithinSportBudget(entries) {
  const selected = [];
  const deferred = [];
  const selectedSports = new Set();

  for (const entry of entries) {
    const entrySports = unique(entry.bets.filter(supportedH2hBet).map((bet) => String(bet.sport || "")));
    const combined = new Set([...selectedSports, ...entrySports]);
    if (combined.size <= MAX_SPORTS_PER_RUN) {
      selected.push({ ...entry, sports: entrySports });
      for (const sport of entrySports) selectedSports.add(sport);
    } else {
      deferred.push({ ...entry, sports: entrySports, reason: "Deferred by the per-run sport budget" });
    }
  }

  return { selected, deferred, sports: [...selectedSports].sort() };
}

async function updateSettlement(admin, bet, settlement, now) {
  const rawPick = bet.raw_pick && typeof bet.raw_pick === "object" ? bet.raw_pick : {};
  const nextRawPick = {
    ...rawPick,
    eventId: settlement.eventId || rawPick.eventId || null,
    settlementSource: settlement.settlementSource,
    settlementMonitorVersion: "settlement-monitor-v1",
    settledAt: now.toISOString(),
    completedAt: settlement.completedAt,
    finalScore: settlement.finalScore
  };

  const { data, error } = await admin
    .from("bets")
    .update({
      status: settlement.status,
      result: settlement.result,
      profit: settlement.profit,
      raw_pick: nextRawPick
    })
    .eq("id", bet.id)
    .eq("user_id", bet.user_id)
    .eq("status", "open")
    .select("id,status")
    .maybeSingle();

  return { data, error, betId: bet.id };
}

async function settleUser(admin, entry, eventsBySport, warningsBySport, now, settlementBudget) {
  const candidates = [];
  for (const bet of entry.bets) {
    if (!supportedH2hBet(bet)) continue;
    const event = findScoreEventForBet(bet, eventsBySport.get(String(bet.sport || "")) || []);
    const settlement = event ? settlePaperBetFromScore(bet, event) : null;
    if (settlement) candidates.push({ bet, settlement });
  }

  const attempted = candidates.slice(0, Math.max(0, settlementBudget));
  const updates = await Promise.all(
    attempted.map(({ bet, settlement }) => updateSettlement(admin, bet, settlement, now))
  );
  const settledCount = updates.filter((item) => item.data && !item.error).length;
  const updateFailures = updates.filter((item) => item.error).length;
  const providerWarningsCount = entry.sports.filter((sport) => warningsBySport.has(sport)).length;
  const pendingCount = Math.max(0, entry.bets.length - settledCount);

  await completeUser(admin, entry.userId, {
    status: updateFailures ? "error" : "success",
    openCount: entry.bets.length,
    settledCount,
    pendingCount,
    providerWarningsCount,
    error: updateFailures ? `${updateFailures} paper settlements could not be saved` : null
  });

  return {
    openCount: entry.bets.length,
    candidateCount: candidates.length,
    attemptedCount: attempted.length,
    settledCount,
    pendingCount,
    providerWarningsCount,
    updateFailures
  };
}

export async function runSettlementMonitor({ admin, fetchImpl = fetch, now = new Date() } = {}) {
  if (!admin) throw new Error("Settlement Monitor requires a Supabase admin client");
  const startedAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw new Error("Settlement Monitor requires a valid clock value");

  const userIds = await claimUsers(admin);
  const entries = [];
  const immediatelyDeferred = [];

  for (const userId of userIds) {
    try {
      const bets = await loadOpenBets(admin, userId);
      if (bets.length > MAX_OPEN_BETS_PER_USER) {
        immediatelyDeferred.push({ userId, bets, reason: `Open paper bet limit exceeds ${MAX_OPEN_BETS_PER_USER}` });
      } else {
        entries.push({ userId, bets });
      }
    } catch (error) {
      await completeUser(admin, userId, {
        status: "error",
        error: text(error?.message, 500, "Open paper bets could not be loaded")
      });
    }
  }

  const budget = chooseEntriesWithinSportBudget(entries);
  const deferred = [...immediatelyDeferred, ...budget.deferred];
  for (const entry of deferred) {
    await completeUser(admin, entry.userId, {
      status: "deferred",
      openCount: Math.min(entry.bets.length, MAX_OPEN_BETS_PER_USER),
      pendingCount: Math.min(entry.bets.length, MAX_OPEN_BETS_PER_USER),
      error: entry.reason
    });
  }

  const scoreResponses = await Promise.all(
    budget.sports.map((sport) => loadScoreEvents(sport, { fetchImpl }))
  );
  const eventsBySport = new Map(scoreResponses.map((item) => [item.sport, item.events || []]));
  const warningsBySport = new Map(
    scoreResponses.filter((item) => item.warning).map((item) => [item.sport, item.warning])
  );

  let remainingSettlementBudget = MAX_SETTLEMENTS_PER_RUN;
  const results = [];
  for (const entry of budget.selected) {
    try {
      const result = await settleUser(
        admin,
        entry,
        eventsBySport,
        warningsBySport,
        startedAt,
        remainingSettlementBudget
      );
      remainingSettlementBudget = Math.max(0, remainingSettlementBudget - result.attemptedCount);
      results.push({ userId: entry.userId, ...result });
    } catch (error) {
      await completeUser(admin, entry.userId, {
        status: "error",
        openCount: entry.bets.length,
        pendingCount: entry.bets.length,
        providerWarningsCount: entry.sports.filter((sport) => warningsBySport.has(sport)).length,
        error: text(error?.message, 500, "Paper settlement processing failed")
      });
    }
  }

  return {
    ok: true,
    version: "settlement-monitor-v1",
    paperOnly: true,
    claimedUsers: userIds.length,
    processedUsers: results.length,
    deferredUsers: deferred.length,
    checkedOpenBets: results.reduce((sum, item) => sum + item.openCount, 0),
    settlementCandidates: results.reduce((sum, item) => sum + item.candidateCount, 0),
    settledBets: results.reduce((sum, item) => sum + item.settledCount, 0),
    pendingBets: results.reduce((sum, item) => sum + item.pendingCount, 0),
    updateFailures: results.reduce((sum, item) => sum + item.updateFailures, 0),
    checkedSports: budget.sports,
    providerWarnings: [...warningsBySport].map(([sport, warning]) => ({ sport, warning })),
    limits: {
      usersPerRun: MAX_USERS_PER_RUN,
      openBetsPerUser: MAX_OPEN_BETS_PER_USER,
      sportsPerRun: MAX_SPORTS_PER_RUN,
      settlementsPerRun: MAX_SETTLEMENTS_PER_RUN
    },
    generatedAt: startedAt.toISOString()
  };
}

export const SETTLEMENT_MONITOR_LIMITS = {
  usersPerRun: MAX_USERS_PER_RUN,
  openBetsPerUser: MAX_OPEN_BETS_PER_USER,
  sportsPerRun: MAX_SPORTS_PER_RUN,
  settlementsPerRun: MAX_SETTLEMENTS_PER_RUN
};
