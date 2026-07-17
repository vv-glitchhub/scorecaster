import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildDeterministicAgentExplanation,
  canonicalAgentExplanationInput,
  sanitizeAgentExplanationInput,
  validateGeneratedAgentExplanation
} from "../lib/agent-v10-explanation.mjs";

function sourceDecision(overrides = {}) {
  return {
    decision: "PLAY",
    match: "Home FC vs Away FC",
    selection: "Home FC",
    leagueTitle: "Premier League",
    bookmaker: "Example Book",
    odds: 2.1,
    edge: 0.06,
    ev: 0.12,
    confidence: 0.8,
    trustScore: 82,
    robustnessScore: 0.71,
    bookmakerCount: 7,
    freshnessLabel: "fresh",
    suggestedStake: 8,
    decisionReason: "Laskettu evidenssi läpäisee portin.",
    portfolioReason: "Kohde mahtuu virtuaaliseen portfolioon.",
    stressTest: {
      probability: 0.54,
      lower: 0.51,
      upper: 0.57,
      baseEv: 0.134,
      downsideEv: 0.071
    },
    priceGuard: {
      minimumPlayOdds: 1.91
    },
    evidence: ["No-vig-konsensus tukee valintaa.", "Markkina on tuore."],
    counterArguments: ["Konsensus voi olla väärässä."],
    missingEvidence: ["vahvistettu kokoonpano", "riippumaton uutisvahvistus"],
    learningSignal: {
      note: "Oppiminen ei muuttanut todennäköisyyttä.",
      sampleSize: 35
    },
    ...overrides
  };
}

test("sanitizer keeps only the bounded non-personal decision contract", () => {
  const contract = sanitizeAgentExplanationInput({
    decision: {
      ...sourceDecision(),
      email: "private@example.com",
      accessToken: "secret-token",
      evidence: Array.from({ length: 20 }, (_, index) => `Evidence ${index}`),
      bookmakerCount: 99999
    },
    user: { email: "private@example.com" }
  });

  assert.ok(contract);
  assert.equal(contract.contractVersion, "agent-v10-grounded-2");
  assert.equal(contract.email, undefined);
  assert.equal(contract.accessToken, undefined);
  assert.equal(contract.evidence.length, 6);
  assert.equal(contract.bookmakerCount, 1000);
  assert.equal(contract.paperOnly, true);
});

test("sanitizer supplies deterministic source lists when optional arrays are empty", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision({
    evidence: [],
    counterArguments: [],
    missingEvidence: []
  }));

  assert.equal(contract.evidence.length, 1);
  assert.equal(contract.counterArguments.length, 1);
  assert.equal(contract.missingEvidence.length, 1);
});

test("canonical decision input is stable regardless of object insertion order", () => {
  const first = sanitizeAgentExplanationInput(sourceDecision());
  const reversed = Object.fromEntries(Object.entries(first).reverse());

  assert.equal(canonicalAgentExplanationInput(first), canonicalAgentExplanationInput(reversed));
});

test("deterministic fallback remains useful without a language-model key", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const explanation = buildDeterministicAgentExplanation(contract);

  assert.equal(explanation.mode, "deterministic-fallback");
  assert.match(explanation.summary, /Home FC/);
  assert.match(explanation.summary, /PLAY/);
  assert.equal(explanation.strongestReason, contract.evidence[0]);
  assert.equal(explanation.counterpoint, contract.counterArguments[0]);
  assert.ok(explanation.nextChecks.length >= 1);
  assert.match(explanation.limitation, /paperiseurannan/);
});

test("grounded validator maps model-selected indexes back to immutable source text", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const value = validateGeneratedAgentExplanation({
    summary: "Päätös perustuu laskettuun markkinaevidenssiin, mutta epävarmuus säilyy.",
    strongestEvidenceIndex: 1,
    counterArgumentIndex: 0,
    nextCheckIndexes: [1, 0],
    limitation: "Tämä on paperiseurannan päätöstuki eikä tuottolupaus."
  }, contract);

  assert.ok(value);
  assert.equal(value.mode, "grounded-language-model");
  assert.equal(value.strongestReason, contract.evidence[1]);
  assert.equal(value.counterpoint, contract.counterArguments[0]);
  assert.deepEqual(value.nextChecks, [
    `Vahvista ${contract.missingEvidence[1]}.`,
    `Vahvista ${contract.missingEvidence[0]}.`
  ]);
});

test("grounded validator rejects new numbers, certainty claims and invalid indexes", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Kohde voittaa varmasti ja todennäköisyys on 70 prosenttia.",
    strongestEvidenceIndex: 0,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Riskitön."
  }, contract), null);

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Laadukas mutta epävarma kohde.",
    strongestEvidenceIndex: 99,
    counterArgumentIndex: 0,
    nextCheckIndexes: [0],
    limitation: "Paperiseurannan päätöstuki."
  }, contract), null);
});

test("grounded validator rejects unsupported external facts in free text", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision({
    evidence: ["Markkinakonsensus tukee valintaa."],
    counterArguments: ["Konsensus voi olla väärässä."],
    missingEvidence: ["markkinadatan tuoreus"]
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
  const providerInvocationIndex = route.indexOf("const generated = await generateGroundedExplanation(contract)");

  assert.ok(authIndex >= 0);
  assert.ok(quotaIndex > authIndex);
  assert.ok(providerInvocationIndex > quotaIndex);
  assert.match(route, /bucket:\s*"agent_v10_explanation"/);
  assert.match(route, /limit:\s*12/);
  assert.match(route, /windowSeconds:\s*3600/);
  assert.match(route, /store:\s*false/);
  assert.match(route, /text:\s*\{\s*format:\s*\{/s);
  assert.match(route, /type:\s*"json_schema"/);
  assert.match(route, /validateGeneratedAgentExplanation\(parsed, contract\)/);
  assert.match(route, /REQUEST_TIMEOUT_MS\s*=\s*18000/);
  assert.doesNotMatch(route, /web_search|file_search|tools\s*:/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI|EXPO_PUBLIC_OPENAI/);
  assert.doesNotMatch(route, /user\.email|auth\.user\.email/);
});
