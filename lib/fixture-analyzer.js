import { calculateTeamRating } from "./team-rating-engine";

export function analyzeFixture({
  homeTeam,
  awayTeam,
  homeData,
  awayData
}) {
  const homeRating = calculateTeamRating(homeData);
  const awayRating = calculateTeamRating(awayData);

  return {
    homeTeam,
    awayTeam,
    homeRating,
    awayRating,
    ratingDifference: homeRating - awayRating
  };
}
