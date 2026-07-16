import { analyzeBet } from "./analysis-engine";

const MIN_ODDS = 1.001;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function median(values = []) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length < 2) return 0;
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const variance = numbers.reduce((sum, value) => sum + ((value - average) ** 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

function selectionName(outcome = {}) {
  return outcome.point !== undefined
    ? `${outcome.name} ${outcome.point}`
    : outcome.name;
}

function parseTimestamp(value) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}

function freshnessFromTimestamp(timestamp) {
  if (!timestamp) return { label: "unknown", ageHours: null, score: 0.45 };

  const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (ageHours <= 0.5) return { label: "fresh", ageHours, score: 1 };
  if (ageHours <= 3) return { label: "recent", ageHours, score: 0.85 };
  if (ageHours <= 12) return { label: "aging", ageHours, score: 0.55 };
  return { label: "stale", ageHours, score: 0.2 };
}

function confidenceLabel(score) {
  if (score >= 0.8) return "High";
  if (score >= 0.62) return "Medium-high";
  if (score >= 0.45) return "Medium";
  if (score >= 0.3) return "Low-medium";
  return "Low";
}

function calculateDataConfidence({ bookmakerCount, dispersion, freshnessScore }) {
  const coverage = clamp(Number(bookmakerCount || 0) / 8, 0, 1);
  const agreement = 1 - clamp(Number(dispersion || 0) / 0.08, 0, 1);
  const freshness = clamp(Number(freshnessScore || 0), 0, 1);

  return clamp((coverage * 0.5) + (agreement * 0.3) + (freshness * 0.2), 0.05, 0.95);
}

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

export function getConsensusPrices(game, marketKey = "h2h") {
  const selections = new Map();
  const bookmakers = Array.isArray(game?.bookmakers) ? game.bookmakers : [];

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets?.find((item) => item.key === marketKey);
    const outcomes = Array.isArray(market?.outcomes)
      ? market.outcomes
          .map((outcome) => ({
            ...outcome,
            odds: Number(outcome.price),
            selection: selectionName(outcome)
          }))
          .filter((outcome) => outcome.selection && outcome.odds >= MIN_ODDS)
      : [];

    if (outcomes.length < 2) continue;

    const impliedTotal = outcomes.reduce((sum, outcome) => sum + (1 / outcome.odds), 0);
    if (!Number.isFinite(impliedTotal) || impliedTotal <= 0) continue;

    const timestamp = parseTimestamp(market?.last_update || bookmaker.last_update);

    for (const outcome of outcomes) {
      const fairProbability = (1 / outcome.odds) / impliedTotal;
      const current = selections.get(outcome.selection) || {
        selection: outcome.selection,
        point: outcome.point ?? null,
        samples: [],
        bestOdds: 0,
        bookmaker: null,
        bookmakerKey: null,
        latestTimestamp: null
      };

      current.samples.push({
        bookmaker: bookmaker.title || bookmaker.key,
        bookmakerKey: bookmaker.key,
        odds: outcome.odds,
        fairProbability,
        overround: impliedTotal - 1,
        timestamp
      });

      if (outcome.odds > current.bestOdds) {
        current.bestOdds = outcome.odds;
        current.bookmaker = bookmaker.title || bookmaker.key;
        current.bookmakerKey = bookmaker.key;
      }

      if (timestamp && (!current.latestTimestamp || timestamp > current.latestTimestamp)) {
        current.latestTimestamp = timestamp;
      }

      selections.set(outcome.selection, current);
    }
  }

  return [...selections.values()]
    .map((item) => {
      const probabilities = item.samples.map((sample) => sample.fairProbability);
      const odds = item.samples.map((sample) => sample.odds);
      const overrounds = item.samples.map((sample) => sample.overround);
      const freshness = freshnessFromTimestamp(item.latestTimestamp);
      const dispersion = standardDeviation(probabilities);
      const bookmakerCount = new Set(item.samples.map((sample) => sample.bookmakerKey)).size;
      const consensusProbability = clamp(median(probabilities), 0.01, 0.99);
      const confidence = calculateDataConfidence({
        bookmakerCount,
        dispersion,
        freshnessScore: freshness.score
      });

      return {
        selection: item.selection,
        point: item.point,
        odds: item.bestOdds,
        bestOdds: item.bestOdds,
        bookmaker: item.bookmaker,
        bookmakerKey: item.bookmakerKey,
        averageOdds: odds.length ? odds.reduce((sum, value) => sum + value, 0) / odds.length : 0,
        consensusProbability,
        fairOdds: consensusProbability > 0 ? 1 / consensusProbability : 0,
        bookmakerCount,
        probabilityDispersion: dispersion,
        averageOverround: overrounds.length
          ? overrounds.reduce((sum, value) => sum + value, 0) / overrounds.length
          : 0,
        latestUpdate: item.latestTimestamp ? new Date(item.latestTimestamp).toISOString() : null,
        freshnessLabel: freshness.label,
        ageHours: freshness.ageHours,
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        samples: item.samples.length
      };
    })
    .filter((item) => item.odds >= MIN_ODDS)
    .sort((a, b) => b.odds - a.odds);
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
  const consensus = Number(consensusProbability);
  if (Number.isFinite(consensus) && consensus > 0 && consensus < 1) {
    return consensus;
  }

  const numericOdds = Number(odds);
  return numericOdds > 1 ? 1 / numericOdds : 0;
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
