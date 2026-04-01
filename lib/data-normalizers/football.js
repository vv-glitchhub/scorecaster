function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeFootballPlayersFromFeed(rawPlayers = []) {
  return rawPlayers.map((player) => ({
    name: player.name || "Unknown",
    team: player.team || "Unknown",
    position: player.position || "MID",
    minutes: toNumber(player.minutes, 0),
    xg: toNumber(player.xg, 0),
    xa: toNumber(player.xa, 0),
    shots: toNumber(player.shots, 0),
    keyPasses: toNumber(player.keyPasses, 0),
    passesCompletedPct: toNumber(player.passesCompletedPct, 0),
    duelsWonPct: toNumber(player.duelsWonPct, 0),
    tackles: toNumber(player.tackles, 0),
    interceptions: toNumber(player.interceptions, 0),
    matchRating: toNumber(player.matchRating, 6.5),
  }));
}
