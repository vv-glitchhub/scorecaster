import crypto from "node:crypto";
import { DECISION_EVIDENCE_CONTRACT_VERSION } from "./decision-evidence-contract-v1.mjs";

export const DECISION_EVIDENCE_SEAL_VERSION = "scorecaster-decision-evidence-seal-v1";

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const BOUNDARIES = Object.freeze({
  productionProbabilityChangedByResearch: false,
  productionDecisionChangedByResearch: false,
  contextCanUpgrade: false,
  automaticModelPromotionAllowed: false,
  paperOnly: true,
  realMoneyActionAvailable: false
});

function text(value, max = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

function productDecision(value) {
  const normalized = text(value, 20).toUpperCase();
  if (normalized === "WATCH") return "CAUTION";
  return ["PLAY", "CAUTION", "SKIP"].includes(normalized) ? normalized : null;
}

function validFingerprint(value) {
  const normalized = text(value, 64).toLowerCase();
  return FINGERPRINT_PATTERN.test(normalized) ? normalized : null;
}

function exactBoundaries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const [key, expected] of Object.entries(BOUNDARIES)) {
    if (value[key] !== expected) return null;
  }
  return { ...BOUNDARIES };
}

function sealPayload(contract = {}) {
  const contractFingerprint = validFingerprint(contract.fingerprint);
  const decision = productDecision(contract.decision?.productDecision);
  const selection = text(contract.selection, 160) || null;
  const boundaries = exactBoundaries({
    productionProbabilityChangedByResearch: contract.decision?.productionProbabilityChangedByResearch,
    productionDecisionChangedByResearch: contract.decision?.productionDecisionChangedByResearch,
    contextCanUpgrade: contract.invariants?.contextCanUpgrade,
    automaticModelPromotionAllowed: contract.invariants?.automaticModelPromotionAllowed,
    paperOnly: contract.invariants?.paperOnly,
    realMoneyActionAvailable: contract.invariants?.realMoneyActionAvailable
  });

  if (
    contract.version !== DECISION_EVIDENCE_CONTRACT_VERSION
    || !contractFingerprint
    || !decision
    || !selection
    || !boundaries
  ) {
    return null;
  }

  return {
    version: DECISION_EVIDENCE_SEAL_VERSION,
    contractVersion: DECISION_EVIDENCE_CONTRACT_VERSION,
    contractFingerprint,
    eventId: text(contract.eventId, 180) || null,
    selection,
    productDecision: decision,
    boundaries
  };
}

export function buildDecisionEvidenceSealV1(contract = {}) {
  const payload = sealPayload(contract);
  return payload ? { ...payload, sealFingerprint: digest(payload) } : null;
}

export function sanitizeDecisionEvidenceSealV1(value, context = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = {
    version: value.version,
    contractVersion: value.contractVersion,
    contractFingerprint: validFingerprint(value.contractFingerprint),
    eventId: text(value.eventId, 180) || null,
    selection: text(value.selection, 160) || null,
    productDecision: productDecision(value.productDecision),
    boundaries: exactBoundaries(value.boundaries)
  };
  const suppliedSealFingerprint = validFingerprint(value.sealFingerprint);

  if (
    payload.version !== DECISION_EVIDENCE_SEAL_VERSION
    || payload.contractVersion !== DECISION_EVIDENCE_CONTRACT_VERSION
    || !payload.contractFingerprint
    || !payload.selection
    || !payload.productDecision
    || !payload.boundaries
    || !suppliedSealFingerprint
    || digest(payload) !== suppliedSealFingerprint
  ) {
    return null;
  }

  const expectedDecision = productDecision(context.decision);
  const expectedSelection = text(context.selection, 160) || null;
  const expectedEventId = text(context.eventId, 180) || null;
  if (expectedDecision && expectedDecision !== payload.productDecision) return null;
  if (expectedSelection && expectedSelection !== payload.selection) return null;
  if (expectedEventId && expectedEventId !== payload.eventId) return null;

  return { ...payload, sealFingerprint: suppliedSealFingerprint };
}

export function decisionEvidenceBoundaryText(value) {
  const seal = sanitizeDecisionEvidenceSealV1(value);
  if (!seal) return "";
  return [
    `Decision Evidence contract ${seal.contractVersion} fingerprint ${seal.contractFingerprint}; seal ${seal.sealFingerprint}.`,
    "Production decision inputs are market quality, price/value and the downgrade-only independent safety gate.",
    "Research-only feature, ensemble, uncertainty and form/rest analysis did not change the production probability or product decision.",
    "Context cannot upgrade the product decision."
  ].join(" ");
}
