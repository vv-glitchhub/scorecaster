export async function fetchPolymarketForMatch({ homeTeam, awayTeam }) {
  return {
    ok: true,
    source: "placeholder-polymarket-fetcher",
    query: `${homeTeam} vs ${awayTeam}`,
    data: null
  };
}
