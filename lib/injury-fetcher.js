export async function fetchInjuriesForMatch({ homeTeam, awayTeam }) {
  return {
    ok: true,
    source: "placeholder-injury-fetcher",
    teams: [homeTeam, awayTeam],
    data: []
  };
}
