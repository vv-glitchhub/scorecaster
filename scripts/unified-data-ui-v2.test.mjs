import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("web and native select ledgers by event plus selection", async () => {
  const [web, mobile] = await Promise.all([
    source("app/data-layer/UnifiedDataLayerClient.jsx"),
    source("mobile/src/screens/DataLayerScreen.tsx")
  ]);
  assert.match(web, /row\.eventId.*row\.selection/);
  assert.match(web, /setSelectedKey/);
  assert.match(mobile, /function rowKey/);
  assert.match(mobile, /setSelectedKey/);
});

test("native current ledger survives an unavailable history layer", async () => {
  const mobile = await source("mobile/src/screens/DataLayerScreen.tsx");
  const currentLoad = mobile.indexOf('apiRequest<Payload>("/api/data-layer")');
  const historyTry = mobile.indexOf("try {", currentLoad + 1);
  const historyLoad = mobile.indexOf('apiRequest<HistoryPayload>("/api/data-layer/history');
  assert.ok(currentLoad >= 0 && historyTry > currentLoad && historyLoad > historyTry);
  assert.match(mobile, /setHistory\(emptyHistory/);
  assert.match(mobile, /Nykyinen ledger toimii silti/);
});

test("web exposes history, calibration, provider health and combined incidents", async () => {
  const [page, history, calibration, alerts] = await Promise.all([
    source("app/data-layer/page.jsx"),
    source("app/data-layer/UnifiedDataHistoryClient.jsx"),
    source("app/data-layer/UnifiedCalibrationClient.jsx"),
    source("app/alerts/DiagnosticIncidentPanel.jsx")
  ]);
  assert.match(page, /UnifiedCalibrationClient/);
  assert.match(history, /Provider Quality/);
  assert.match(history, /Closing odds/);
  assert.match(calibration, /\/api\/data-layer\/calibration/);
  assert.match(calibration, /automatic PLAY upgrades/);
  assert.match(alerts, /\/api\/data-layer\/history/);
  assert.match(alerts, /unified-data/);
});