export function calculateInjuryImpact(players = []) {
  let impact = 0;

  const notes = [];

  for (const player of players) {
    if (!player.out) continue;

    impact -= Number(player.importance || 1) * 0.02;

    notes.push(
      `${player.name} unavailable`
    );
  }

  return {
    injuryScore: impact,
    notes
  };
}
