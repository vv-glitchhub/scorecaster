export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: false,
    source: "clv-tracker-v1-retired",
    status: "retired",
    error: "The simulated closing-line tracker has been removed.",
    replacement: "/api/calibration",
    methodology: "/calibration",
    reason: "Trusted CLV requires final eligible pre-start provider evidence from Market Microstructure V2.",
    summary: {
      count: 0,
      averageCLVPercent: null,
      positiveRate: null,
      grade: "N/A",
      note: "No simulated closing odds are produced. Sign in and use Calibration Lab after real evidence has settled."
    },
    data: [],
    currentOddsFallbackUsed: false,
    simulatedClosingUsed: false,
    manuallyEnteredClosingAcceptedForCalibration: false,
    automaticModelPromotion: false,
    paperOnly: true
  }, {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Link: '</api/calibration>; rel="successor-version"'
    }
  });
}
