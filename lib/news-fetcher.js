export async function fetchNewsForMatch({ homeTeam, awayTeam }) {
  return {
    ok: true,
    source: "placeholder-news-fetcher",
    query: `${homeTeam} ${awayTeam}`,
    data: []
  };
}
