import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("capture workflow rejects zero-selection success responses", async () => {
  const workflow = await readFile(new URL("../.github/workflows/unified-data-capture.yml", import.meta.url), "utf8");
  assert.match(workflow, /selections=\$\(jq -r '\.selections \/\/ 0' \/tmp\/unified\.json\)/);
  assert.match(workflow, /\[ "\$selections" -eq 0 \]/);
  assert.match(workflow, /exit 1\s+fi\s+echo "Fallback schedule captured \$selections verified selections\."/);
});

test("capture worker reports real saved selections, not merely candidate count", async () => {
  const route = await readFile(new URL("../app/api/internal/unified-data/route.js", import.meta.url), "utf8");
  assert.match(route, /selections:\s*capture\.stored\.length/);
  assert.match(route, /zeroSelections:\s*capture\.stored\.length === 0/);
});
