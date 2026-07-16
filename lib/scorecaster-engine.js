import { analyzeBet } from "./analysis-engine";
import {
  estimateConsensusProbability,
  getConsensusPrices
} from "./market-consensus-engine.mjs";

export { getConsensusPrices } from "./market-consensus-engine.mjs";

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
  return getConsensusPrices(game, marketKey).map((item) => ({
    selection: item.selection,
    odds: item.odds,
    point: item.point,
    bookmaker: item.bookmaker,
    bookmakerKey: item.bookmakerKey,
    lastUpdate: item.latestUpdate
  }));
}

export function estimateModelProbability({ odds, consensusProbability }) {
  return estimateConsensusProbability({ odds, consensusProbability });
}

export function createScorecasterPick({
  game,
  marketKey = "h2h",
  bankroll = 1000,
  kellyMode = "quarter"
}) {
  const consensusPrices = getConsensusPrices(game, marketKey);

  return consensusPrices.map((item) => {
    const modelProbability = estimateModelProbability({
      odds: item.odds,
      consensusProbability: item.consensusProbability
    });

    const analysis = analyzeBet({
      selection: item.selection,
      decimalOdds: item.odds,
      modelProbability,
      volatility: item.probabilityDispersion >= 0.04 ? "high" : "medium",
      bankroll,
      kellyMode
    });

    const confidence = item.confidence;
    const suggestedStake = Math.min(
      Number(analysis.suggestedStake || 0) * confidence,
      Number(bankroll || 0) * 0.02
    );

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
      bestOdds: item.bestOdds,
      averageOdds: item.averageOdds,
      fairOdds: item.fairOdds,
      bookmaker: item.bookmaker,
      bookmakerKey: item.bookmakerKey,
      point: item.point,
      modelProbability,
      consensusProbability: item.consensusProbability,
      marketProbability: analysis.marketProbability,
      edge: analysis.edge,
      ev: analysis.ev,
      confidence,
      confidenceLabel: item.confidenceLabel,
      suggestedStake,
      kelly: analysis.kelly,
      adjustedKelly: analysis.adjustedKelly,
      kellyMode,
      bookmakerCount: item.bookmakerCount,
      probabilityDispersion: item.probabilityDispersion,
      averageOverround: item.averageOverround,
      lastUpdate: item.latestUpdate,
      freshnessLabel: item.freshnessLabel,
      dataAgeHours: item.ageHours,
      dataQuality: {
        bookmakerCount: item.bookmakerCount,
        sampleCount: item.samples,
        probabilityDispersion: item.probabilityDispersion,
        averageOverround: item.averageOverround,
        freshness: item.freshnessLabel,
        ageHours: item.ageHours,
        confidence
      },
      modelMode: "market-consensus",
      edgeType: "best-price-vs-no-vig-consensus",
      explanation: "Probability is derived from a no-vig consensus across available bookmakers. Edge measures the best available price against that consensus, not a guaranteed prediction."
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
    .filter((pick) => pick.bookmakerCount >= 2 && pick.edge >= minEdge)
    .sort((a, b) => (b.edge * b.confidence) - (a.edge * a.confidence))
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

  const averageConfidence =
    picks.length > 0
      ? picks.reduce((sum, pick) => sum + Number(pick.confidence || 0), 0) /
        picks.length
      : 0;

  return {
    count: picks.length,
    bestPick: best || null,
    averageEdge,
    averageEV,
    averageConfidence,
    modelMode: "market-consensus"
  };
}
