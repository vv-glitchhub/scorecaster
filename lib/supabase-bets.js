function normalizePick(pick) {
  const matchObject = pick?.match && typeof pick.match === "object" ? pick.match : null;
  const match = matchObject
    ? `${matchObject.home_team || "Home"} vs ${matchObject.away_team || "Away"}`
    : String(pick?.match || "");

  return {
    id: pick?.id,
    match,
    selection: pick?.selection || pick?.label || "",
    label: pick?.label || pick?.selection || "",
    market: pick?.market || "h2h",
    bookmaker: pick?.bookmaker || "",
    sport: pick?.sport || matchObject?.sport_key || "",
    league: pick?.league || matchObject?.sport_title || "",
    home_team: pick?.home_team || matchObject?.home_team || "",
    away_team: pick?.away_team || matchObject?.away_team || "",
    odds: Number(pick?.odds || 0),
    stake: Number(pick?.stake || 0),
    edge: Number(pick?.edge || 0),
    ev: Number(pick?.ev || 0),
    confidence: Number(pick?.confidence || 0),
    status: pick?.status || "open",
    raw_pick: pick
  };
}

export async function saveBetToCloud(pick) {
  try {
    const response = await fetch("/api/cloud/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bets: [normalizePick(pick)] })
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error || "Cloud save failed"
      };
    }

    return {
      ok: true,
      bet: payload.data?.[0] || null
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Cloud save failed"
    };
  }
}

export async function fetchCloudBets() {
  try {
    const response = await fetch("/api/cloud/bets", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !payload.ok) return [];
    return payload.data || [];
  } catch {
    return [];
  }
}
