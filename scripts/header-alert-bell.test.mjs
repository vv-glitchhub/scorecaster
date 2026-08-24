import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("global header mounts the alert bell next to shared controls", async () => {
  const shell = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  assert.match(shell, /import HeaderAlertBell from "\.\/HeaderAlertBell"/);
  assert.match(shell, /<HeaderAlertBell\s*\/>/);
  assert.ok(shell.indexOf("<HeaderAlertBell />") < shell.indexOf("<ThemeToggle"));
});

test("alert bell reads only the lightweight unread inbox and polls conservatively", async () => {
  const bell = await readFile(new URL("../app/components/HeaderAlertBell.jsx", import.meta.url), "utf8");
  assert.match(bell, /\/api\/cloud\/alerts\?status=unread&limit=5/);
  assert.match(bell, /const REFRESH_MS = 120_000/);
  assert.match(bell, /document\.visibilityState === "visible"/);
  assert.match(bell, /visibilitychange/);
  assert.doesNotMatch(bell, /\/api\/top-picks/);
  assert.doesNotMatch(bell, /\/api\/recommendations/);
});

test("signed-out alert bell degrades to login without surfacing a header error", async () => {
  const bell = await readFile(new URL("../app/components/HeaderAlertBell.jsx", import.meta.url), "utf8");
  assert.match(bell, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(bell, /<Link href="\/login"/);
  assert.match(bell, /Header alerts are non-blocking/);
});

test("alert bell exposes unread count, highest-priority preview and server-only navigation", async () => {
  const bell = await readFile(new URL("../app/components/HeaderAlertBell.jsx", import.meta.url), "utf8");
  assert.match(bell, /summary\.unread/);
  assert.match(bell, /severityRank/);
  assert.match(bell, /topAlert/);
  assert.match(bell, /href="\/alerts"/);
  assert.match(bell, /href="\/watchlist"/);
  assert.doesNotMatch(bell, /suggestedStake|stake|placeBet|realMoney/i);
});
