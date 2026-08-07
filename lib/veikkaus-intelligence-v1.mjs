import {
  TULOSVETO_DEFAULT_RETURN_RATE,
  estimatePoolShareFromOdds,
} from "./veikkaus-pool-games.mjs";

export const VEIKKAUS_INTELLIGENCE_VERSION = "veikkaus-intelligence-v1.0";

const round = (value, digits = 6) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const probability = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number >= 1) throw new Error(`${label} must be between 0 and 1`);
  return number;
};

const positive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number`);
  return number;
};

const normalizedLabel = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ");

const MARKET_RULES = [
  { market: "draw_no_bet", terms: ["tasapeli ei vetoa"] },
  { market: "double_chance", terms: ["tuplamerkki"] },
  { market: "half_full_time", terms: ["puoliaika/lopputulos", "puoliaika / lopputulos"] },
  { market: "both_teams_to_score", terms: ["molemmat joukkueet tekevät maalin"] },
  { market: "winning_margin", terms: ["voittajamarginaali"] },
  { market: "goalscorer", terms: ["maalintekijä", "maalintekija"] },
  { market: "corners", terms: ["kulmapotkut"] },
  { market: "totals", terms: ["maalit yli/alle", "yli/alle"] },
  { market: "handicap", terms: ["tasoitus"] },
  { market: "correct_score", terms: ["lopputulos"] },
  { market: "h2h_1x2", terms: ["voittaja (1x2)", "voittaja 1x2", "1x2"] },
];

export function mapVeikkausMarketLabel(label) {
  const sourceLabel = String(label ?? "").trim();
  const normalized = normalizedLabel(sourceLabel);
  const match = MARKET_RULES.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  return Object.freeze({
    source: "veikkaus",
    sourceLabel,
    canonicalMarket: match?.market ?? null,
    supported: Boolean(match),
  });
}

export function analyzeFixedOddsSelection({ decimalOdds, modelProbability, benchmarkProbability = null }) {
  const odds = positive(decimalOdds, "decimalOdds");
  if (odds <= 1) throw new Error("decimalOdds must be greater than 1");
  const model = probability(modelProbability, "modelProbability");
  const implied = 1 / odds;
  const fairOdds = 1 / model;
  const expectedValue = model * odds - 1;
  const benchmark = benchmarkProbability == null ? null : probability(benchmarkProbability, "benchmarkProbability");

  return Object.freeze({
    version: VEIKKAUS_INTELLIGENCE_VERSION,
    type: "fixed_odds",
    decimalOdds: round(odds),
    modelProbability: round(model),
    impliedProbability: round(implied),
    fairOdds: round(fairOdds),
    edgeProbability: round(model - implied),
    expectedValue: round(expectedValue),
    expectedReturnPerUnit: round(1 + expectedValue),
    benchmarkProbability: benchmark == null ? null : round(benchmark),
    modelVsBenchmark: benchmark == null ? null : round(model - benchmark),
    valueState: expectedValue > 0.01 ? "positive" : expectedValue < -0.01 ? "negative" : "near_fair",
    paperOnly: true,
  });
}

export function analyzePoolPopularity({ modelProbability, playedShare }) {
  const model = probability(modelProbability, "modelProbability");
  const crowd = probability(playedShare, "playedShare");
  const difference = model - crowd;
  const ratio = model / crowd;

  return Object.freeze({
    version: VEIKKAUS_INTELLIGENCE_VERSION,
    type: "pool_popularity",
    modelProbability: round(model),
    playedShare: round(crowd),
    difference: round(difference),
    valueRatio: round(ratio),
    popularityState: difference > 0.02 ? "underplayed" : difference < -0.02 ? "overplayed" : "balanced",
    expectedValue: null,
    expectedValueReason: "pool_return_rate_not_supplied",
    paperOnly: true,
  });
}

export function analyzeTulosvetoSelection({
  modelProbability,
  observedOdds = null,
  playedShare = null,
  returnRate = TULOSVETO_DEFAULT_RETURN_RATE,
}) {
  const model = probability(modelProbability, "modelProbability");
  const rate = Number(returnRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) throw new Error("returnRate must be in (0, 1]");

  let share = playedShare == null ? null : probability(playedShare, "playedShare");
  let odds = observedOdds == null ? null : positive(observedOdds, "observedOdds");
  if (odds != null && odds <= 1) throw new Error("observedOdds must be greater than 1");
  if (share == null && odds == null) throw new Error("observedOdds or playedShare is required");
  if (share == null) share = estimatePoolShareFromOdds({ odds, returnRate: rate });
  if (odds == null) odds = rate / share;

  const expectedValue = model * odds - 1;
  return Object.freeze({
    version: VEIKKAUS_INTELLIGENCE_VERSION,
    type: "tulosveto_pool",
    modelProbability: round(model),
    estimatedPlayedShare: round(share),
    observedOrEstimatedOdds: round(odds),
    returnRate: round(rate),
    fairOdds: round(1 / model),
    probabilityDifference: round(model - share),
    expectedValue: round(expectedValue),
    valueState: expectedValue > 0.01 ? "positive" : expectedValue < -0.01 ? "negative" : "near_fair",
    paperOnly: true,
  });
}

export function rankVakioMarks(marks) {
  if (!Array.isArray(marks) || marks.length === 0) throw new Error("marks must be a non-empty array");
  const allowed = new Set(["1", "X", "2"]);
  const rows = marks.map((item) => {
    const mark = String(item?.mark ?? "").toUpperCase();
    if (!allowed.has(mark)) throw new Error("Vakio mark must be 1, X or 2");
    const analysis = analyzePoolPopularity({
      modelProbability: item?.modelProbability,
      playedShare: item?.playedShare,
    });
    return Object.freeze({ mark, ...analysis });
  });
  return Object.freeze([...rows].sort((a, b) => b.valueRatio - a.valueRatio));
}

export function createVeikkausIntelligenceBoundary() {
  return Object.freeze({
    version: VEIKKAUS_INTELLIGENCE_VERSION,
    paperOnly: true,
    veikkausAccountConnection: false,
    betPlacement: false,
    cashOut: false,
    moneyMovement: false,
    liveDataScraping: false,
    externalSourceConnected: false,
    purpose: "read_only_analysis_and_manual_snapshot_comparison",
  });
}
