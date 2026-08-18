import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../.github/workflows/pr-run-deduplicator.yml", import.meta.url);

async function workflow() {
  return readFile(workflowUrl, "utf8");
}

test("PR run deduplicator is scoped to same-repository pull requests only", async () => {
  const source = await workflow();
  assert.match(source, /pull_request:/);
  assert.match(source, /types: \[opened, synchronize, reopened\]/);
  assert.match(source, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.doesNotMatch(source, /^\s*schedule:/m);
  assert.doesNotMatch(source, /^\s*push:/m);
  assert.doesNotMatch(source, /pull_request_target/);
});

test("deduplicator can cancel Actions runs but has no repository write scope", async () => {
  const source = await workflow();
  assert.match(source, /actions: write/);
  assert.match(source, /contents: read/);
  assert.doesNotMatch(source, /contents: write/);
  assert.doesNotMatch(source, /issues: write/);
  assert.doesNotMatch(source, /pull-requests: write/);
});

test("only stale pull-request runs from the same head branch are selected", async () => {
  const source = await workflow();
  assert.match(source, /-f event=pull_request/);
  assert.match(source, /-f branch="\$PR_HEAD_REF"/);
  assert.match(source, /select\(\.event == "pull_request"\)/);
  assert.match(source, /select\(\.head_sha != \$current_sha\)/);
  assert.match(source, /select\(\(\.id \| tostring\) != \$current_run\)/);
  assert.match(source, /actions\/runs\/\$\{run_id\}\/cancel/);
});

test("current PR commit and scheduled production workflows are explicitly outside cancellation", async () => {
  const source = await workflow();
  assert.match(source, /CURRENT_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(source, /CURRENT_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.match(source, /Scheduled workflows and push runs are outside this query/);
  assert.doesNotMatch(source, /collector\.yml|unified-data-capture\.yml|notification-delivery\.yml/);
});

test("deduplicator itself coalesces repeated synchronize events for one PR", async () => {
  const source = await workflow();
  assert.match(source, /group: scorecaster-pr-deduplicator-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(source, /cancel-in-progress: true/);
});
