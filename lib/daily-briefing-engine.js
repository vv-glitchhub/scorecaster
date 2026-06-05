export function createDailyAgentBriefing(picks = []) {
  const betPicks = picks.filter((pick) => pick.decision === "BET");
  const watchPicks = picks.filter((pick) => pick.decision === "WATCH");
  const waitPicks = picks.filter((pick) => pick.decision === "WAIT");
  const passPicks = picks.filter((pick) => pick.decision === "PASS");

  const bestPick = [...picks].sort(
    (a, b) => Number(b.finalScore || 0) - Number(a.finalScore || 0)
  )[0];

  const lowReadiness = picks.filter(
    (pick) => pick.readiness?.level === "Low"
  );

  const averageScore =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.finalScore || 0), 0) /
        picks.length
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    total: picks.length,
    betCount: betPicks.length,
    watchCount: watchPicks.length,
    waitCount: waitPicks.length,
    passCount: passPicks.length,
    lowReadinessCount: lowReadiness.length,
    averageScore,
    bestPick,
    summary:
      betPicks.length > 0
        ? "Agent found at least one bet-grade opportunity."
        : watchPicks.length > 0
        ? "Agent found watchlist value, but no clean bet yet."
        : "No strong opportunity detected right now."
  };
}
