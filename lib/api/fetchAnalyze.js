export async function fetchAnalyze({
  match,
  oddsData,
  bankroll,
  teamRatings = null,
}) {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        match,
        oddsData,
        bankroll,
        teamRatings,
      }),
    });

    if (!res.ok) {
      console.error("Analyze API error status:", res.status);
      return null;
    }

    const data = await res.json();

    if (!data?.ok) {
      console.error("Analyze API returned not ok:", data);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Analyze fetch failed:", error);
    return null;
  }
}
