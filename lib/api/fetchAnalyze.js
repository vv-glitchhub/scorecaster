export async function fetchAnalyze({
  match,
  oddsData,
  bankroll = 0,
  teamRatings = null,
}) {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        match,
        oddsData,
        bankroll,
        teamRatings,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
