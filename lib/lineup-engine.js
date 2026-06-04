export function calculateLineupScore({
  startersConfirmed = false,
  goalieConfirmed = false
}) {
  let score = 0;

  if (startersConfirmed) score += 0.02;

  if (goalieConfirmed) score += 0.03;

  return {
    lineupScore: score
  };
}
