import { createHash, randomBytes } from "node:crypto";
import {
  agentDecisionSigningConfigured,
  createAgentDecisionTicket,
  verifyAgentDecisionTicket
} from "./agent-decision-ticket.mjs";

export const AGENT_SIGNING_KEY_HANDOFF_VERSION = "scorecaster-agent-signing-key-handoff-v1";
export const AGENT_SIGNING_KEY_MINIMUM_LENGTH = 32;
export const AGENT_SIGNING_KEY_GENERATED_BYTES = 48;

const fingerprint = (value) => createHash("sha256").update(String(value || "")).digest("hex");

export function generateAgentDecisionSigningKey(bytes = AGENT_SIGNING_KEY_GENERATED_BYTES) {
  const count = Math.max(32, Math.min(128, Math.trunc(Number(bytes) || AGENT_SIGNING_KEY_GENERATED_BYTES)));
  return randomBytes(count).toString("base64url");
}

function verificationDecision() {
  return {
    decision: "WATCH",
    match: "Signing verification home vs away",
    selection: "Signing verification selection",
    odds: 2,
    edge: 0.01,
    ev: 0.02,
    confidence: 0.6,
    trustScore: 70,
    bookmakerCount: 3,
    stressTest: {
      probability: 0.5,
      lower: 0.48,
      upper: 0.52,
      baseEv: 0,
      downsideEv: -0.04
    },
    evidence: ["Synthetic signing-key verification contract."],
    counterArguments: ["Synthetic verification only."],
    missingEvidence: [],
    suggestedStake: 0
  };
}

export function assessAgentDecisionSigningKey(key, { now = Date.parse("2026-08-08T00:00:00.000Z") } = {}) {
  const value = typeof key === "string" ? key.trim() : "";
  const configured = agentDecisionSigningConfigured(value);
  let roundTripPassed = false;
  let wrongKeyRejected = false;

  if (configured) {
    const ticket = createAgentDecisionTicket(verificationDecision(), { key: value, now, ttlMs: 120_000 });
    const verified = ticket ? verifyAgentDecisionTicket(ticket, { key: value, now: now + 1_000 }) : { ok: false };
    const wrong = ticket ? verifyAgentDecisionTicket(ticket, { key: `${value}-wrong-key`, now: now + 1_000 }) : { ok: true };
    roundTripPassed = Boolean(ticket && verified.ok);
    wrongKeyRejected = Boolean(ticket && !wrong.ok);
  }

  return {
    version: AGENT_SIGNING_KEY_HANDOFF_VERSION,
    configured,
    minimumLength: AGENT_SIGNING_KEY_MINIMUM_LENGTH,
    minimumLengthMet: value.length >= AGENT_SIGNING_KEY_MINIMUM_LENGTH,
    generatedLengthRecommended: generateAgentDecisionSigningKey.name ? AGENT_SIGNING_KEY_GENERATED_BYTES : 48,
    fingerprint: configured ? fingerprint(value) : null,
    fingerprintPrefix: configured ? fingerprint(value).slice(0, 12) : null,
    roundTripPassed,
    wrongKeyRejected,
    secretValueIncluded: false,
    productionActivationPerformed: false,
    paperOnly: true
  };
}
