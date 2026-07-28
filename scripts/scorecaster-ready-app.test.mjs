import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("home page uses the unified ready app", async () => {
  const page = await file("app/page.jsx");
  assert.match(page, /ScorecasterReadyClient/);
});

test("unified API is publishable-only and bounded", async () => {
  const route = await file("app/api/scorecaster-app/route.js");
  assert.match(route, /\.eq\("publishable", true\)/);
  assert.match(route, /limit\), 10000, 100, 10000/);
  assert.match(route, /buildProductionControlCenter/);
  assert.match(route, /buildIntelligenceBundle/);
  assert.match(route, /buildIntelligenceV4/);
});

test("ready app exposes all core production views", async () => {
  const client = await file("app/ScorecasterReadyClient.jsx");
  for (const marker of ["Daily Top 3", "AI Coach", "Closing line", "All data", "paper-only", "calibration", "riskSignals"]) {
    assert.ok(client.includes(marker), `missing ${marker}`);
  }
  assert.match(client, /\/api\/scorecaster-app/);
  assert.match(client, /Näytä kaikki data/);
});

test("ready app keeps real-money execution disabled", async () => {
  const client = await file("app/ScorecasterReadyClient.jsx");
  const route = await file("app/api/scorecaster-app/route.js");
  assert.match(client, /ei aseta vetoja eikä siirrä rahaa/);
  assert.doesNotMatch(route, /placeBet|executeBet|payment|withdraw/i);
});
