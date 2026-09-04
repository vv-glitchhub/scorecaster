import { SPORTS } from "../../../lib/sports.js";
import { buildEventDetail } from "../../../lib/event-detail.mjs";
import { buildDecisionEvidenceContractV1, DECISION_EVIDENCE_CONTRACT_VERSION } from "../../../lib/decision-evidence-contract-v1.mjs";
import { loadVerifiedMarketHistory } from "../../../lib/unified-capture-market-history-v1.mjs";
import { buildVerifiedMarketJourneyV1, VERIFIED_MARKET_JOURNEY_VERSION } from "../../../lib/verified-market-journey-v1.mjs";
import { loadVerifiedEventHistoryV1, VERIFIED_EVENT_HISTORY_VERSION } from "../../../lib/verified-event-history-v1.mjs";
import { GET as getTopPicks } from "../top-picks/route.js";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));
const ALLOWED_QUERY_KEYS = new Set(["eventId", "sport", "selection"]);
const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function clean(value, maximum) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function pickEventId(pick = {}) {
  return clean(pick.gameId || pick.eventId || pick.id, 180);
}

function pickSelection(pick = {}) {
  return clean(pick.selection || pick.label, 160);
}

async function verifiedMarketJourney(pick) {
  if (!pick) return buildVerifiedMarketJourneyV1();
  try {
    const history = await loadVerifiedMarketHistory(pick);
    return buildVerifiedMarketJourneyV1(history);
  } catch {
    return buildVerifiedMarketJourneyV1();
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const unknown = [...url.searchParams.keys()].filter((key) => !ALLOWED_QUERY_KEYS.has(key));
  if (unknown.length) {
    return Response.json({ ok: false, error: "Unsupported query parameter" }, { status: 400, headers: CACHE_HEADERS });
  }

  const eventId = clean(url.searchParams.get("eventId"), 180);
  const sport = clean(url.searchParams.get("sport"), 120);
  const selection = clean(url.searchParams.get("selection"), 160);
  if (!eventId || !sport || !SUPPORTED_SPORTS.has(sport)) {
    return Response.json({ ok: false, error: "A current event ID and supported sport are required" }, { status: 400, headers: CACHE_HEADERS });
  }

  const target = new URL("/api/top-picks", request.url);
  target.searchParams.set("sports", sport);
  const sourceResponse = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await sourceResponse.json();
  if (!sourceResponse.ok) {
    return Response.json({ ok: false, error: payload?.error || "Current analysis could not be loaded" }, { status: sourceResponse.status, headers: CACHE_HEADERS });
  }

  const detail = buildEventDetail(payload?.data || [], eventId, selection);
  if (!detail) {
    return Response.json({ ok: false, error: "The event is not present in the current verified analysis" }, { status: 404, headers: CACHE_HEADERS });
  }

  const picks = Array.isArray(payload?.data) ? payload.data : [];
  const eventPicks = picks.filter((pick) => pickEventId(pick) === eventId);
  const selectedPick = eventPicks.find((pick) => selection && pickSelection(pick).toLowerCase() === selection.toLowerCase())
    || eventPicks.find((pick) => pickSelection(pick) === detail.selectedSelection)
    || eventPicks[0]
    || null;
  const evidenceBySelection = eventPicks.map((pick) => ({
    selection: pickSelection(pick),
    contract: buildDecisionEvidenceContractV1(pick)
  }));
  const selectedEvidence = evidenceBySelection.find((item) => selection && item.selection.toLowerCase() === selection.toLowerCase())
    || evidenceBySelection.find((item) => item.selection === detail.selectedSelection)
    || evidenceBySelection[0]
    || null;

  detail.selections = detail.selections.map((item) => ({
    ...item,
    decisionEvidence: evidenceBySelection.find((entry) => entry.selection === item.selection)?.contract || null
  }));
  detail.decisionEvidence = selectedEvidence?.contract || null;
  detail.decisionEvidenceVersion = DECISION_EVIDENCE_CONTRACT_VERSION;

  const [marketHistory, eventHistory] = await Promise.all([
    verifiedMarketJourney(selectedPick),
    loadVerifiedEventHistoryV1({
      sportKey: detail.sportKey || sport,
      homeTeam: detail.homeTeam,
      awayTeam: detail.awayTeam,
      commenceTime: detail.commenceTime
    })
  ]);
  detail.marketHistory = marketHistory;
  detail.marketHistoryVersion = VERIFIED_MARKET_JOURNEY_VERSION;
  detail.verifiedEventHistory = eventHistory;
  detail.verifiedEventHistoryVersion = VERIFIED_EVENT_HISTORY_VERSION;

  return Response.json({
    ok: true,
    source: payload?.source || "no-vig-market-consensus",
    generatedAt: payload?.generatedAt || detail.generatedAt,
    decisionEvidenceVersion: DECISION_EVIDENCE_CONTRACT_VERSION,
    marketHistoryVersion: VERIFIED_MARKET_JOURNEY_VERSION,
    verifiedEventHistoryVersion: VERIFIED_EVENT_HISTORY_VERSION,
    detail
  }, { headers: CACHE_HEADERS });
}
