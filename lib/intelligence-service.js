export async function getMatchIntelligence({
  homeTeam,
  awayTeam,
  sport,
  league
}) {
  const response = await fetch("/api/intelligence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      homeTeam,
      awayTeam,
      sport,
      league
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(
      data.error || "Failed to load intelligence"
    );
  }

  return data.intelligence;
}
