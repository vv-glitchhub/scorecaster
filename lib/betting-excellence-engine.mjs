import { getConsensusPrices, clamp } from "./market-consensus-engine.mjs";

const KELLY_MULTIPLIERS = {
  conservative: 0.1,
  quarter: 0.25,
  half: 0.5,
  full: 1
};

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

function impliedProbability(odds) {
  const numericOdds = Number(odds);
  return numericOdds > 1 ? 1 / numericOdds : 0;
}

function kellyFraction(odds, probability) {
  const price = Number(odds);
  const p = Number(probability);
  if (!Number.isFinite(price) || price <= 1 || !Number.isFinite(p) || p <= 0 || p >= 1) return 0;
  const b = price - 1;
  return Math.max(0, ((b * p) - (1 - p)) / b);
}

function classifyDecision({ edge, ev, confidence, bookmakerCount, freshnessLabel }) {
  const stale = freshnessLabel === "stale";
  const playableData = bookmakerCount >= 4 && confidence >= 0.55 && !stale;
  const watchableData = bookmakerCount >= 2 && confidence >= 0.35 && !stale;

  if (playableData && edge >= 0.02 && ev >= 0.03) return "PLAY";
  if (watchableData && edge >= 0.005 && ev > 0) return "CAUTION";
  return "SKIP";
}

function decisionReason({ decision, edge, ev, confidence, bookmakerCount, freshnessLabel }) {
  if (freshnessLabel === "stale") return "Markkinadata on vanhentunutta.";
  if (bookmakerCount < 2) return "Konsensuksessa on liian vähän vedonvälittäjiä.";
  if (confidence < 0.35) return "Vedonvälittäjien hinnat tai datan tuoreus eivät anna riittävää luottamusta.";
  if (ev <= 0 || edge < 0.005) return "Paras hinta ei ylitä no-vig-markkinakonsensusta riittävästi.";
  if (decision === "CAUTION") return "Hinnassa on pieni etu, mutta aineisto tai etu ei täytä PLAY-rajaa.";
  if (decision === "PLAY") return "Hinta, konsensus, kattavuus ja tuoreus täyttävät Scorecasterin PLAY-portin.";
  return "Kohde ei täytä paperiseurannan laatukynnystä.";
}

export function analyzeConsensusSelection(selection, options = {}) {
  const bankroll = boundedNumber(options.bankroll, 1000, 0, 10_000_000);
  const maxStakePercent = boundedNumber(options.maxStakePercent, 2, 0.1, 10);
  const kellyMode = KELLY_MULTIPLIERS[options.kellyMode] ? options.kellyMode : "quarter";
  const probability = boundedNumber(selection?.consensusProbability, 0, 0, 1);
  const odds = boundedNumber(selection?.odds ?? selection?.bestOdds, 0, 0, 10_000);
  const marketProbability = impliedProbability(odds);
  const edge = probability - marketProbability;
  const ev = odds > 1 ? (odds * probability) - 1 : 0;
  const confidence = boundedNumber(selection?.confidence, 0, 0, 1);
  const bookmakerCount = Math.max(0, Math.round(Number(selection?.bookmakerCount || 0)));
  const freshnessLabel = selection?.freshnessLabel || "unknown";
  const decision = classifyDecision({ edge, ev, confidence, bookmakerCount, freshnessLabel });
  const rawKelly = kellyFraction(odds, probability);
  const adjustedKelly = rawKelly * KELLY_MULTIPLIERS[kellyMode];
  const hardCap = bankroll * maxStakePercent / 100;
  const cautionMultiplier = decision === "CAUTION" ? 0.5 : 1;
  const suggestedStake = decision === "SKIP"
    ? 0
    : Math.min(bankroll * adjustedKelly * cautionMultiplier, hardCap);

  return {
    ...selection,
    odds,
    consensusProbability: probability,
    marketProbability,
    edge,
    ev,
    confidence,
    bookmakerCount,
    freshnessLabel,
    decision,
    decisionReason: decisionReason({ decision, edge, ev, confidence, bookmakerCount, freshnessLabel }),
    fairOdds: probability > 0 ? 1 / probability : 0,
    rawKelly,
    adjustedKelly,
    kellyMode,
    maxStakePercent,
    suggestedStake: Number(suggestedStake.toFixed(2)),
    paperOnly: true,
    modelMode: "market-consensus",
    edgeType: "best-price-vs-no-vig-consensus"
  };
}

export function analyzeBettingGame(game, marketKey = "h2h", options = {}) {
  const selections = getConsensusPrices(game, marketKey, options.now)
    .map((selection) => analyzeConsensusSelection(selection, options));

  return {
    id: game?.id || null,
    sportKey: game?.sport_key || null,
    sportTitle: game?.sport_title || game?.sport_key || "Sport",
    homeTeam: game?.home_team || "Home",
    awayTeam: game?.away_team || "Away",
    commenceTime: game?.commence_time || null,
    marketKey,
    bookmakerCount: Math.max(0, ...selections.map((selection) => selection.bookmakerCount)),
    selections
  };
}

export function analyzeBettingGames(games = [], marketKey = "h2h", options = {}) {
  return (Array.isArray(games) ? games : [])
    .map((game) => analyzeBettingGame(game, marketKey, options))
    .filter((game) => game.selections.length >= 2);
}
