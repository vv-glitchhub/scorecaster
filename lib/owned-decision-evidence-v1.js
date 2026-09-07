import { getSupabaseAdmin } from "./supabase-admin";

export const OWNED_DECISION_EVIDENCE_VERSION = "owned-decision-evidence-v1";

const OWNED_CHAMPION_ID = "scorecaster-own-football-baseline";
const MAX_AGE_HOURS = 2;
const MIN_CONFIDENCE = 0.32;
const SUPPORT_GAP = 0.02;
const STRONG_CONFLICT_GAP = 0.05;
const HOUR_MS = 60 * 60 * 1000;
const TEAM_NOISE = new Set([
  "1", "fc", "afc", "cf", "sc", "ac", "fk", "bk", "if", "aif", "ud", "cd", "rc", "rcd", "ssc",
  "club", "football", "calcio", "futbol", "de"
]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function teamKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !TEAM_NOISE.has(token))
    .join("-");
}

function sameTeam(left, right) {
  const a = teamKey(left);
  const b = teamKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 5 && long.startsWith(`${short}-`);
}

function selectionOutcome(pick = {}) {
  if (String(pick.marketKey || "h2h").toLowerCase() !== "h2h") return null;
  const selection = String(pick.selection || "").trim();
  if (!selection) return null;
  if (["draw", "tie", "tasapeli"].includes(selection.toLowerCase())) return "draw";
  if (sameTeam(selection, pick.homeTeam)) return "home";
  if (sameTeam(selection, pick.awayTeam)) return "away";
  return null;
}

function providerEventId(pick = {}) {
  return String(pick.gameId || pick.eventId || "").trim();
}

export function buildOwnedDecisionEvidenceV1(pick = {}, row = null, { now = Date.now() } = {}) {
  const outcome = selectionOutcome(pick);
  const eventId = providerEventId(pick);
  if (!outcome || !eventId) {
    return {
      version: OWNED_DECISION_EVIDENCE_VERSION,
      applicable: false,
      qualified: false,
      reason: outcome ? "missing-provider-event-id" : "market-not-supported-by-owned-1x2-model",
      paperOnly: true
    };
  }

  if (!row) {
    return {
      version: OWNED_DECISION_EVIDENCE_VERSION,
      applicable: true,
      qualified: false,
      reason: "owned-decision-unavailable",
      providerEventId: eventId,
      selectionOutcome: outcome,
      paperOnly: true
    };
  }

  const probabilities = row.champion_probabilities && typeof row.champion_probabilities === "object"
    ? row.champion_probabilities
    : {};
  const probability = finite(probabilities[outcome]);
  const consensus = finite(pick.consensusProbability ?? pick.marketProbability ?? pick.modelProbability);
  const delta = probability !== null && consensus !== null ? probability - consensus : null;
  const asOfMs = Date.parse(String(row.as_of || ""));
  const ageHours = Number.isFinite(asOfMs) ? Math.max(0, (now - asOfMs) / HOUR_MS) : null;
  const commenceMs = Date.parse(String(pick.commenceTime || pick.commence_time || ""));
  const chronologySafe = Number.isFinite(asOfMs) && (!Number.isFinite(commenceMs) || asOfMs < commenceMs);
  const reasonCodes = Array.isArray(row.reason_codes) ? row.reason_codes.map(String) : [];
  const provenance = row.provenance && typeof row.provenance === "object" ? row.provenance : {};
  const independentFromMarket = reasonCodes.includes("market-not-used-by-champion") && Boolean(provenance.championTrainingDataHash);
  const confidence = finite(row.confidence_score);
  const mappedToCurrentEvent = row.market_mapped === true && String(row.market_source_event_id || "") === eventId;
  const fresh = ageHours !== null && ageHours <= MAX_AGE_HOURS;
  const ready = row.intelligence_decision === "OWN_PREDICTION_READY";
  const championTrusted = row.champion_model_id === OWNED_CHAMPION_ID;
  const confidenceSufficient = confidence !== null && confidence >= MIN_CONFIDENCE;
  const supportsSelection = delta !== null && delta >= -SUPPORT_GAP;
  const strongConflict = delta !== null && delta <= -STRONG_CONFLICT_GAP;
  const qualified = Boolean(
    probability !== null && probability > 0 && probability < 1 &&
    consensus !== null && consensus > 0 && consensus < 1 &&
    mappedToCurrentEvent &&
    ready &&
    championTrusted &&
    independentFromMarket &&
    chronologySafe &&
    fresh &&
    confidenceSufficient &&
    row.paper_only === true
  );

  return {
    version: OWNED_DECISION_EVIDENCE_VERSION,
    applicable: true,
    qualified,
    reason: qualified ? "owned-independent-prediction-ready" : "owned-independent-prediction-not-qualified",
    providerEventId: eventId,
    canonicalEventId: row.event_id || null,
    selectionOutcome: outcome,
    modelSelectedOutcome: row.selected_outcome || null,
    decision: row.intelligence_decision || null,
    modelId: row.champion_model_id || null,
    modelVersion: row.champion_model_version || null,
    probability,
    marketConsensusProbability: consensus,
    probabilityDelta: delta === null ? null : Number(delta.toFixed(4)),
    supportsSelection,
    strongConflict,
    confidence,
    confidenceSufficient,
    marketMapped: mappedToCurrentEvent,
    independentFromMarket,
    chronologySafe,
    fresh,
    ageHours: ageHours === null ? null : Number(ageHours.toFixed(2)),
    asOf: row.as_of || null,
    predictionHash: provenance.championPredictionHash || null,
    trainingDataHash: provenance.championTrainingDataHash || null,
    source: "scorecaster-owned-baseline",
    rawPredictionDistributionPublished: false,
    productionProbabilityChanged: false,
    decisionUpgradeAllowedByThisLayer: false,
    automaticModelPromotionAllowed: false,
    paperOnly: true
  };
}

function chunks(values, size = 50) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function attachOwnedDecisionEvidenceBatch(picks = [], { now = Date.now() } = {}) {
  if (!Array.isArray(picks) || picks.length === 0) return [];
  const admin = getSupabaseAdmin();
  if (!admin) {
    return picks.map((pick) => ({
      ...pick,
      ownedDecisionEvidenceV1: buildOwnedDecisionEvidenceV1(pick, null, { now })
    }));
  }

  const eventIds = [...new Set(picks
    .filter((pick) => String(pick.marketKey || "h2h").toLowerCase() === "h2h")
    .map(providerEventId)
    .filter(Boolean))];
  if (!eventIds.length) {
    return picks.map((pick) => ({ ...pick, ownedDecisionEvidenceV1: buildOwnedDecisionEvidenceV1(pick, null, { now }) }));
  }

  const rows = [];
  const newestAllowed = new Date(now - 6 * HOUR_MS).toISOString();
  try {
    for (const batch of chunks(eventIds)) {
      const { data, error } = await admin
        .from("scorecaster_own_decisions_v1")
        .select("event_id,as_of,intelligence_decision,selected_outcome,confidence_score,champion_model_id,champion_model_version,champion_probabilities,market_mapped,market_source_event_id,reason_codes,provenance,paper_only")
        .in("market_source_event_id", batch)
        .eq("market_mapped", true)
        .gte("as_of", newestAllowed)
        .order("as_of", { ascending: false });
      if (error) throw error;
      rows.push(...(data || []));
    }
  } catch {
    return picks.map((pick) => ({
      ...pick,
      ownedDecisionEvidenceV1: buildOwnedDecisionEvidenceV1(pick, null, { now })
    }));
  }

  const latestByProviderEvent = new Map();
  for (const row of rows) {
    const key = String(row.market_source_event_id || "");
    if (key && !latestByProviderEvent.has(key)) latestByProviderEvent.set(key, row);
  }

  return picks.map((pick) => ({
    ...pick,
    ownedDecisionEvidenceV1: buildOwnedDecisionEvidenceV1(
      pick,
      latestByProviderEvent.get(providerEventId(pick)) || null,
      { now }
    )
  }));
}
