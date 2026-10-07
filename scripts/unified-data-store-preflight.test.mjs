import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIFIED_DATA_STORE_TIMEOUT_MS,
  unifiedDataStoreReady
} from "../lib/unified-data-store-preflight.mjs";

function datastore(run) {
  const calls = [];
  const builder = {
    select(columns) { calls.push(["select", columns]); return this; },
    limit(count) { calls.push(["limit", count]); return this; },
    abortSignal(signal) { calls.push(["signal", signal]); return run(signal); }
  };
  return {
    calls,
    from(table) { calls.push(["from", table]); return builder; }
  };
}

test("an empty reachable datastore permits capture with a bounded read", async () => {
  const admin = datastore(async () => ({ data: [], error: null }));
  assert.equal(await unifiedDataStoreReady(admin), true);
  assert.deepEqual(admin.calls.slice(0, 3), [
    ["from", "unified_data_snapshots"], ["select", "id"], ["limit", 1]
  ]);
  assert.ok(admin.calls[3][1] instanceof AbortSignal);
  assert.equal(UNIFIED_DATA_STORE_TIMEOUT_MS, 5000);
});

test("a valid snapshot result permits capture", async () => {
  assert.equal(await unifiedDataStoreReady(datastore(async () => ({ data: [{ id: "snapshot" }], error: null }))), true);
});

test("HTTP 402 restrictions suppress provider work", async () => {
  const admin = datastore(async () => ({ status: 402, data: null, error: { message: "Payment Required" } }));
  assert.equal(await unifiedDataStoreReady(admin), false);
});

test("missing schema and rejected requests suppress provider work", async () => {
  assert.equal(await unifiedDataStoreReady(datastore(async () => ({ data: null, error: { code: "42P01" } }))), false);
  assert.equal(await unifiedDataStoreReady(datastore(async () => { throw new Error("unreachable"); })), false);
});

test("malformed responses never authorize capture", async () => {
  for (const result of [undefined, null, {}, { data: [] }, { error: null }, { data: null, error: null }, { data: {}, error: null }]) {
    assert.equal(await unifiedDataStoreReady(datastore(async () => result)), false);
  }
});

test("a slow request is cancelled and fails closed", async () => {
  let cancelled = false;
  const admin = datastore((signal) => new Promise((resolve, reject) => {
    const pending = setTimeout(() => resolve({ data: [], error: null }), 1000);
    signal.addEventListener("abort", () => {
      cancelled = true;
      clearTimeout(pending);
      reject(signal.reason);
    }, { once: true });
  }));
  assert.equal(await unifiedDataStoreReady(admin, { timeoutMs: 10 }), false);
  assert.equal(cancelled, true);
});
