import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  publicError,
  readJsonBody
} from "../../../../../lib/api-security";
import { compactFormRestFeatureSnapshot } from "../../../../../lib/form-rest-shadow-model.mjs";
import { POST as savePaperBets } from "../route.js";
import { GET as getTopPicks } from "../../../top-picks/route.js";

export const dynamic = "force-dynamic";

const MAX_AUDITED_BETS = 10;

function normalized(value) {
  return cleanText(value, 240).toLowerCase().replace(/\s+/g, " ");
}

function finiteProbability(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number < 1 ? number : null;
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function eventId(value = {}) {
  return cleanText(value.eventId || value.event_id || value.gameId || value.id, 180);
}

function selection(value = {}) {
  return cleanText(value.selection || value.label, 160);
}

function evidenceModelMode(pick = {}, current = {}) {
  return cleanText(pick.modelMode || current.modelMode, 120).toLowerCase();
}

function independentModelProbability(pick = {}, current = {}) {
  const explicit = finiteProbability(
    pick.independentModelProbability ??
    pick.independent_model_probability ??
    pick.predictedProbability ??
    pick.predicted_probability
  );
  if (explicit !== null) return explicit;

  const mode = evidenceModelMode(pick, current);
  const marketOnly = mode.includes("market") && (
    mode.includes("consensus") || mode.includes("benchmark") || mode.includes("implied")
  );
  return marketOnly ? null : finiteProbability(pick.modelProbability ?? pick.probability);
}

function clientRef(value = {}, index = 0) {
  const match = cleanText(value.match, 240);
  const label = selection(value);
  const odds = Number(value.odds || 0);
  return cleanText(value.id || value.client_ref || `${match}-${label}-${odds}-${index}`, 240);
}

function samePick(current, requested) {
  const currentEvent = eventId(current);
  const requestedEvent = eventId(requested);
  if (!currentEvent || !requestedEvent || currentEvent !== requestedEvent) return false;
  return normalized(selection(current)) === normalized(selection(requested));
}

async function loadCurrentPicks(request, bets) {
  const sports = [...new Set(
    bets.map((bet) => cleanText(bet.sport || bet.sportKey || bet.league, 120)).filter(Boolean)
  )].sort().slice(0, 6);
  const target = new URL("/api/top-picks", request.url);
  if (sports.length) target.searchParams.set("sports", sports.join(","));
  const response = await getTopPicks(new Request(target, { method: "GET" }));
  const payload = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, error: payload?.error || "Current analysis could not be loaded" };
  }
  return {
    ok: true,
    generatedAt: iso(payload?.generatedAt) || new Date().toISOString(),
    agentVersion: cleanText(payload?.agentVersion, 120),
    modelMode: cleanText(payload?.modelMode, 120),
    picks: Array.isArray(payload.data) ? payload.data : []
  };
}

function forwardedRequest(request, bets) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  headers.delete("content-length");
  const target = new URL("/api/cloud/bets", request.url);
  return new Request(target, {
    method: "POST",
    headers,
    body: JSON.stringify({ bets })
  });
}

function decisionEvidence(item, current) {
  const pick = item.pick || {};
  const modelMode = cleanText(pick.modelMode || current.modelMode, 120) || null;
  const modelProbability = independentModelProbability(pick, current);
  const entryMarketProbability = finiteProbability(
    pick.marketConsensusProbability ??
    pick.consensusProbability ??
    pick.marketProbability ??
    pick.impliedProbability ??
    (modelProbability === null ? pick.modelProbability : null)
  );
  return {
    auditVersion: "scorecaster-paper-decision-audit-v1",
    eventId: eventId(pick),
    selection: selection(pick),
    modelProbability,
    entryMarketProbability,
    impliedProbability: entryMarketProbability,
    modelVersion: cleanText(
      pick.modelVersion || pick.agentVersion || current.agentVersion || current.modelMode || "unknown",
      120
    ) || "unknown",
    modelMode,
    decision: cleanText(pick.productDecision || pick.decision, 30).toUpperCase() || null,
    analysisGeneratedAt: current.generatedAt,
    commenceTime: iso(pick.commenceTime ?? pick.commence_time),
    fixtureSource: cleanText(pick.fixtureSource, 120) || null,
    bookmakerCount: Number.isFinite(Number(pick.bookmakerCount)) ? Number(pick.bookmakerCount) : null,
    closingEvidencePolicy: "final-eligible-prestart-market-microstructure-consensus-only",
    manuallyEnteredClosingAcceptedForCalibration: false,
    currentOddsFallbackAcceptedForCalibration: false,
    simulatedClosingAcceptedForCalibration: false,
    automaticModelPromotion: false
  };
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "cloud_bets_audited_create",
    limit: 20,
    windowSeconds: 60
  });
  if (limited) return limited;

  const parsed = await readJsonBody(request, 96 * 1024);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, parsed.status, requestId);
  }

  const bets = Array.isArray(parsed.data?.bets)
    ? parsed.data.bets.slice(0, MAX_AUDITED_BETS)
    : [];
  if (!bets.length) {
    return jsonResponse({ ok: false, error: "No paper picks supplied" }, 400, requestId);
  }

  const current = await loadCurrentPicks(request, bets);
  if (!current.ok) {
    return jsonResponse({ ok: false, error: current.error }, current.status, requestId);
  }

  const verified = bets.map((bet, index) => {
    const pick = current.picks.find((candidate) => samePick(candidate, bet));
    return pick ? { bet, pick, clientRef: clientRef(bet, index) } : null;
  });
  if (verified.some((item) => !item)) {
    return jsonResponse(
      { ok: false, error: "A paper pick was not present in the current server-verified analysis" },
      409,
      requestId
    );
  }

  const baseResponse = await savePaperBets(forwardedRequest(request, verified.map((item) => item.bet)));
  const basePayload = await baseResponse.json();
  if (!baseResponse.ok) {
    return jsonResponse(basePayload, baseResponse.status, requestId);
  }

  const savedRows = Array.isArray(basePayload.data) ? basePayload.data : [];
  const updates = await Promise.all(verified.map(async (item) => {
    const row = savedRows.find((candidate) => candidate.client_ref === item.clientRef);
    if (!row) return { ok: false, clientRef: item.clientRef, error: "Saved paper row was not returned" };

    const currentRaw = row.raw_pick && typeof row.raw_pick === "object" ? row.raw_pick : {};
    const featureSnapshot = compactFormRestFeatureSnapshot(
      item.pick.formRestShadow || item.pick.featureSnapshot || {}
    );
    const storedAt = new Date().toISOString();
    const nextRaw = {
      ...currentRaw,
      ...decisionEvidence(item, current),
      featureSnapshot,
      featureSnapshotSource: "server-top-picks",
      featureSnapshotStoredAt: storedAt,
      decisionAuditStoredAt: storedAt
    };
    const { data, error } = await auth.supabase
      .from("bets")
      .update({ raw_pick: nextRaw })
      .eq("id", row.id)
      .eq("user_id", auth.user.id)
      .select("id,client_ref,label,match,market,bookmaker,sport,league,home_team,away_team,odds,stake,edge,ev,confidence,status,result,profit,closing_odds,clv,raw_pick,created_at,updated_at")
      .single();

    return error
      ? { ok: false, clientRef: item.clientRef, error: publicError(error, "Decision audit could not be attached") }
      : { ok: true, clientRef: item.clientRef, data };
  }));

  const failures = updates.filter((item) => !item.ok);
  return jsonResponse(
    {
      ok: failures.length === 0,
      synced: updates.length - failures.length,
      auditFailures: failures.map((item) => ({ clientRef: item.clientRef, error: item.error })),
      data: updates.filter((item) => item.ok).map((item) => item.data),
      featureSnapshotSource: "server-top-picks",
      decisionAuditVersion: "scorecaster-paper-decision-audit-v1",
      closingEvidencePolicy: "final-eligible-prestart-market-microstructure-consensus-only",
      manuallyEnteredClosingAcceptedForCalibration: false,
      currentOddsFallbackAcceptedForCalibration: false,
      simulatedClosingAcceptedForCalibration: false,
      independentProbabilityApplied: false,
      automaticModelPromotion: false
    },
    failures.length ? 207 : 200,
    requestId
  );
}
