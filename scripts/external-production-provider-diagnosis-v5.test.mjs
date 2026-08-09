import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = () => readFile(new URL("scripts/external-production-provider-diagnosis.mjs", root), "utf8");

test("external provider diagnosis retains only safe aggregate usage evidence", async () => {
  const text = await source();
  assert.match(text, /scorecaster-external-production-provider-diagnosis-v5/);
  assert.match(text, /bindingLimits/);
  assert.match(text, /maximumObservedRequestRatio/);
  assert.match(text, /maximumObservedEntityRatio/);
  assert.match(text, /observationsCarryingUsage/);
  assert.match(text, /repeatedEventCopiesAreNotIndependentSamples/);
  assert.match(text, /usageEvidenceAggregateOnly:\s*true/);
  assert.match(text, /accountCountersRetained:\s*false/);

  for (const forbidden of [
    /currentRequests/,
    /maxRequests/,
    /currentEntities/,
    /maxEntities/,
    /keyID/,
    /customerID/,
    /SPORTSGAMEODDS_API_KEY/,
    /x-api-key/i,
    /authorization\s*:/i,
    /bearer\s/i
  ]) assert.doesNotMatch(text, forbidden);
});

test("usage sanitizer remains fail-closed when no evidence exists", async () => {
  const text = await source();
  assert.match(text, /observed:\s*false/);
  assert.match(text, /bindingLimits:\s*\[\]/);
  assert.match(text, /identifiersExposed:\s*false/);
  assert.match(text, /rawPayloadExposed:\s*false/);
});
