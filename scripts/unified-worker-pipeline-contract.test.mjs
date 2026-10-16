import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("unified worker reuses Top Picks in-process without nested HTTP", async () => {
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  assert.match(route, /import \{ GET as getTopPicksRoute \} from "\.\.\/\.\.\/top-picks\/route"/);
  assert.match(route, /await getTopPicksRoute\(/);
  assert.doesNotMatch(route, /fetch\(\x60\$\{origin\}\/api\/top-picks/);
  assert.match(route, /topPicksPipelineStatus: pipelineStatus/);
  assert.match(route, /zeroSelections: capture\.stored\.length === 0/);
});

test("empty capture cannot resolve active incidents", async () => {
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  assert.match(route, /const incidentSync = capture\.stored\.length/);
  assert.match(route, /skipped: "no-captured-selections"/);
  assert.match(route, /resolved: 0/);
});
