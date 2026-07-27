import { createHash } from "node:crypto";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const average = (values = []) => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
const clean = (value, limit = 180) => String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);

function seeded(seed) {
  let state = Number.parseInt(createHash("sha256").update(String(seed)).digest("hex").slice(0, 8), 16) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function latestByMetric(records = []) {
  const map = new Map();
  for (const record of records) {
    const key = clean(record.metric, 120);
    if (!key) continue;
    const previous = map.get(key);
    if (!previous || new Date(record.observedAt || 0) > new Date(previous.observedAt || 0)) map.set(key, record);
  }
  return map;
}

export function buildModelRegistry(events = []) {
  const candidates = [
    { id: "market-consensus", label: "Market consensus", metric: "market_probability", weight: 0.45 },
    { id: "scorecaster-model", label: "Scorecaster model", metric: "model_probability", weight: 0.35 },
    { id: "simulation", label: "Scenario simulation", metric: "simulation_probability", weight: 0.2 }
  ];
  return candidates.map((model) => {
    const values = [];
    const confidences = [];
    for (const event of events) {
      const row = latestByMetric(event.records).get(model.metric);
      if (row?.value !== null && row?.value !== undefined) values.push(clamp(row.value));
      if (row) confidences.push(clamp(row.confidence));
    }
    const coverage = events.length ? values.length / events.length : 0;
    const stability = values.length > 1 ? 1 - Math.min(1, Math.sqrt(average(values.map((value) => (value - average(values)) ** 2))) * 2) : coverage;
    const score = clamp(coverage * 0.55 + average(confidences) * 0.3 + stability * 0.15);
    return { ...model, observations: values.length, coverage: round(coverage), confidence: round(average(confidences)), stability: round(stability), score: round(score), grade: score >= 0.85 ? "A" : score >= 0.7 ? "B" : score >= 0.55 ? "C" : score >= 0.4 ? "D" : "E" };
  });
}

export function buildMatchupGraph(events = []) {
  const nodes = new Map();
  const edges = [];
  for (const event of events) {
    const snapshot = latestByMetric(event.records).get("event_snapshot")?.payload || {};
    const home = clean(snapshot.homeTeam || event.homeTeam || "Home");
    const away = clean(snapshot.awayTeam || event.awayTeam || "Away");
    if (!home || !away) continue;
    const metrics = latestByMetric(event.records);
    const probability = clamp(metrics.get("model_probability")?.value ?? metrics.get("market_probability")?.value ?? 0.5);
    for (const name of [home, away]) {
      const node = nodes.get(name) || { id: name, games: 0, strengthSum: 0, confidenceSum: 0 };
      node.games += 1;
      node.strengthSum += name === home ? probability : 1 - probability;
      node.confidenceSum += average(event.records.map((row) => clamp(row.confidence)));
      nodes.set(name, node);
    }
    edges.push({ eventId: event.eventId, home, away, homeProbability: round(probability), awayProbability: round(1 - probability), edge: round(Math.abs(probability - 0.5) * 2) });
  }
  return {
    nodes: [...nodes.values()].map((node) => ({ id: node.id, games: node.games, strength: round(node.strengthSum / node.games), confidence: round(node.confidenceSum / node.games) })).sort((a, b) => b.strength - a.strength),
    edges: edges.sort((a, b) => b.edge - a.edge)
  };
}

export function simulateDigitalTwin(events = [], options = {}) {
  const iterations = Math.max(500, Math.min(50000, Number(options.iterations || 5000)));
  const graph = buildMatchupGraph(events);
  const teams = graph.nodes.map((node) => node.id);
  if (teams.length < 2 || !graph.edges.length) return { iterations, teams: [], champion: null, caveat: "Not enough attributed event data for a digital twin." };
  const wins = new Map(teams.map((team) => [team, 0]));
  const titleWins = new Map(teams.map((team) => [team, 0]));
  const random = seeded(options.seed || events.map((event) => event.eventId).join("|"));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const table = new Map(teams.map((team) => [team, 0]));
    for (const edge of graph.edges) {
      const winner = random() < edge.homeProbability ? edge.home : edge.away;
      table.set(winner, (table.get(winner) || 0) + 1);
      wins.set(winner, (wins.get(winner) || 0) + 1);
    }
    const champion = [...table.entries()].sort((a, b) => b[1] - a[1] || random() - 0.5)[0]?.[0];
    if (champion) titleWins.set(champion, (titleWins.get(champion) || 0) + 1);
  }
  const gamesPerIteration = graph.edges.length;
  const table = teams.map((team) => ({ team, expectedWinRate: round((wins.get(team) || 0) / (iterations * gamesPerIteration)), titleProbability: round((titleWins.get(team) || 0) / iterations) })).sort((a, b) => b.titleProbability - a.titleProbability);
  return { iterations, gamesPerIteration, teams: table, champion: table[0] || null, caveat: "Scenario twin uses only available Scorecaster event probabilities; it is not an official league schedule model." };
}

export function backtestStrategies(events = [], bankroll = 1000) {
  const strategies = [
    { id: "flat-1", label: "Flat 1%", fraction: () => 0.01 },
    { id: "edge-scaled", label: "Edge scaled", fraction: (edge) => clamp(edge * 0.25, 0, 0.025) },
    { id: "quarter-kelly", label: "Quarter Kelly", fraction: (edge, odds) => clamp(((odds * (0.5 + edge) - 1) / Math.max(0.01, odds - 1)) * 0.25, 0, 0.03) }
  ];
  const opportunities = [];
  for (const event of events) {
    const metrics = latestByMetric(event.records);
    const market = clamp(metrics.get("market_probability")?.value ?? 0.5);
    const model = clamp(metrics.get("model_probability")?.value ?? market);
    const odds = Number(metrics.get("best_odds")?.value || (market > 0 ? 1 / market : 2));
    const edge = model - market;
    if (Number.isFinite(odds) && odds > 1 && edge > 0) opportunities.push({ eventId: event.eventId, market, model, odds, edge });
  }
  return strategies.map((strategy) => {
    let balance = bankroll;
    let peak = bankroll;
    let maxDrawdown = 0;
    let totalStake = 0;
    for (const opportunity of opportunities) {
      const fraction = strategy.fraction(opportunity.edge, opportunity.odds);
      const stake = balance * fraction;
      const expectedProfit = stake * (opportunity.model * (opportunity.odds - 1) - (1 - opportunity.model));
      balance += expectedProfit;
      totalStake += stake;
      peak = Math.max(peak, balance);
      maxDrawdown = Math.max(maxDrawdown, peak ? (peak - balance) / peak : 0);
    }
    return { ...strategy, opportunities: opportunities.length, startingBankroll: bankroll, endingExpectedBankroll: round(balance, 2), expectedProfit: round(balance - bankroll, 2), roiOnStake: round(totalStake ? (balance - bankroll) / totalStake : 0), maxExpectedDrawdown: round(maxDrawdown), paperOnly: true };
  }).sort((a, b) => b.endingExpectedBankroll - a.endingExpectedBankroll);
}

export function buildRiskSignals(events = [], modelRegistry = buildModelRegistry(events)) {
  const signals = [];
  const lowCoverage = modelRegistry.filter((model) => model.coverage < 0.5);
  if (lowCoverage.length) signals.push({ severity: "warning", code: "MODEL_COVERAGE", message: `${lowCoverage.length} model layers have under 50% coverage.` });
  const singleSourceEvents = events.filter((event) => new Set(event.records.map((row) => row.sourceId)).size < 2).length;
  if (singleSourceEvents) signals.push({ severity: "warning", code: "SINGLE_SOURCE", message: `${singleSourceEvents} events rely on a single source.` });
  const stale = events.filter((event) => Date.now() - Math.max(...event.records.map((row) => new Date(row.observedAt || 0).getTime())) > 12 * 60 * 60 * 1000).length;
  if (stale) signals.push({ severity: "critical", code: "STALE_EVENTS", message: `${stale} events have no observation newer than 12 hours.` });
  const lowTrust = events.flatMap((event) => event.records).filter((row) => clamp(row.sourceTrust) < 0.6).length;
  if (lowTrust) signals.push({ severity: "warning", code: "LOW_TRUST", message: `${lowTrust} observations have source trust below 0.60.` });
  if (!signals.length) signals.push({ severity: "info", code: "NO_ACTIVE_RISK", message: "No derived V4 risk signals in the selected window." });
  return signals;
}

export function buildIntelligenceV4(events = [], options = {}) {
  const models = buildModelRegistry(events);
  const graph = buildMatchupGraph(events);
  return {
    version: "scorecaster-intelligence-v4",
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    modelRegistry: models,
    matchupGraph: graph,
    digitalTwin: simulateDigitalTwin(events, options),
    backtest: backtestStrategies(events, Number(options.bankroll || 1000)),
    riskSignals: buildRiskSignals(events, models),
    safety: { publishableOnly: true, researchDataExcluded: true, paperOnly: true, probabilityChanged: false, officialScheduleModel: false }
  };
}
