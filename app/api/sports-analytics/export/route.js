export const dynamic = "force-dynamic";

function clean(value, limit = 180) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["sport", "eventId", "hours", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  const apiUrl = new URL("/api/sports-analytics", url.origin);
  for (const key of allowed) {
    const value = clean(url.searchParams.get(key), key === "eventId" ? 180 : 60);
    if (value) apiUrl.searchParams.set(key, value);
  }

  const response = await fetch(apiUrl, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    return Response.json({ ok: false, error: payload?.error || "Sports analytics export unavailable" }, { status: response.status || 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  const headers = [
    "event_id", "sport", "league", "participant_id", "family", "metric", "value", "unit",
    "observed_at", "captured_at", "provider", "source_trust", "confidence", "metadata"
  ];
  const rows = (payload.observations || []).map((row) => [
    row.eventId,
    row.canonicalSport,
    row.league,
    row.participantId,
    row.family,
    row.metric,
    row.value,
    row.unit,
    row.observedAt,
    row.capturedAt,
    row.provider,
    row.sourceTrust,
    row.confidence,
    row.metadata
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  const sport = clean(url.searchParams.get("sport"), 60) || "all-sports";
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scorecaster-sports-analytics-${sport}-${date}.csv"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
