export function calculateLineupScore({
  startersConfirmed = false,
  goalieConfirmed = false,
  keyPlayersAvailable = true,
  lineupStability = 0
}) {
  let lineupScore = 0;
  const notes = [];

  if (startersConfirmed) {
    lineupScore += 0.02;
    notes.push("Starting lineup confirmed.");
  } else {
    lineupScore -= 0.015;
    notes.push("Starting lineup not confirmed.");
  }

  if (goalieConfirmed) {
    lineupScore += 0.03;
    notes.push("Goalie confirmed.");
  }

  if (!keyPlayersAvailable) {
    lineupScore -= 0.04;
    notes.push("Key player availability concern.");
  }

  lineupScore += Number(lineupStability || 0) * 0.01;

  if (lineupStability > 0) {
    notes.push("Lineup stability supports the pick.");
  }

  return {
    lineupScore: Math.max(-0.12, Math.min(0.12, lineupScore)),
    notes
  };
}
