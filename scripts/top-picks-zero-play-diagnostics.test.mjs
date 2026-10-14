import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Top Picks explains zero-PLAY pipeline status without bypassing safety", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");
  assert.match(route, /pipelineStatus/);
  assert.match(route, /rejectionReasons/);
  assert.match(route, /no-provider-games/);
  assert.match(route, /no-valid-upcoming-fixtures/);
  assert.match(route, /no-market-candidates/);
  assert.match(route, /no-qualified-play/);
  assert.match(route, /independent-evidence-or-safety-gate/);
  assert.match(route, /preserveSafetyGate\(marketDecision, pick\)/);
  assert.match(route, /allowsIndependentPlayEvidence !== true/);
  assert.match(route, /paperOnly: true/);
});
