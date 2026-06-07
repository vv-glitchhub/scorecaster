export async function fetchFinalScores({ origin, sports = [] } = {}) {
  const baseOrigin = origin || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const scores = {};
  const errors = [];

  for (const sport of sports) {
    try {
      const response = await fetch(`${baseOrigin}/api/odds?sport=${sport}&markets=h2h`, { cache: "no-store" });
      const data = await response.json();
      const games = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      for (const game of games) {
        const completed = Boolean(game.completed || game.status === "completed" || game.status === "final");
        const homeScore = Number(game.home_score ?? game.homeScore ?? game.scores?.home);
        const awayScore = Number(game.away_score ?? game.awayScore ?? game.scores?.away);

        if (completed && Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
          scores[game.id] = {
            homeScore,
            awayScore,
            source: data?.source || "odds-api",
            sport
          };
        }
      }
    } catch (error) {
      errors.push({ sport, error: error.message });
    }
  }

  return {
    ok: true,
    source: "score-fetcher-v1",
    count: Object.keys(scores).length,
    scores,
    errors
  };
}
