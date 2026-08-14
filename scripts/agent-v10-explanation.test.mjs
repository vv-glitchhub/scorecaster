import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AGENT_EXPLANATION_JSON_SCHEMA,
  buildDeterministicAgentExplanation,
  canonicalAgentExplanationInput,
  sanitizeAgentExplanationInput,
  validateGeneratedAgentExplanation
} from "../lib/agent-v10-explanation.mjs";

function sourceDecision(overrides = {}) {
  return {
    decision: "PLAY",
    match: "Alpha vs Beta",
    selection: "Alpha",
    league: "Example League",
    bookmaker: "Example Book",
    odds: 2.1,
    edge: 0.05,
    confidence: 0.72,
    trustScore: 78,
    robustnessScore: 0.69,
    bookmakerCount: 7,
    freshnessLabel: "fresh",
    suggestedStake: 8,
    decisionReason: "The price remains above the conservative floor.",
    portfolioReason: "Accepted within the paper exposure cap.",
    stressTest: {
      probability: 0.52,
      lower: 0.48,
      upper: 0.56,
      baseEv: 0.092,
      downsideEv: 0.008
    },
    priceGuard: {
      minimumPlayOdds: 2.04
    },
    evidence: [
      "Seven bookmakers contribute to the no-vig consensus.",
      "The offered price remains above the fair price."
    ],
    counterArguments: [
      "The downside EV is close to break-even.",
      "The market may move before the event."
    ],
    missingEvidence: [
      "latest market data",
      "verified lineup information"
    ],
    learningSignal: {
      note: "Learning affects ranking only.",
      sampleSize: 31
    },
    userId: "private-user-id",
    email: "private@example.com",
    accessToken: "private-access-token",
    rawPick: { unrestricted: true },
    ...overrides
  };
}

test("sanitizer keeps only the bounded non-personal decision contract", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  assert.ok(contract);
  assert.equal(contract.contractVersion, "agent-v10-grounded-3");
  assert.equal(contract.decision, "PLAY");
  assert.equal(contract.paperOnly, true);
  assert.equal(contract.match, "Alpha vs Beta");
  assert.equal(contract.stressLower, 0.48);
  assert.equal(contract.minimumPlayOdds, 2.04);
  assert.equal(contract.learningSampleSize, 31);
  assert.equal("userId" in contract, false);
  assert.equal("email" in contract, false);
  assert.equal("accessToken" in contract, false);
  assert.equal("rawPick" in contract, false);
});

test("sanitizer supplies deterministic source lists when optional arrays are empty", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision({ evidence: [], counterArguments: [], missingEvidence: [] }));
  assert.equal(contract.evidence.length, 1);
  assert.equal(contract.counterArguments.length, 1);
  assert.equal(contract.missingEvidence.length, 1);
});

test("canonical decision input is stable regardless of object insertion order", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const reordered = Object.fromEntries(Object.entries(contract).reverse());
  assert.equal(canonicalAgentExplanationInput(contract), canonicalAgentExplanationInput(reordered));
});

test("deterministic fallback remains useful without a language-model key", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const explanation = buildDeterministicAgentExplanation(contract);
  assert.equal(explanation.mode, "deterministic-fallback");
  assert.match(explanation.summary, /PLAY/);
  assert.equal(explanation.strongestReason, contract.evidence[0]);
  assert.equal(explanation.counterpoint, contract.counterArguments[0]);
  assert.equal(explanation.nextChecks.length, 2);
  assert.match(explanation.limitation, /paperiseurannan/);
});

test("grounded validator maps model-selected indexes back to immutable source text", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const generated = validateGeneratedAgentExplanation({
    summary: "Päätös läpäisee portin, mutta epävarmuus säilyy.",
    strongestEvidenceIndex: 1,
    counterArgumentIndex: 0,
    nextCheckIndexes: [1, 0],
    limitation: "Tämä on vain paperiseurannan päätöstuki eikä tulosta taata."
  }, contract);

  assert.ok(generated);
  assert.equal(generated.mode, "grounded-language-model");
  assert.equal(generated.strongestReason, contract.evidence[1]);
  assert.equal(generated.counterpoint, contract.counterArguments[0]);
  assert.deepEqual(generated.nextChecks, [
    `Vahvista ${contract.missingEvidence[1]}.`,
    `Vahvista ${contract.missingEvidence[0]}.`
  ]);
});

test("grounded validator rejects new numbers, certainty claims and invalid indexes", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  assert.equal(validateGeneratedAgentExplanation({
    summary: "Edge is 5 percent and the pick is useful.",
    strongestEvidenceIndex: 0,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Paper only."
  }, contract), null);

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Tämä on varma voitto.",
    strongestEvidenceIndex: 0,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Paper only."
  }, contract), null);

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Päätös on epävarma.",
    strongestEvidenceIndex: 9,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Paper only."
  }, contract), null);
});

test("grounded validator rejects unsupported external facts in free text", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision({
    missingEvidence: ["external availability information"]
  }));

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Joukkueen loukkaantumistilanne tukee valintaa.",
    strongestEvidenceIndex: 0,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Tämä on paperiseurannan päätöstuki."
  }, contract), null);
});

test("invalid or mutable decisions are rejected before explanation", () => {
  assert.equal(sanitizeAgentExplanationInput(sourceDecision({ decision: "BET NOW" })), null);
  assert.equal(sanitizeAgentExplanationInput({ decision: "PLAY", match: "", selection: "" }), null);
});

test("Agent V10 route keeps provider use authenticated, bounded and non-persistent", async () => {
  const route = await readFile(new URL("../app/api/agent/explain/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("const auth = await getAuthenticatedContext(request)");
  const quotaIndex = route.indexOf("const limited = await enforceRateLimit(auth, requestId");
  const providerInvocationIndex = route.indexOf("const generated = await generateGroundedExplanation(contract, language)");

  assert.ok(authIndex >= 0);
  assert.ok(quotaIndex > authIndex);
  assert.ok(providerInvocationIndex > quotaIndex);
  assert.match(route, /bucket:\s*"agent_v10_explanation"/);
  assert.match(route, /limit:\s*12/);
  assert.match(route, /windowSeconds:\s*3600/);
  assert.match(route, /store:\s*false/);
  assert.match(route, /text:\s*\{\s*format:\s*\{/s);
  assert.match(route, /type:\s*"json_schema"/);
  assert.match(route, /validateGeneratedAgentExplanation\(parsed, contract, language\)/);
  assert.match(route, /REQUEST_TIMEOUT_MS\s*=\s*18000/);
  assert.doesNotMatch(route, /web_search|file_search|tools\s*:/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI|EXPO_PUBLIC_OPENAI/);
  assert.doesNotMatch(route, /user\.email|auth\.user\.email/);
  assert.deepEqual(AGENT_EXPLANATION_JSON_SCHEMA.required, ["summary", "strongestEvidenceIndex", "counterArgumentIndex", "nextCheckIndexes", "limitation"]);
});
