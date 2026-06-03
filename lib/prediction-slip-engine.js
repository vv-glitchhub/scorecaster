import { simulateMatch } from "./simulator-engine";
import { analyzeFixture } from "./fixture-analyzer";

function getPredictionConfidence({
  homeWinProbability,
  drawProbability,
  awayWinProbability
}) {
  const probabilities = [
    { key: "1", value: homeWinProbability },
    { key: "X", value: drawProbability },
    { key: "2", value: awayWinProbability }
  ].sort((a, b) => b.value - a.value);

  const top = probabilities[0];
  const second = probabilities[1];
  const gap = top.value - second.value;

  if (top.value >= 0.5 && gap >= 0.15) {
    return {
      level: "Strong",
      note: "Selkeä todennäköisyysero seuraavaan vaihtoehtoon.",
      safePick: top.key
    };
  }

  if (top.value >= 0.4 && gap >= 0.08) {
    return {
      level: "Medium",
      note: "Mallilla on selkeä suosikki, mutta ottelu ei ole varma.",
      safePick: top.key
    };
  }

  return {
    level: "Low",
    note: "Ottelu on tasainen. Tulosveikkauksessa voi harkita varmistusta.",
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
    homeAdvantage: 0,
    simulations: fixture.simulations ?? 10000
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

  const confidence = getPredictionConfidence({
    homeWinProbability: result.homeWinProbability,
    drawProbability: result.drawProbability,
    awayWinProbability: result.awayWinProbability
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
    projectedScore: `${Math.round(result.averageHomeScore)}-${Math.round(
      result.averageAwayScore
    )}`,
    projectedTotal: result.projectedTotal
  };
}

export function predictFixtures(fixtures = []) {
  return fixtures.map((fixture) => predictFixture(fixture));
}
