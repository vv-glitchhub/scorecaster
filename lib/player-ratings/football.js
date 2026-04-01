function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeToTen(value, min, max) {
  if (!Number.isFinite(value)) return 5;
  if (max <= min) return 5;
  const scaled = ((value - min) / (max - min)) * 10;
  return clamp(scaled, 0, 10);
}

export function buildFootballPlayerRating(player) {
  const minutes = safeNumber(player.minutes, 0);
  const xg = safeNumber(player.xg, 0);
  const xa = safeNumber(player.xa, 0);
  const shots = safeNumber(player.shots, 0);
  const keyPasses = safeNumber(player.keyPasses, 0);
  const passesCompletedPct = safeNumber(player.passesCompletedPct, 0);
  const duelsWonPct = safeNumber(player.duelsWonPct, 0);
  const tackles = safeNumber(player.tackles, 0);
  const interceptions = safeNumber(player.interceptions, 0);
  const rating = safeNumber(player.matchRating, 6.5);
  const position = player.position || "MID";

  const availabilityFactor = clamp(minutes / 90, 0.2, 1);

  const attackComponent =
    normalizeToTen(xg, 0, 1.2) * 0.35 +
    normalizeToTen(xa, 0, 1.0) * 0.20 +
    normalizeToTen(shots, 0, 8) * 0.20 +
    normalizeToTen(keyPasses, 0, 6) * 0.15 +
    normalizeToTen(rating, 5, 10) * 0.10;

  const possessionComponent =
    normalizeToTen(passesCompletedPct, 50, 100) * 0.60 +
    normalizeToTen(keyPasses, 0, 6) * 0.20 +
    normalizeToTen(rating, 5, 10) * 0.20;

  const defenseComponent =
    normalizeToTen(tackles, 0, 8) * 0.35 +
    normalizeToTen(interceptions, 0, 6) * 0.25 +
    normalizeToTen(duelsWonPct, 30, 90) * 0.25 +
    normalizeToTen(rating, 5, 10) * 0.15;

  let roleWeights;

  if (position === "FWD") {
    roleWeights = { attack: 0.55, possession: 0.20, defense: 0.10, form: 0.15 };
  } else if (position === "DEF") {
    roleWeights = { attack: 0.15, possession: 0.25, defense: 0.45, form: 0.15 };
  } else if (position === "GK") {
    roleWeights = { attack: 0.05, possession: 0.20, defense: 0.55, form: 0.20 };
  } else {
    roleWeights = { attack: 0.30, possession: 0.30, defense: 0.25, form: 0.15 };
  }

  const formComponent = normalizeToTen(rating, 5, 10);

  const overall =
    attackComponent * roleWeights.attack +
    possessionComponent * roleWeights.possession +
    defenseComponent * roleWeights.defense +
    formComponent * roleWeights.form;

  return {
    name: player.name || "Unknown",
    team: player.team || "Unknown",
    position,
    attackComponent: clamp(attackComponent, 0, 10),
    possessionComponent: clamp(possessionComponent, 0, 10),
    defenseComponent: clamp(defenseComponent, 0, 10),
    formComponent: clamp(formComponent, 0, 10),
    overall: clamp(overall * availabilityFactor, 0, 10),
  };
}
