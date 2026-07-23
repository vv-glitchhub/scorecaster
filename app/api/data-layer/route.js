const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function clean(value, limit = 200) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function pickId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["eventId", "sports"]);
  const unknown = [...url.searchParams.keys()].filter((key) => !allowed.has(key));
  if (unknown.length) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: HEADERS });
  }

  const eventId = clean(url.searchParams.get("eventId"), 180);
  const sports = clean(url.searchParams.get("sports"), 500);
  const topPicksUrl = new URL("/api/top-picks", url.origin);
  if (sports) topPicksUrl.searchParams.set("sports", sports);

  try {
    const response = await fetch(topPicksUrl, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      return Response.json({ ok: false, error: payload?.error || "Unified data layer is unavailable", data: [] }, { status: 503, headers: HEADERS });
    }

    const picks = Array.isArray(payload.data) ? payload.data : [];
    const selected = eventId ? picks.filter((pick) => pickId(pick) === eventId) : picks;
    const rows = selected.map((pick) => ({
      eventId: pickId(pick),
      match: pick.match,
      selection: pick.selection || pick.label,
      decision: pick.productDecision,
      odds: pick.odds,
      edge: pick.edge,
      ev: pick.ev,
      ledger: pick.unifiedSportsData || null,
      providers: pick.unifiedDataProviders || {},
      dataProvenance: pick.dataProvenance || null,
      generatedAt: pick.unifiedDataGeneratedAt || payload.generatedAt
    }));

    return Response.json({
      ok: true,
      version: "unified-sports-data-api-v1",
      generatedAt: new Date().toISOString(),
      eventId: eventId || null,
      count: rows.length,
      providerPolicy: {
        primaryOdds: "The Odds API bookmaker consensus",
        secondaryOdds: "SportsGameOdds when configured and event-matched",
        injuries: "SportsData when supported and configured",
        lineups: "configured lineup provider",
        context: "configured sports context provider",
        weather: "Open-Meteo for outdoor events with coordinates",
        news: "NewsAPI with per-source reliability scoring"
      },
      safety: {
        probabilitySource: "no-vig market consensus",
        contextCanUpgrade: false,
        contextCanDowngradeVerifiedRisk: true,
        closingOddsPregameLeakage: false,
        paperOnly: true
      },
      data: rows
    }, { headers: HEADERS });
  } catch (error) {
    return Response.json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Unified data layer could not be loaded" : String(error),
      data: []
    }, { status: 500, headers: HEADERS });
  }
}
