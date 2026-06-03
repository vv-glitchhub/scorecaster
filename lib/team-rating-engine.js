export function calculateTeamRating({
  baseRating = 50,
  form = 0,
  injuries = 0,
  fatigue = 0,
  homeAdvantage = 0
}) {
  let rating = Number(baseRating || 50);

  rating += Number(form || 0) * 2;
  rating -= Number(injuries || 0) * 3;
  rating -= Number(fatigue || 0) * 1.5;
  rating += Number(homeAdvantage || 0);

  return Math.max(1, rating);
}

export function getRatingLabel(rating) {
  if (rating >= 62) return "Elite";
  if (rating >= 58) return "Strong";
  if (rating >= 53) return "Competitive";
  if (rating >= 48) return "Average";
  return "Weak";
}
