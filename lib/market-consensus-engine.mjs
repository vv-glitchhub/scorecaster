const MIN_ODDS = 1.001;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function median(values = []) {
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

export function standardDeviation(values = []) {
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

function validMarketOutcomes(bookmaker, marketKey) {
  const market = bookmaker?.markets?.find((item) => item.key === marketKey);
  const outcomes = Array.isArray(market?.outcomes)
    ? market.outcomes
        .map((outcome) => ({
          ...outcome,
          odds: Number(outcome.price),
          selection: selectionName(outcome)
        }))
        .filter((outcome) => outcome.selection && outcome.odds >= MIN_ODDS)
    : [];

  return { market, outcomes };
}

export function freshnessFromTimestamp(timestamp, now = Date.now()) {
  if (!timestamp) return { label: "unknown", ageHours: null, score: 0.45 };

  const ageHours = Math.max(0, (now - timestamp) / 3_600_000);
  if (ageHours <= 0.5) return { label: "fresh", ageHours, score: 1 };
  if (ageHours <= 3) return { label: "recent", ageHours, score: 0.85 };
  if (ageHours <= 12) return { label: "aging", ageHours, score: 0.55 };
  return { label: "stale", ageHours, score: 0.2 };
}

export function confidenceLabel(score) {
  if (score >= 0.8) return "High";
  if (score >= 0.62) return "Medium-high";
  if (score >= 0.45) return "Medium";
  if (score >= 0.3) return "Low-medium";
  return "Low";
}

export function calculateDataConfidence({ bookmakerCount, dispersion, freshnessScore }) {
  const coverage = clamp(Number(bookmakerCount || 0) / 8, 0, 1);
  const agreement = 1 - clamp(Number(dispersion || 0) / 0.08, 0, 1);
  const freshness = clamp(Number(freshnessScore || 0), 0, 1);

  return clamp((coverage * 0.5) + (agreement * 0.3) + (freshness * 0.2), 0.05, 0.95);
}

export function getBookmakerCatalog(games = [], marketKey = "h2h") {
  const catalog = new Map();

  for (const game of Array.isArray(games) ? games : []) {
    for (const bookmaker of Array.isArray(game?.bookmakers) ? game.bookmakers : []) {
      const { market, outcomes } = validMarketOutcomes(bookmaker, marketKey);
      if (outcomes.length < 2) continue;

      const key = bookmaker.key || bookmaker.title;
      if (!key) continue;

      const timestamp = parseTimestamp(market?.last_update || bookmaker.last_update);
      const current = catalog.get(key) || {
        key,
        title: bookmaker.title || bookmaker.key,
        eventCount: 0,
        offerCount: 0,
        latestTimestamp: null
      };

      current.eventCount += 1;
      current.offerCount += outcomes.length;
      if (timestamp && (!current.latestTimestamp || timestamp > current.latestTimestamp)) {
        current.latestTimestamp = timestamp;
      }
      catalog.set(key, current);
    }
  }

  return [...catalog.values()]
    .map((item) => ({
      key: item.key,
      title: item.title,
      eventCount: item.eventCount,
      offerCount: item.offerCount,
      latestUpdate: item.latestTimestamp ? new Date(item.latestTimestamp).toISOString() : null
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getConsensusPrices(game, marketKey = "h2h", now = Date.now()) {
  const selections = new Map();
  const bookmakers = Array.isArray(game?.bookmakers) ? game.bookmakers : [];

  for (const bookmaker of bookmakers) {
    const { market, outcomes } = validMarketOutcomes(bookmaker, marketKey);
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
      const freshness = freshnessFromTimestamp(item.latestTimestamp, now);
      const dispersion = standardDeviation(probabilities);
      const bookmakerCount = new Set(item.samples.map((sample) => sample.bookmakerKey)).size;
      const consensusProbability = clamp(median(probabilities), 0.01, 0.99);
      const confidence = calculateDataConfidence({
        bookmakerCount,
        dispersion,
        freshnessScore: freshness.score
      });
      const offers = item.samples
        .map((sample) => ({
          bookmaker: sample.bookmaker,
          bookmakerKey: sample.bookmakerKey,
          odds: sample.odds,
          fairProbability: sample.fairProbability,
          overround: sample.overround,
          timestamp: sample.timestamp ? new Date(sample.timestamp).toISOString() : null
        }))
        .sort((a, b) => b.odds - a.odds);

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
        offers,
        samples: offers.length
      };
    })
    .filter((item) => item.odds >= MIN_ODDS)
    .sort((a, b) => b.odds - a.odds);
}

export function estimateConsensusProbability({ odds, consensusProbability }) {
  const consensus = Number(consensusProbability);
  if (Number.isFinite(consensus) && consensus > 0 && consensus < 1) {
    return consensus;
  }

  const numericOdds = Number(odds);
  return numericOdds > 1 ? 1 / numericOdds : 0;
}
