import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSportsGameOddsUsagePayload,
  safeSportsGameOddsUsageEvidence,
  SPORTSGAMEODDS_USAGE_INTERVALS
} from "../lib/sportsgameodds-usage-v1.mjs";

function interval(overrides = {}) {
  return {
    "max-requests": 10,
    "current-requests": 7,
    "max-entities": 100,
    "current-entities": 25,
    ...overrides
  };
}

test("usage sanitizer keeps only numeric interval evidence and drops account identifiers", () => {
  const safe = sanitizeSportsGameOddsUsagePayload({
    success: true,
    data: {
      isActive: true,
      keyID: "secret-key-id",
      customerID: "customer-123",
      email: "private@example.com",
      rateLimits: {
        "per-second": interval(),
        "per-minute": interval({ "current-requests": 10 }),
        "per-hour": interval(),
        "per-day": interval(),
        "per-month": interval()
      }
    }
  });

  assert.equal(safe.isActive, true);
  assert.equal(safe.intervals["per-minute"].currentRequests, 10);
  assert.equal(safe.intervals["per-minute"].maxRequests, 10);
  assert.equal(safe.intervals["per-minute"].requestRatio, 1);
  assert.deepEqual(safe.bindingLimits, ["per-minute:requests"]);
  const serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, /secret-key-id|customer-123|private@example\.com|keyID|customerID|email/i);
  assert.equal(safe.identifiersRetained, false);
  assert.equal(safe.emailRetained, false);
  assert.equal(safe.rawPayloadRetained, false);
});

test("camel-case documented variants are normalized", () => {
  const safe = sanitizeSportsGameOddsUsagePayload({
    success: true,
    data: {
      isActive: false,
      rateLimits: Object.fromEntries(SPORTSGAMEODDS_USAGE_INTERVALS.map((name) => [name, {
        maxRequestsPerInterval: 20,
        currentIntervalRequests: 5,
        maxEntitiesPerInterval: 40,
        currentIntervalEntities: 10
      }]))
    }
  });
  assert.equal(safe.isActive, false);
  assert.equal(safe.intervals["per-hour"].requestRatio, 0.25);
  assert.equal(safe.intervals["per-hour"].entityRatio, 0.25);
  assert.deepEqual(safe.bindingLimits, []);
});

test("unlimited or missing maxima stay null instead of becoming invented finite limits", () => {
  const safe = sanitizeSportsGameOddsUsagePayload({
    success: true,
    data: {
      rateLimits: {
        "per-minute": {
          maxRequests: "unlimited",
          currentRequests: 9,
          maxEntities: null,
          currentEntities: 3
        }
      }
    }
  });
  assert.equal(safe.intervals["per-minute"].maxRequests, null);
  assert.equal(safe.intervals["per-minute"].currentRequests, 9);
  assert.equal(safe.intervals["per-minute"].requestRatio, null);
  assert.equal(safe.intervals["per-minute"].entityRatio, null);
  assert.deepEqual(safe.bindingLimits, []);
});

test("invalid provider payloads fail closed to null", () => {
  assert.equal(sanitizeSportsGameOddsUsagePayload(null), null);
  assert.equal(sanitizeSportsGameOddsUsagePayload({ success: false, data: {} }), null);
  assert.equal(sanitizeSportsGameOddsUsagePayload({ success: true, data: null }), null);
});

test("safe evidence re-sanitizes binding labels and numeric intervals", () => {
  const safe = safeSportsGameOddsUsageEvidence({
    isActive: true,
    bindingLimits: ["per-minute:requests", "not-allowed:secret", "per-month:entities"],
    intervals: {
      "per-minute": { maxRequests: 10, currentRequests: 11, maxEntities: "unlimited", currentEntities: 1 },
      "per-month": { maxRequests: 1000, currentRequests: 500, maxEntities: 2500, currentEntities: 2500 }
    },
    keyID: "must-disappear",
    email: "must-disappear@example.com"
  });
  assert.deepEqual(safe.bindingLimits, ["per-minute:requests", "per-month:entities"]);
  assert.equal(safe.intervals["per-minute"].requestRatio, 1.1);
  assert.equal(safe.intervals["per-month"].entityRatio, 1);
  assert.doesNotMatch(JSON.stringify(safe), /must-disappear|keyID|email/i);
});
