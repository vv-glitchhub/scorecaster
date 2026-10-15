import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("protected collector invokes Top Picks directly after authorization", async () => {
  const text = await readFile(new URL("../app/api/internal/collector/route.js",import.meta.url),"utf8");
  const authorized = text.indexOf("if (!authorized(request))");
  const call = text.indexOf("await getTopPicksRoute(new Request");
  assert.ok(authorized >= 0 && call > authorized);
  assert.match(text, /import \{ GET as getTopPicksRoute \} from "\.\.\/\.\.\/top-picks\/route"/);
  assert.doesNotMatch(text, /await fetch\(\x60\$\{origin\}\/api\/top-picks/);
});

test("collector discloses only fixed failure stages, not production exception details", async () => {
  const text = await readFile(new URL("../app/api/internal/collector/route.js",import.meta.url),"utf8");
  for (const stage of ["create-run","acquire-data","external-collector","save-records","finish-run"]) {
    assert.ok(text.includes(`failureStage = "${stage}"`) || text.includes(`failureStage = "${stage}"`), stage);
  }
  assert.match(text, /failureStage,/);
  assert.match(text, /process\.env\.NODE_ENV === "production" \? "Collector capture failed" : String\(error\)/);
  assert.match(text, /if \(!authorized\(request\)\)/);
});

test("scheduled collector logs only allowlisted failure stages", async () => {
  const workflow = await readFile(new URL("../.github/workflows/collector.yml",import.meta.url),"utf8");
  assert.match(workflow, /stage=\$\(jq -r '\.failureStage \/\/ empty' \/tmp\/collector\.json/);
  assert.match(workflow, /create-run\|acquire-data\|external-collector\|save-records\|finish-run/);
  assert.doesNotMatch(workflow, /cat \/tmp\/collector\.json/);
});
