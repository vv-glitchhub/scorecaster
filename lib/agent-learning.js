import { calculateCLV, calculateProfitLoss } from "./tracking-engine.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function createSegment() {
  return {
    bets: 0,
    decisions: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    totalStake: 0,
    profit: 0,
    clvSum: 0,
    clvCount: 0,
    brierSum: 0,
    brierCount: 0,
    expectedWins: 0,
    actualWins: 0
  };
}

function modelProbability(bet = {}) {
  const value = Number(
    bet.modelProbability ??
    bet.consensusProbability ??
    bet.raw_pick?.modelProbability
  );
  return Number.isFinite(value) && value > 0 && value < 1 ? value : null;
}

function updateSegment(segment, bet) {
  const result = bet.result;
  const stake = Math.max(0, finite(bet.stake));
  const profit = calculateProfitLoss({ stake, odds: bet.odds, result });

  segment.bets += 1;
  segment.totalStake += stake;
  segment.profit += profit;

  if (result === "win") segment.wins += 1;
  if (result === "loss") segment.losses += 1;
  if (result === "push") segment.pushes += 1;

  if (result === "win" || result === "loss") {
    segment.decisions += 1;
    const probability = modelProbability(bet);
    const outcome = result === "win" ? 1 : 0;
    if (probability !== null) {
      segment.brierSum += (probability - outcome) ** 2;
      segment.brierCount += 1;
      segment.expectedWins += probability;
      segment.actualWins += outcome;
    }
  }

  const closingOdds = Number(bet.closingOdds ?? bet.closing_odds);
  if (Number.isFinite(closingOdds) && closingOdds > 1) {
    segment.clvSum += calculateCLV({ odds: bet.odds, closingOdds });
    segment.clvCount += 1;
  }
}

function finalize(segment) {
  const decisionCount = Math.max(0, segment.decisions);
  const expectedWinRate = segment.brierCount > 0
    ? segment.expectedWins / segment.brierCount
    : null;
  const actualWinRate = segment.brierCount > 0
    ? segment.actualWins / segment.brierCount
    : null;

  return {
    ...segment,
    winRate: decisionCount > 0 ? segment.wins / decisionCount : 0,
    roi: segment.totalStake > 0 ? segment.profit / segment.totalStake : 0,
    averageClv: segment.clvCount > 0 ? segment.clvSum / segment.clvCount : null,
    brierScore: segment.brierCount > 0 ? segment.brierSum / segment.brierCount : null,
    expectedWinRate,
    actualWinRate,
    calibrationGap: expectedWinRate !== null && actualWinRate !== null
      ? actualWinRate - expectedWinRate
      : null
  };
}

export function calculateAgentPerformance(bets = []) {
  const settled = (Array.isArray(bets) ? bets : []).filter((bet) =>
    ["win", "loss", "push"].includes(bet.result)
  );

  const overall = createSegment();
  const bySport = {};
  const byMarket = {};

  settled.forEach((bet) => {
    const sport = bet.sportKey || bet.league || "unknown";
    const market = bet.marketKey || bet.market || "unknown";

    if (!bySport[sport]) bySport[sport] = createSegment();
    if (!byMarket[market]) byMarket[market] = createSegment();

    updateSegment(overall, bet);
    updateSegment(bySport[sport], bet);
    updateSegment(byMarket[market], bet);
  });

  return {
    ...finalize(overall),
    sampleSize: settled.length,
    bySport: Object.fromEntries(
      Object.entries(bySport).map(([key, value]) => [key, finalize(value)])
    ),
    byMarket: Object.fromEntries(
      Object.entries(byMarket).map(([key, value]) => [key, finalize(value)])
    )
  };
}
