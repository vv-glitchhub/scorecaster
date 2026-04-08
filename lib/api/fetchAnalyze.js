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

    const rawText = await res.text();

    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      console.error("Analyze response was not valid JSON:", rawText);
      return null;
    }

    console.log("ANALYZE STATUS:", res.status);
    console.log("ANALYZE RESPONSE:", data);
    console.log("ANALYZE INPUT:", {
      match,
      oddsData,
      hasBookmakers: Array.isArray(oddsData?.bookmakers),
      bookmakersCount: Array.isArray(oddsData?.bookmakers)
        ? oddsData.bookmakers.length
        : 0,
    });

    if (!res.ok) {
      console.error("Analyze API error:", res.status, data);
      return null;
    }

    if (!data?.ok) {
      console.error("Analyze API returned ok=false:", data);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Analyze fetch failed:", error);
    return null;
  }
}
