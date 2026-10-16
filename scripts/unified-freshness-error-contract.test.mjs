import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("freshness failures identify safe failure class and require capture fallback", async () => {
  const route = await readFile(new URL("../app/api/unified-data/freshness/route.js", import.meta.url), "utf8");
  assert.match(route, /supabase-admin-unconfigured/);
  assert.match(route, /snapshot-query-failed/);
  assert.match(route, /protectedWorkerRequired: true/);
  assert.match(route, /\.order\("captured_at", \{ ascending: false \}\)/);
  assert.match(route, /evaluateUnifiedCaptureFreshness/);
  assert.match(route, /paperOnly: true/);
});
