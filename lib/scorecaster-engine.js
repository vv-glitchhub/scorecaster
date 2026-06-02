import { analyzeBet } from "./analysis-engine";

export function normalizeOddsGame(game, marketKey = "h2h") {
  const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

  return {
    id: game.id,
    sportKey: game.sport_key,
    sportTitle: game.sport_title,
    commenceTime: game.commence_time,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    marketKey,
    bookmakers
  };
}

export function getBestOdds(game, marketKey = "h2h") {
  const selections = {};

  const bookmakers = Array.isArray(game.bookmakers) ? game.bookmakers : [];

  bookmakers.forEach((bookmaker) => {
    const market = bookmaker.markets?.find((item) => item.key === marketKey);
    if (!market) return;

    market.outcomes?.forEach((outcome) => {
      const selection =
        outcome.point !== undefined
          ? `${outcome.name} ${outcome.point}`
          : outcome.name;

      const odds = Number(outcome.price);
      if (!odds || odds <= 1) return;

      if (!selections[selection] || odds > selections[selection].odds) {
        selections[selection] = {
          selection,
          odds,
          point: outcome.point ?? null,
          bookmaker: bookmaker.title || bookmaker.key,
          bookmakerKey: bookmaker.key,
          lastUpdate: market.last_update || bookmaker.last_update || null
        };
      }
    });
  });

  return Object.values(selections).sort((a, b) => b.odds - a.odds);
}

export function estimateModelProbability({ odds, selection, homeTeam, awayTeam }) {
  const marketProbability = odds > 1 ? 1 / odds : 0;

  let adjustment = 0.03;

  if (selection === homeTeam) adjustment += 0.02;
  if (selection === awayTeam) adjustment += 0.01;

  return Math.min(0.75, Math.max(0.05, marketProbability + adjustment));
}

export function createScorecasterPick({
  game,
  marketKey = "h2h",
  bankroll = 1000,
  kellyMode = "quarter"
}) {
  const bestOdds = getBestOdds(game, marketKey);

  return bestOdds.map((item) => {
    const modelProbability = estimateModelProbability({
      odds: item.odds,
      selection: item.selection,
      homeTeam: game.home_team,
      awayTeam: game.away_team
    });

    const analysis = analyzeBet({
      selection: item.selection,
      decimalOdds: item.odds,
      modelProbability,
      volatility: "medium",
      bankroll,
      kellyMode
    });

    return {
      id: `${game.id}-${marketKey}-${item.selection}`,
      gameId: game.id,
      sportKey: game.sport_key,
      sportTitle: game.sport_title,
      commenceTime: game.commence_time,
      match: `${game.home_team || "Home"} vs ${game.away_team || "Away"}`,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      marketKey,
      selection: item.selection,
      odds: item.odds,
      bookmaker: item.bookmaker,
      bookmakerKey: item.bookmakerKey,
      point: item.point,
      modelProbability,
      marketProbability: analysis.marketProbability,
      edge: analysis.edge,
      ev: analysis.ev,
      confidence: analysis.confidence,
      suggestedStake: analysis.suggestedStake,
      kellyMode
    };
  });
}

export function createTopPicksFromGames({
  games = [],
  marketKey = "h2h",
  bankroll = 1000,
  kellyMode = "quarter",
  minEdge = 0.01,
  limit = 20
}) {
  return games
    .flatMap((game) =>
      createScorecasterPick({
        game,
        marketKey,
        bankroll,
        kellyMode
      })
    )
    .filter((pick) => pick.edge >= minEdge)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, limit);
}

export function summarizePicks(picks = []) {
  const best = picks[0];

  const averageEdge =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.edge || 0), 0) /
        picks.length
      : 0;

  const averageEV =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.ev || 0), 0) /
        picks.length
      : 0;

  return {
    count: picks.length,
    bestPick: best || null,
    averageEdge,
    averageEV
  };
}
