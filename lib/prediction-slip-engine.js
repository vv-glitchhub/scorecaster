import { simulateMatch } from "./simulator-engine";
import { analyzeFixture } from "./fixture-analyzer";

function getPredictionConfidence({
  homeWinProbability,
  drawProbability,
  awayWinProbability,
  intervalMargin = 0
}) {
  const probabilities = [
    { key: "1", value: homeWinProbability },
    { key: "X", value: drawProbability },
    { key: "2", value: awayWinProbability }
  ].sort((a, b) => b.value - a.value);

  const top = probabilities[0];
  const second = probabilities[1];
  const gap = top.value - second.value;
  const uncertainGap = gap <= Math.max(0.02, Number(intervalMargin || 0) * 2);

  if (top.value >= 0.5 && gap >= 0.15 && !uncertainGap) {
    return {
      level: "Strong",
      note: "Selkeä todennäköisyysero seuraavaan vaihtoehtoon ja simulaatiovirhe on eroa pienempi.",
      safePick: top.key
    };
  }

  if (top.value >= 0.4 && gap >= 0.08 && !uncertainGap) {
    return {
      level: "Medium",
      note: "Mallilla on suosikki, mutta tulos ei ole varma.",
      safePick: top.key
    };
  }

  return {
    level: "Low",
    note: "Ottelu on tasainen tai simulaation epävarmuus on lähellä vaihtoehtojen eroa. Harkitse varmistusta.",
    safePick: `${top.key}${second.key}`
  };
}

function getRecommendation(confidence) {
  if (confidence.level === "Strong") return "Single";
  if (confidence.level === "Medium") return "Lean";
  return "Double chance";
}

export function predictFixture(fixture) {
  const analysis = analyzeFixture(fixture);

  const result = simulateMatch({
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeRating: analysis.homeRating,
    awayRating: analysis.awayRating,
    homeAdvantage: fixture.homeAdvantage ?? 3,
    simulations: fixture.simulations ?? 10000,
    seed: fixture.seed
  });

  let prediction = "X";

  if (
    result.homeWinProbability > result.drawProbability &&
    result.homeWinProbability > result.awayWinProbability
  ) {
    prediction = "1";
  }

  if (
    result.awayWinProbability > result.drawProbability &&
    result.awayWinProbability > result.homeWinProbability
  ) {
    prediction = "2";
  }

  const topIntervalMargin = Math.max(
    result.homeWinInterval?.margin || 0,
    result.drawInterval?.margin || 0,
    result.awayWinInterval?.margin || 0
  );
  const confidence = getPredictionConfidence({
    homeWinProbability: result.homeWinProbability,
    drawProbability: result.drawProbability,
    awayWinProbability: result.awayWinProbability,
    intervalMargin: topIntervalMargin
  });

  return {
    ...fixture,
    ...analysis,
    prediction,
    safePick: confidence.safePick,
    confidence: confidence.level,
    confidenceNote: confidence.note,
    recommendation: getRecommendation(confidence),
    homeWinProbability: result.homeWinProbability,
    drawProbability: result.drawProbability,
    awayWinProbability: result.awayWinProbability,
    homeWinInterval: result.homeWinInterval,
    drawInterval: result.drawInterval,
    awayWinInterval: result.awayWinInterval,
    projectedScore: `${result.averageHomeScore.toFixed(2)}-${result.averageAwayScore.toFixed(2)}`,
    projectedTotal: result.projectedTotal,
    expectedHomeGoals: result.expectedHomeGoals,
    expectedAwayGoals: result.expectedAwayGoals,
    simulations: result.simulations,
    seed: result.seed,
    modelMode: result.modelMode,
    reproducible: result.reproducible
  };
}

export function predictFixtures(fixtures = []) {
  return fixtures.map((fixture) => predictFixture(fixture));
}
