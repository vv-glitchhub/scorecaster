export function calculateContextScore({
  injuries = 0,
  form = 0,
  fatigue = 0,
  motivation = 0
}) {
  let score = 0;

  score += form * 2;
  score -= injuries * 3;
  score -= fatigue;
  score += motivation;

  return score;
}
