import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("web Agent renders a bounded verified Evidence Seal without a new request", async () => {
  const client = await file("app/agent/AgentExplanation.jsx");

  assert.match(client, /agent-v10-evidence-seal-5/);
  assert.match(client, /CACHE_TTL_MS\s*=\s*10 \* 60 \* 1000/);
  assert.match(client, /FINGERPRINT_PATTERN\s*=\s*\/\^\[a-f0-9\]\{64\}\$\//);
  assert.match(client, /decisionEvidenceMode === "verified-signed-structured-seal-v1"/);
  assert.match(client, /data-agent-evidence-seal=/);
  assert.match(client, /Decision Evidence verified/);
  assert.match(client, /Structured Decision Evidence seal was unavailable/);
  assert.match(client, /shortFingerprint\(evidenceSeal\.contractFingerprint\)/);
  assert.match(client, /shortFingerprint\(evidenceSeal\.sealFingerprint\)/);
  assert.equal(client.split("fetch(").length - 1, 2);
});

test("web explanation cache cannot outlive its signed decision ticket", async () => {
  const client = await file("app/agent/AgentExplanation.jsx");
  const route = await file("app/api/agent/explain/route.js");

  assert.match(client, /const ticketExpiresAt = Date\.parse\(payload\?\.ticketExpiresAt \|\| ""\)/);
  assert.match(client, /Math\.min\(savedAt \+ CACHE_TTL_MS, ticketExpiresAt\)/);
  assert.match(client, /Date\.now\(\) >= expiresAt/);
  assert.match(client, /if \(expiresAt <= savedAt\) return/);
  assert.match(route, /ticketExpiresAt: Number\.isFinite\(ticketExpiresAt\)/);
  assert.match(route, /fallbackResponse\(contract, requestId, generated\.reason, language, 200, verified\.expiresAt\)/);
});

test("mobile Agent types and cards expose server-sealed evidence honestly", async () => {
  const [screen, types] = await Promise.all([
    file("mobile/src/screens/AgentScreen.tsx"),
    file("mobile/src/types.ts")
  ]);

  assert.match(types, /export type DecisionEvidenceSeal/);
  assert.match(types, /decisionEvidenceFingerprint\?: string/);
  assert.match(types, /decisionEvidenceSeal\?: DecisionEvidenceSeal \| null/);
  assert.match(types, /decisionEvidenceSealFingerprint\?: string \| null/);
  assert.match(screen, /function decisionEvidenceStatus/);
  assert.match(screen, /decision\.explanationTicket/);
  assert.match(screen, /boundaries\?\.contextCanUpgrade === false/);
  assert.match(screen, /evidenceSealed/);
  assert.match(screen, /EVIDENCE SEALED/);
  assert.match(screen, /SEAL UNAVAILABLE/);
  assert.match(screen, /Decision Evidence verified/);
  assert.match(screen, /Decision Evidence seal unavailable/);
  assert.doesNotMatch(screen, /setEvidenceSeal|setDecisionEvidence/);
});

test("UI seal status is derived during render and preserves paper-only wording", async () => {
  const [web, mobile] = await Promise.all([
    file("app/agent/AgentExplanation.jsx"),
    file("mobile/src/screens/AgentScreen.tsx")
  ]);

  assert.match(web, /const evidenceSeal = evidenceSealStatus\(payload\)/);
  assert.match(mobile, /const evidenceSeal = decisionEvidenceStatus\(decision\)/);
  assert.match(mobile, /const explanationSeal = explanationEvidenceStatus\(explanation\)/);
  assert.match(mobile, /Paper tracking only/);
  assert.doesNotMatch(web, /useEffect\([\s\S]{0,220}setEvidenceSeal/);
});
