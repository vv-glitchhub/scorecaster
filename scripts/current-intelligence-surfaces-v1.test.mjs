import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("current value observations fail closed on stale captures", async () => {
  const route = await file("app/api/value-bets/route.js");

  assert.match(route, /MAX_CAPTURE_AGE_MS = 30 \* 60 \* 1000/);
  assert.match(route, /COHERENT_CAPTURE_WINDOW_MS = 15 \* 60 \* 1000/);
  assert.match(route, /from\("unified_data_snapshots"\)/);
  assert.match(route, /newestCapturedAt/);
  assert.match(route, /freshness: "stale"/);
  assert.match(route, /mapped\.best_ev <= 1/);
  assert.doesNotMatch(route, /from\("value_bets"\)/);
});

test("legacy value client reads the compatibility envelope", async () => {
  const client = await file("app/components/ValueBetsSection.js");
  assert.match(client, /Array\.isArray\(data\?\.valueBets\)/);
  assert.match(client, /Unified Data/);
  assert.match(client, /paper-only/);
});
