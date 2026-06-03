import { calculateTeamRating, getRatingLabel } from "./team-rating-engine";

export function analyzeFixture({
  homeTeam,
  awayTeam,
  homeBaseRating = 55,
  awayBaseRating = 55,
  homeForm = 0,
  awayForm = 0,
  homeInjuries = 0,
  awayInjuries = 0,
  homeFatigue = 0,
  awayFatigue = 0,
  homeAdvantage = 0
}) {
  const homeRating = calculateTeamRating({
    baseRating: homeBaseRating,
    form: homeForm,
    injuries: homeInjuries,
    fatigue: homeFatigue,
    homeAdvantage
  });

  const awayRating = calculateTeamRating({
    baseRating: awayBaseRating,
    form: awayForm,
    injuries: awayInjuries,
    fatigue: awayFatigue,
    homeAdvantage: 0
  });

  return {
    homeTeam,
    awayTeam,
    homeRating,
    awayRating,
    homeLabel: getRatingLabel(homeRating),
    awayLabel: getRatingLabel(awayRating),
    ratingDifference: homeRating - awayRating,
    factors: {
      homeForm,
      awayForm,
      homeInjuries,
      awayInjuries,
      homeFatigue,
      awayFatigue,
      homeAdvantage
    }
  };
}
