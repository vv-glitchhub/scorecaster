export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const eventId = String(url.searchParams.get("eventId") || "").trim();
  return Response.json({
    ok: true,
    deprecated: true,
    version: "scorecaster-live-betting-retired-v1",
    reason: "Pre-match picks cannot support a verified live entry or stake recommendation.",
    replacement: eventId
      ? `/api/verified-live-monitor?eventId=${encodeURIComponent(eventId)}`
      : "/live-monitor",
    live: {
      count: 0,
      opportunities: [],
      suggestedStake: null,
      stakeSuggested: false,
      entryInstruction: false,
      realMoneyExecution: false
    },
    boundaries: {
      verifiedLiveEvidenceRequired: true,
      providerFreshnessRequired: true,
      eventStateIntegrityRequired: true,
      preMatchModelChanged: false,
      paperOnly: true
    },
    generatedAt: new Date().toISOString()
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Deprecation": "true",
      "Link": "</live-monitor>; rel=successor-version"
    }
  });
}
