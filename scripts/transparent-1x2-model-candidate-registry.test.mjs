import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  auditTransparent1X2ModelCandidateRegistry,
  buildTransparent1X2ModelCandidate,
  TRANSPARENT_1X2_MODEL_CANDIDATE_REGISTRY_VERSION
} from "../lib/transparent-1x2-model-candidate-registry.mjs";
import { TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION } from "../lib/transparent-1x2-paired-evidence.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const canonicalRegistry = JSON.parse(await source("config/transparent-1x2-model-candidates.json"));
const hex = (character) => character.repeat(64);

function paired(overrides = {}) {
  return {
    ok: true,
    version: TRANSPARENT_1X2_PAIRED_EVIDENCE_VERSION,
    comparisonId: hex("a"),
    cohortFingerprint: hex("b"),
    configurationFingerprint: hex("c"),
    baselinePackageId: hex("d"),
    challengerPackageId: hex("e"),
    baselinePredictionFingerprint: hex("1"),
    challengerPredictionFingerprint: hex("2"),
    evidenceRef: "model-evidence/paired/epl-2025-26-v1.json",
    rowCount: 240,
    metrics: {
      direction: { overall: "challenger-directionally-better" },
      deltaChallengerMinusBaseline: { brier: -0.0123, logLoss: -0.0187 }
    },
    evidenceAssessment: {
      realHistoricalPair: true,
      readyForManualReview: true,
      label: "paired-historical-evidence-ready-for-manual-review",
      statisticalSignificanceClaimed: false
    },
    automaticPromotionAllowed: false,
    productionProbabilityChanged: false,
    paperOnly: true,
    ...overrides
  };
}

function profile(overrides = {}) {
  return {
    engine: "dixon-coles-1x2",
    profileId: "dc-epl-candidate-v1",
    modelVersion: "scorecaster-transparent-1x2-v2",
    trainingCutoff: "2026-05-01T00:00:00.000Z",
    rho: -0.07,
    sampleSize: 240,
    scope: { sport: "soccer", league: "epl", market: "h2h" },
    ...overrides
  };
}

const createdAt = "2026-06-02T00:00:00.000Z";

test("canonical registry is valid, empty and cannot activate production", () => {
  const report = auditTransparent1X2ModelCandidateRegistry(canonicalRegistry);
  assert.equal(report.ok, true);
  assert.equal(report.version, TRANSPARENT_1X2_MODEL_CANDIDATE_REGISTRY_VERSION);
  assert.equal(report.candidateCount, 0);
  assert.equal(report.approvedCandidateCount, 0);
  assert.equal(report.pendingCandidateCount, 0);
  assert.equal(report.productionActivationEligible, false);
  assert.equal(report.automaticPromotionAllowed, false);
  assert.equal(report.runtimeLoadingAllowed, false);
  assert.equal(report.productionProbabilityChanged, false);
  assert.equal(report.paperOnly, true);
  assert.equal(report.registryFingerprint.length, 64);
});

test("a valid historical pair can create a pending immutable candidate without implying approval", () => {
  const result = buildTransparent1X2ModelCandidate({
    candidateId: "dc-epl-2025-26-v1",
    createdAt,
    pairedEvidence: paired(),
    profile: profile(),
    review: { state: "pending-review" }
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidate.review.state, "pending-review");
  assert.equal(result.candidate.profileFingerprint.length, 64);
  assert.equal(result.candidate.recordFingerprint.length, 64);
  assert.equal(result.candidate.pairedEvidence.evidenceRef, "model-evidence/paired/epl-2025-26-v1.json");
  assert.equal(result.eligibleForFutureManualProfileChange, false);
  assert.equal(result.automaticPromotionAllowed, false);
  assert.equal(result.runtimeLoadingAllowed, false);
  assert.equal(result.productionActivationAllowed, false);
});

test("approved-candidate requires explicit human review but still cannot activate production", () => {
  const result = buildTransparent1X2ModelCandidate({
    candidateId: "dc-epl-2025-26-approved-v1",
    createdAt,
    pairedEvidence: paired(),
    profile: profile({ profileId: "dc-epl-approved-v1" }),
    review: {
      state: "approved-candidate",
      reviewedAt: "2026-06-03T10:00:00.000Z",
      reviewedBy: "model-reviewer",
      evidenceRef: "model-evidence/reviews/dc-epl-approved-v1.md",
      note: "Approved only as a candidate for a future explicit profile change."
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligibleForFutureManualProfileChange, true);
  assert.equal(result.candidate.review.state, "approved-candidate");
  assert.equal(result.candidate.safety.productionActivationAllowed, false);
  assert.equal(result.candidate.safety.runtimeLoadingAllowed, false);
  assert.equal(result.candidate.safety.automaticPromotionAllowed, false);
  assert.equal(result.productionProbabilityChanged, false);
});

test("rejected candidates remain valid immutable review records", () => {
  const result = buildTransparent1X2ModelCandidate({
    candidateId: "dc-epl-2025-26-rejected-v1",
    createdAt,
    pairedEvidence: paired(),
    profile: profile({ profileId: "dc-epl-rejected-v1" }),
    review: {
      state: "rejected",
      reviewedAt: "2026-06-03T10:00:00.000Z",
      reviewedBy: "model-reviewer",
      evidenceRef: "model-evidence/reviews/dc-epl-rejected-v1.md"
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidate.review.state, "rejected");
  assert.equal(result.eligibleForFutureManualProfileChange, false);
});

test("candidate creation rejects fake, synthetic, insufficient or untraceable paired evidence", () => {
  for (const pairedEvidence of [
    paired({ evidenceAssessment: { realHistoricalPair: false, readyForManualReview: false, label: "paired-synthetic-or-insufficient-evidence-do-not-promote", statisticalSignificanceClaimed: false } }),
    paired({ rowCount: 99 }),
    paired({ evidenceRef: null }),
    paired({ evidenceRef: "https://example.com/evidence?token=secret-value" }),
    paired({ automaticPromotionAllowed: true })
  ]) {
    const result = buildTransparent1X2ModelCandidate({
      candidateId: "invalid-evidence-candidate",
      createdAt,
      pairedEvidence,
      profile: profile(),
      review: { state: "pending-review" }
    });
    assert.equal(result.ok, false);
    assert.equal(result.eligibleForFutureManualProfileChange, false);
  }
});

test("candidate profile reuses the reviewed Dixon-Coles safety envelope", () => {
  for (const candidateProfile of [
    profile({ rho: 0.251 }),
    profile({ rho: -0.251 }),
    profile({ sampleSize: 99 }),
    profile({ trainingCutoff: null }),
    profile({ trainingCutoff: "2026-07-01T00:00:00.000Z" }),
    profile({ engine: "opaque-neural-model" }),
    profile({ scope: { sport: "soccer", league: "epl", market: "closing-line" } })
  ]) {
    const result = buildTransparent1X2ModelCandidate({
      candidateId: "invalid-profile-candidate",
      createdAt,
      pairedEvidence: paired(),
      profile: candidateProfile,
      review: { state: "pending-review" }
    });
    assert.equal(result.ok, false);
  }
});

test("pending review cannot smuggle a reviewer or approval evidence", () => {
  const result = buildTransparent1X2ModelCandidate({
    candidateId: "pending-with-reviewer",
    createdAt,
    pairedEvidence: paired(),
    profile: profile(),
    review: {
      state: "pending-review",
      reviewedBy: "someone",
      reviewedAt: "2026-06-03T00:00:00.000Z",
      evidenceRef: "model-evidence/fake-approval.md"
    }
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("pending-review-must-not-claim-human-approval"));
});

test("registry audit catches duplicate IDs and immutable fingerprint drift", () => {
  const one = buildTransparent1X2ModelCandidate({
    candidateId: "candidate-one",
    createdAt,
    pairedEvidence: paired(),
    profile: profile({ profileId: "profile-one" }),
    review: { state: "pending-review" }
  }).candidate;
  const two = structuredClone(one);
  two.profile.rho = -0.05;

  const report = auditTransparent1X2ModelCandidateRegistry({
    ...canonicalRegistry,
    candidates: [one, two]
  });

  assert.equal(report.ok, false);
  assert.ok(report.failures.some((failure) => failure.includes("duplicate-or-missing-candidate-id")));
  assert.ok(report.failures.some((failure) => failure.includes("duplicate-or-missing-profile-id")));
  assert.ok(report.failures.some((failure) => failure.includes("profile-fingerprint-mismatch")));
  assert.ok(report.failures.some((failure) => failure.includes("record-fingerprint-mismatch")));
  assert.equal(report.productionActivationEligible, false);
});

test("approved candidate in a valid registry still has no runtime activation semantics", () => {
  const approved = buildTransparent1X2ModelCandidate({
    candidateId: "approved-registry-record",
    createdAt,
    pairedEvidence: paired(),
    profile: profile({ profileId: "approved-registry-profile" }),
    review: {
      state: "approved-candidate",
      reviewedAt: "2026-06-03T10:00:00.000Z",
      reviewedBy: "model-reviewer",
      evidenceRef: "model-evidence/reviews/approved-registry-record.md"
    }
  }).candidate;

  const report = auditTransparent1X2ModelCandidateRegistry({ ...canonicalRegistry, candidates: [approved] });
  assert.equal(report.ok, true);
  assert.equal(report.approvedCandidateCount, 1);
  assert.equal(report.productionActivationEligible, false);
  assert.equal(report.runtimeLoadingAllowed, false);
  assert.equal(report.automaticPromotionAllowed, false);
});

test("live 1X2 engines do not import or load the candidate registry", async () => {
  const [engine, v2] = await Promise.all([
    source("lib/transparent-1x2-engine.mjs"),
    source("lib/transparent-1x2-v2.mjs")
  ]);
  assert.doesNotMatch(engine, /model-candidate|model-candidates|candidate-registry/i);
  assert.doesNotMatch(v2, /model-candidate|model-candidates|candidate-registry/i);
});
