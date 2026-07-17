function unknownLineup() {
  return {
    startersConfirmed: null,
    goalieConfirmed: null,
    keyPlayersAvailable: null,
    lineupStability: null,
    source: "unavailable",
    sourceType: "unavailable",
    sourceTrust: 0,
    updatedAt: null
  };
}

export async function fetchLineupForMatch({ homeTeam, awayTeam }) {
  return {
    ok: true,
    source: "lineup-provider-not-configured",
    mode: "not_configured",
    teams: [homeTeam, awayTeam],
    retrievedAt: new Date().toISOString(),
    data: unknownLineup()
  };
}
