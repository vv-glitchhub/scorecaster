import { createHmac, timingSafeEqual } from "node:crypto";
import {
  canonicalAgentExplanationInput,
  sanitizeAgentExplanationInput
} from "./agent-v10-explanation.mjs";

const TICKET_VERSION = 1;
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_TTL_MS = 30 * 60 * 1000;
const MIN_KEY_LENGTH = 32;

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function parseBase64url(value) {
  try {
    return Buffer.from(String(value || ""), "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function signingKey(value) {
  const key = String(value || "");
  return key.length >= MIN_KEY_LENGTH ? key : null;
}

function signature(payload, key) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function equalSignature(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function agentDecisionSigningConfigured(key = process.env.AGENT_DECISION_SIGNING_KEY) {
  return Boolean(signingKey(key));
}

export function createAgentDecisionTicket(decision, {
  key = process.env.AGENT_DECISION_SIGNING_KEY,
  now = Date.now(),
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  const secret = signingKey(key);
  const contract = sanitizeAgentExplanationInput(decision);
  if (!secret || !contract) return null;

  const issuedAt = Math.trunc(Number(now));
  const safeTtl = Math.max(60_000, Math.min(MAX_TTL_MS, Math.trunc(Number(ttlMs) || DEFAULT_TTL_MS)));
  const payload = JSON.stringify({
    v: TICKET_VERSION,
    iat: issuedAt,
    exp: issuedAt + safeTtl,
    contract,
    canonical: canonicalAgentExplanationInput(contract)
  });
  const encoded = base64url(payload);
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyAgentDecisionTicket(ticket, {
  key = process.env.AGENT_DECISION_SIGNING_KEY,
  now = Date.now()
} = {}) {
  const secret = signingKey(key);
  if (!secret || typeof ticket !== "string" || ticket.length > 24_000) {
    return { ok: false, error: "Decision ticket is unavailable" };
  }

  const [encoded, suppliedSignature, ...extra] = ticket.split(".");
  if (!encoded || !suppliedSignature || extra.length) {
    return { ok: false, error: "Invalid decision ticket" };
  }

  const expected = signature(encoded, secret);
  if (!equalSignature(suppliedSignature, expected)) {
    return { ok: false, error: "Invalid decision ticket signature" };
  }

  let payload;
  try {
    payload = JSON.parse(parseBase64url(encoded));
  } catch {
    return { ok: false, error: "Invalid decision ticket payload" };
  }

  const timestamp = Math.trunc(Number(now));
  if (payload?.v !== TICKET_VERSION || !Number.isFinite(payload?.iat) || !Number.isFinite(payload?.exp)) {
    return { ok: false, error: "Unsupported decision ticket" };
  }
  if (payload.iat > timestamp + 60_000 || payload.exp <= timestamp || payload.exp - payload.iat > MAX_TTL_MS) {
    return { ok: false, error: "Decision ticket has expired" };
  }

  const contract = sanitizeAgentExplanationInput(payload.contract);
  if (!contract || canonicalAgentExplanationInput(contract) !== payload.canonical) {
    return { ok: false, error: "Decision ticket contract mismatch" };
  }

  return {
    ok: true,
    contract,
    issuedAt: payload.iat,
    expiresAt: payload.exp
  };
}
