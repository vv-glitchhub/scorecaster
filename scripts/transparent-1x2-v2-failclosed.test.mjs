import test from "node:test";
import assert from "node:assert/strict";

import { buildTransparent1X2V2 } from "../lib/transparent-1x2-v2.mjs";

const baseInput = {
  homeTeam: { team: "Home", rating: 1600, attack: 63, defense: 59, form: 0.06 },
  awayTeam: { team: "Away", rating: 1540, attack: 57, defense: 55, form: 0.01 },
  generatedAt: "2026-08-01T12:00:00.000Z"
};

test("a validated challenger with too little evidence fails closed", () => {
  const result = buildTransparent1X2V2(baseInput, {
    challengerProfile: {
      status: "validated",
      profileId: "too-small",
      rho: -0.05,
      sampleSize: 99,
      trainingCutoff: "2026-07-31T00:00:00.000Z"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-validated-challenger-profile");
  assert.ok(result.challengerProfile.errors.includes("insufficient-validation-sample"));
  assert.equal(result.productionProbabilityChangedByChallenger, false);
  assert.equal(result.automaticPromotionAllowed, false);
});

test("a validated challenger with out-of-range rho fails closed", () => {
  const result = buildTransparent1X2V2(baseInput, {
    challengerProfile: {
      status: "validated",
      profileId: "invalid-rho",
      rho: 0.4,
      sampleSize: 500,
      trainingCutoff: "2026-07-31T00:00:00.000Z"
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-validated-challenger-profile");
  assert.ok(result.challengerProfile.errors.includes("invalid-dixon-coles-rho"));
  assert.equal(result.productionProbabilityChangedByChallenger, false);
  assert.equal(result.paperOnly, true);
});
