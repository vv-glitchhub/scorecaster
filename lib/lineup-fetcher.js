export async function fetchLineupForMatch({ homeTeam, awayTeam }) {
  return {
    ok: true,
    source: "placeholder-lineup-fetcher",
    teams: [homeTeam, awayTeam],
    data: {
      startersConfirmed: false,
      goalieConfirmed: false,
      keyPlayersAvailable: true,
      lineupStability: 0
    }
  };
}
