export function calculateInjuryImpact(players = []) {
  let injuryScore = 0;
  const notes = [];

  for (const player of players) {
    const status = String(player.status || "").toLowerCase();
    const importance = Number(player.importance || 1);

    const isOut =
      player.out === true ||
      status === "out" ||
      status === "injured" ||
      status === "suspended";

    const isDoubtful =
      status === "doubtful" ||
      status === "questionable" ||
      status === "game-time decision";

    if (isOut) {
      const impact = importance * -0.025;
      injuryScore += impact;
      notes.push(`${player.name || "Key player"} unavailable`);
    }

    if (isDoubtful) {
      const impact = importance * -0.012;
      injuryScore += impact;
      notes.push(`${player.name || "Key player"} uncertain`);
    }
  }

  return {
    injuryScore: Math.max(-0.2, Math.min(0, injuryScore)),
    notes: notes.length ? notes : ["No major injury concern detected."]
  };
}
