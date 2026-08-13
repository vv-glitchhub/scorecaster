import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("../app/market-timeline/TimelinePanel.jsx", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/market-timeline/MarketTimelineClient.jsx", import.meta.url), "utf8");

test("Market Activity V2 exposes stored-history metrics", () => {
  assert.match(panel, /data-market-activity-v2/);
  assert.match(panel, /impliedProbabilityChange/);
  assert.match(panel, /bookmakerChanges/);
  assert.match(panel, /spanHours/);
  assert.match(panel, /Latest model/);
  assert.match(panel, /Recent activity/);
});

test("Market Activity V2 stays descriptive", () => {
  assert.match(panel, /Price movement is descriptive market history, not outcome evidence/);
  assert.doesNotMatch(panel, /sharp money detected/i);
  assert.doesNotMatch(panel, /inside information detected/i);
});

test("reading stays separate from explicit capture", () => {
  assert.match(client, /method: "POST"/);
  assert.match(client, /void capture\(\)/);
  assert.doesNotMatch(panel, /method: "POST"/);
  assert.doesNotMatch(panel, /fetch\(/);
});
