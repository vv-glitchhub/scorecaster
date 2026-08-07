import {
  VEIKKAUS_INTELLIGENCE_VERSION,
  analyzeFixedOddsSelection,
  analyzePoolPopularity,
  analyzeTulosvetoSelection,
  createVeikkausIntelligenceBoundary,
  mapVeikkausMarketLabel,
  rankVakioMarks,
} from "../../../lib/veikkaus-intelligence-v1.mjs";
import {
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody,
} from "../../../lib/api-security";

export const dynamic = "force-dynamic";

const modes = ["fixed_odds", "pool_popularity", "tulosveto", "vakio_marks", "market_map"];

export function GET() {
  return jsonResponse({
    ok: true,
    version: VEIKKAUS_INTELLIGENCE_VERSION,
    modes,
    boundary: createVeikkausIntelligenceBoundary(),
    notes: {
      liveVeikkausData: false,
      manualSnapshotInput: true,
      vakioExpectedValueRequiresReturnRate: true,
      tulosvetoDefaultRoundReturnRate: 0.77,
    },
  }, 200, null, {
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  });
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const body = await readJsonBody(request, 32 * 1024);
  if (!body.ok) return jsonResponse({ ok: false, error: body.error }, body.status, requestId);

  const input = body.data || {};
  const mode = String(input.mode || "");
  if (!modes.includes(mode)) {
    return jsonResponse({ ok: false, error: `mode must be one of: ${modes.join(", ")}` }, 422, requestId);
  }

  try {
    let analysis;
    if (mode === "fixed_odds") {
      analysis = analyzeFixedOddsSelection(input);
    } else if (mode === "pool_popularity") {
      analysis = analyzePoolPopularity(input);
    } else if (mode === "tulosveto") {
      analysis = analyzeTulosvetoSelection(input);
    } else if (mode === "vakio_marks") {
      if (!Array.isArray(input.marks) || input.marks.length > 3) throw new Error("marks must contain 1 to 3 Vakio marks");
      analysis = rankVakioMarks(input.marks);
    } else {
      analysis = mapVeikkausMarketLabel(input.label);
    }

    return jsonResponse({
      ok: true,
      version: VEIKKAUS_INTELLIGENCE_VERSION,
      analysis,
      boundary: createVeikkausIntelligenceBoundary(),
    }, 200, requestId);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid Veikkaus Intelligence input",
    }, 422, requestId);
  }
}
