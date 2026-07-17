import { calculateCLV, calculateProfitLoss } from "./tracking-engine.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function createdTime(bet = {}) {
  const value = bet.settledAt || bet.updatedAt || bet.updated_at || bet.createdAt || bet.created_at;
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : 0;
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

function summarizeRows(rows) {
  const segment = createSegment();
  rows.forEach((bet) => updateSegment(segment, bet));
  return finalize(segment);
}

function metricDelta(recent, baseline, key) {
  const a = recent?.[key];
  const b = baseline?.[key];
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const recentValue = Number(a);
  const baselineValue = Number(b);
  return Number.isFinite(recentValue) && Number.isFinite(baselineValue)
    ? recentValue - baselineValue
    : null;
}

export function calculateAgentDrift(bets = [], {
  recentSize = 20,
  minimumRecent = 12,
  minimumBaseline = 20,
  baselineLimit = 60
} = {}) {
  const settled = (Array.isArray(bets) ? bets : [])
    .filter((bet) => ["win", "loss", "push"].includes(bet.result))
    .slice()
    .sort((a, b) => createdTime(a) - createdTime(b));

  const recentRows = settled.slice(-recentSize);
  const baselineRows = settled.slice(
    Math.max(0, settled.length - recentRows.length - baselineLimit),
    Math.max(0, settled.length - recentRows.length)
  );
  const recent = summarizeRows(recentRows);
  const baseline = summarizeRows(baselineRows);

  if (recentRows.length < minimumRecent || baselineRows.length < minimumBaseline) {
    return {
      status: "insufficient",
      severity: 0,
      recentSize: recentRows.length,
      baselineSize: baselineRows.length,
      recent,
      baseline,
      deltas: {},
      reasons: ["Driftin arviointi vaatii vähintään 12 tuoretta ja 20 aiempaa ratkaistua paperikohdetta."],
      abstain: false,
      stakeMultiplier: 1
    };
  }

  const deltas = {
    roi: metricDelta(recent, baseline, "roi"),
    averageClv: metricDelta(recent, baseline, "averageClv"),
    brierScore: metricDelta(recent, baseline, "brierScore"),
    calibrationAbs: recent.calibrationGap !== null && baseline.calibrationGap !== null
      ? Math.abs(recent.calibrationGap) - Math.abs(baseline.calibrationGap)
      : null
  };
  const critical = [];
  const warning = [];

  if (recent.averageClv !== null && deltas.averageClv !== null) {
    if (recent.averageClv <= -0.02 && deltas.averageClv <= -0.02) {
      critical.push("Tuoreen jakson CLV on selvästi negatiivinen ja heikentynyt vertailujaksosta.");
    } else if (recent.averageClv <= -0.005 || deltas.averageClv <= -0.012) {
      warning.push("Tuoreen jakson CLV on heikentynyt.");
    }
  }

  if (recent.brierScore !== null && deltas.brierScore !== null) {
    if (recent.brierScore >= 0.31 && deltas.brierScore >= 0.07) {
      critical.push("Todennäköisyyksien Brier score on heikentynyt voimakkaasti.");
    } else if (recent.brierScore >= 0.28 || deltas.brierScore >= 0.04) {
      warning.push("Todennäköisyyksien tarkkuus on heikentynyt.");
    }
  }

  if (recent.calibrationGap !== null && deltas.calibrationAbs !== null) {
    if (Math.abs(recent.calibrationGap) >= 0.18 && deltas.calibrationAbs >= 0.08) {
      critical.push("Tuore kalibrointiero on suuri ja aiempaa heikompi.");
    } else if (Math.abs(recent.calibrationGap) >= 0.12 || deltas.calibrationAbs >= 0.05) {
      warning.push("Tuore kalibrointi poikkeaa odotetusta.");
    }
  }

  if (deltas.roi !== null && recent.roi <= -0.15 && deltas.roi <= -0.15) {
    warning.push("Tuoreen jakson ROI on selvästi vertailujaksoa heikompi; ROI:ta käytetään vain tukisignaalina.");
  }

  const status = critical.length ? "critical" : warning.length ? "warning" : "stable";
  return {
    status,
    severity: status === "critical" ? 1 : status === "warning" ? 0.5 : 0,
    recentSize: recentRows.length,
    baselineSize: baselineRows.length,
    recent,
    baseline,
    deltas,
    reasons: critical.length ? critical : warning.length ? warning : ["Tuore jakso ei osoita merkittävää laadun heikkenemistä."],
    abstain: status === "critical",
    stakeMultiplier: status === "critical" ? 0 : status === "warning" ? 0.5 : 1
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
    drift: calculateAgentDrift(settled),
    bySport: Object.fromEntries(
      Object.entries(bySport).map(([key, value]) => [key, finalize(value)])
    ),
    byMarket: Object.fromEntries(
      Object.entries(byMarket).map(([key, value]) => [key, finalize(value)])
    )
  };
}
