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
    missingEvidence: ["vahvistettu kokoonpano"],
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
  assert.equal(contract.contractVersion, "agent-v10-grounded-1");
  assert.equal(contract.email, undefined);
  assert.equal(contract.accessToken, undefined);
  assert.equal(contract.evidence.length, 6);
  assert.equal(contract.bookmakerCount, 1000);
  assert.equal(contract.paperOnly, true);
});

test("canonical decision input is stable regardless of object insertion order", () => {
  const first = sanitizeAgentExplanationInput(sourceDecision());
  const second = { ...first };
  const reversed = Object.fromEntries(Object.entries(second).reverse());

  assert.equal(canonicalAgentExplanationInput(first), canonicalAgentExplanationInput(reversed));
});

test("deterministic fallback remains useful without a language-model key", () => {
  const contract = sanitizeAgentExplanationInput(sourceDecision());
  const explanation = buildDeterministicAgentExplanation(contract);

  assert.equal(explanation.mode, "deterministic-fallback");
  assert.match(explanation.summary, /Home FC/);
  assert.match(explanation.summary, /PLAY/);
  assert.ok(explanation.nextChecks.length >= 1);
  assert.match(explanation.limitation, /paperiseurannan/);
});

test("grounded validator accepts concise qualitative output", () => {
  const value = validateGeneratedAgentExplanation({
    summary: "Päätös perustuu laskettuun markkinaevidenssiin, mutta epävarmuus säilyy.",
    strongestReason: "Paras peruste on tuore ja riittävän laaja markkinakonsensus.",
    counterpoint: "Konsensus voi silti olla väärässä tai muuttua ennen tapahtumaa.",
    nextChecks: ["Vahvista kokoonpano.", "Tarkista markkinan tuoreus."],
    limitation: "Tämä on paperiseurannan päätöstuki eikä tuottolupaus."
  });

  assert.ok(value);
  assert.equal(value.mode, "grounded-language-model");
});

test("grounded validator rejects new numbers and certainty claims", () => {
  assert.equal(validateGeneratedAgentExplanation({
    summary: "Kohde voittaa varmasti ja todennäköisyys on 70 prosenttia.",
    strongestReason: "Taattu voitto.",
    counterpoint: "Ei riskiä.",
    nextChecks: ["Pelaa nyt."],
    limitation: "Riskitön."
  }), null);

  assert.equal(validateGeneratedAgentExplanation({
    summary: "Laadukas kohde.",
    strongestReason: "Markkina tukee valintaa.",
    counterpoint: "Konsensus voi olla väärässä.",
    nextChecks: ["Tarkista 2 asiaa."],
    limitation: "Paper only."
  }), null);
});

test("invalid or mutable decisions are rejected before explanation", () => {
  assert.equal(sanitizeAgentExplanationInput(sourceDecision({ decision: "BET NOW" })), null);
  assert.equal(sanitizeAgentExplanationInput({ decision: "PLAY", match: "", selection: "" }), null);
});

test("Agent V10 route keeps provider use authenticated, bounded and non-persistent", async () => {
  const route = await readFile(new URL("../app/api/agent/explain/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const providerIndex = route.indexOf("generateGroundedExplanation(contract)");

  assert.ok(authIndex >= 0);
  assert.ok(providerIndex > authIndex);
  assert.match(route, /bucket:\s*"agent_v10_explanation"/);
  assert.match(route, /limit:\s*12/);
  assert.match(route, /windowSeconds:\s*3600/);
  assert.match(route, /store:\s*false/);
  assert.match(route, /text:\s*\{\s*format:\s*\{/s);
  assert.match(route, /type:\s*"json_schema"/);
  assert.match(route, /REQUEST_TIMEOUT_MS\s*=\s*18000/);
  assert.doesNotMatch(route, /web_search|file_search|tools\s*:/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI|EXPO_PUBLIC_OPENAI/);
  assert.doesNotMatch(route, /user\.email|auth\.user\.email/);
});
