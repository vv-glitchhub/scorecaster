import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { freeDataOnlyMode } from "../lib/free-data-only.mjs";

test("free-data-only mode is an explicit opt-in", () => {
  assert.equal(freeDataOnlyMode({}), false);
  assert.equal(freeDataOnlyMode({ SCORECASTER_FREE_DATA_ONLY: "false" }), false);
  assert.equal(freeDataOnlyMode({ SCORECASTER_FREE_DATA_ONLY: "true" }), true);
  assert.equal(freeDataOnlyMode({ SCORECASTER_FREE_DATA_ONLY: "ON" }), true);
});

test("paid API entry points check the opt-in before outbound calls", async () => {
  const paths = [
    "app/api/odds/route.js",
    "app/api/sports/route.js",
    "lib/odds-service.js",
    "lib/paper-score-provider.js",
    "lib/sportsgameodds-provider.js",
    "lib/sportsdata-fetcher.js",
    "lib/news-fetcher.js",
    "app/api/agent/explain/route.js"
  ];
  for (const path of paths) {
    const content = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(content, /freeDataOnlyMode\(/, `${path} should guard paid-provider access`);
  }
});

test("the public odds API preserves an explicit unavailable state, not fabricated prices", async () => {
  const source = await readFile(new URL("../app/api/odds/route.js", import.meta.url), "utf8");
  assert.match(source, /paid-odds-disabled/);
  assert.match(source, /, 503\)/);
  assert.match(source, /data: \[\]/);
});
