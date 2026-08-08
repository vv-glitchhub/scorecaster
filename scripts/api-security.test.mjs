import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  boundedNumber,
  cleanText,
  getBearerToken,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../lib/api-security-core.mjs";

const readRepositoryFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cleanText removes controls, collapses whitespace and limits length", () => {
  assert.equal(cleanText("  hello\u0000   world  ", 20), "hello world");
  assert.equal(cleanText("abcdef", 3), "abc");
});

test("boundedNumber rejects non-finite and out-of-range input", () => {
  assert.equal(boundedNumber("2.5", { min: 1, max: 3 }), 2.5);
  assert.equal(boundedNumber(Infinity, { min: 1, max: 3 }), null);
  assert.equal(boundedNumber(4, { min: 1, max: 3, fallback: 2 }), 2);
});

test("bearer tokens require a bounded non-trivial value", () => {
  const valid = new Request("https://scorecaster.example/api", {
    headers: { Authorization: `Bearer ${"a".repeat(24)}` }
  });
  const short = new Request("https://scorecaster.example/api", {
    headers: { Authorization: "Bearer short" }
  });
  assert.equal(getBearerToken(valid), "a".repeat(24));
  assert.equal(getBearerToken(short), null);
});

test("cookie mutations require the exact same origin", () => {
  const same = new Request("https://scorecaster.example/api", {
    headers: { Origin: "https://scorecaster.example" }
  });
  const other = new Request("https://scorecaster.example/api", {
    headers: { Origin: "https://attacker.example" }
  });
  const mobile = new Request("https://scorecaster.example/api", {
    headers: { Authorization: `Bearer ${"b".repeat(24)}` }
  });

  assert.equal(mutationOriginAllowed(same), true);
  assert.equal(mutationOriginAllowed(other), false);
  assert.equal(mutationOriginAllowed(mobile), true);
});

test("JSON body parser rejects wrong content type and oversized bodies", async () => {
  const wrongType = new Request("https://scorecaster.example/api", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}"
  });
  const oversized = new Request("https://scorecaster.example/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(100) })
  });
  const valid = new Request("https://scorecaster.example/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true })
  });

  assert.equal((await readJsonBody(wrongType)).status, 415);
  assert.equal((await readJsonBody(oversized, 32)).status, 413);
  assert.deepEqual((await readJsonBody(valid)).data, { ok: true });
});

test("responses remain non-cacheable and can include Retry-After", async () => {
  const response = jsonResponse(
    { ok: false },
    429,
    "request_12345678",
    { "Retry-After": "60" }
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(body.requestId, "request_12345678");
});

test("request IDs accept safe values and replace malformed input", () => {
  const safe = new Request("https://scorecaster.example/api", {
    headers: { "X-Request-Id": "mobile_12345678" }
  });
  const unsafe = new Request("https://scorecaster.example/api", {
    headers: { "X-Request-Id": "bad id with spaces" }
  });

  assert.equal(getRequestId(safe), "mobile_12345678");
  assert.match(getRequestId(unsafe), /^[0-9a-f-]{36}$/i);
});

test("automatic score settlement is authenticated, bounded and server-only", async () => {
  const route = await readRepositoryFile("app/api/cloud/bets/settle/route.js");

  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"cloud_bets_auto_settle"/);
  assert.match(route, /limit:\s*3/);
  assert.match(route, /windowSeconds:\s*3600/);
  assert.match(route, /MAX_SPORTS_PER_CHECK\s*=\s*6/);
  assert.match(route, /MAX_OPEN_BETS\s*=\s*100/);
  assert.match(route, /MAX_SETTLEMENTS_PER_CHECK\s*=\s*50/);
  assert.match(route, /process\.env\.ODDS_API_KEY/);
  assert.doesNotMatch(route, /(?:NEXT|EXPO)_PUBLIC_ODDS_API_KEY/);
  assert.match(route, /\.eq\("user_id",\s*auth\.user\.id\)/);
  assert.match(route, /\.eq\("status",\s*"open"\)/);
});

test("database paper-risk enforcement covers concurrency, league and quality limits", async () => {
  const migration = await readRepositoryFile("supabase/scorecaster_paper_risk_limits.sql");

  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /for update;/i);
  assert.match(migration, /minimum edge/i);
  assert.match(migration, /minimum confidence/i);
  assert.match(migration, /league exposure/i);
  assert.match(migration, /status = 'open'/i);
  assert.match(migration, /source', ''/i);
  assert.match(migration, /errcode = '23514'/i);
});

await import("./protected-api-contract-audit.test.mjs");
