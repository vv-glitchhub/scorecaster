export function calculateTeamRating({
  baseRating = 50,
  form = 0,
  injuries = 0,
  fatigue = 0,
  homeAdvantage = 0
}) {
  let rating = baseRating;

  rating += form * 2;
  rating -= injuries * 3;
  rating -= fatigue * 1.5;
  rating += homeAdvantage;

  return Math.max(1, rating);
}
