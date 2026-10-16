import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Top Picks uses the validated odds handler in-process", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");
  assert.match(route, /import \{ GET as getOddsRoute \} from "\.\.\/odds\/route"/);
  assert.match(route, /await getOddsRoute\(new Request\(/);
  assert.doesNotMatch(route, /await fetch\(\s*\x60\$\{origin\}\/api\/odds/);
});

test("Odds route retains provider failure and H2H fallback behavior", async () => {
  const route = await readFile(new URL("../app/api/odds/route.js", import.meta.url), "utf8");
  assert.match(route, /requestedMarkets\.includes\("h2h"\)/);
  assert.match(route, /fetchPrimaryOdds\(\{ sport, markets: "h2h", apiKey \}\)/);
  assert.match(route, /upstreamStatus/);
});
