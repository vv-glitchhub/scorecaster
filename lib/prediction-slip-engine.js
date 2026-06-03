import { simulateMatch } from "./simulator-engine";

export function predictFixture(fixture) {
  const result = simulateMatch({
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeRating: fixture.homeRating,
    awayRating: fixture.awayRating,
    homeAdvantage: fixture.homeAdvantage ?? 0,
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

  return {
    ...fixture,
    prediction,
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
