export async function loadIntelligenceForMatch({
  homeTeam,
  awayTeam,
  sport,
  league
}) {
  const response = await fetch(
    "/api/intelligence",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        homeTeam,
        awayTeam,
        sport,
        league
      })
    }
  );

  const data =
    await response.json();

  return (
    data.intelligence || {
      news: [],
      injuries: [],
      lineup: {},
      polymarket: null
    }
  );
}
