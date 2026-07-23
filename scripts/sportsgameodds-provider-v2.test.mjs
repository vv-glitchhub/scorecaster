import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = () => readFile(new URL("../lib/sportsgameodds-provider.js", import.meta.url), "utf8");

test("secondary odds requires scored team and time matching", async () => {
  const provider = await source();
  assert.match(provider, /MIN_MATCH_CONFIDENCE = 0\.72/);
  assert.match(provider, /homeScore >= 0\.55/);
  assert.match(provider, /awayScore >= 0\.55/);
  assert.match(provider, /timeDifferenceHours <= 8/);
  assert.match(provider, /mode: "low_match_confidence"/);
});

test("swapped provider orientation is normalized before ledger use", async () => {
  const provider = await source();
  assert.match(provider, /const home = matchResult\.swapped \? providerAway : providerHome/);
  assert.match(provider, /const away = matchResult\.swapped \? providerHome : providerAway/);
  assert.match(provider, /provider-sides-swapped/);
  assert.match(provider, /homeTeam: match\.homeTeam/);
  assert.match(provider, /awayTeam: match\.awayTeam/);
});

test("provider responses expose match confidence without credentials", async () => {
  const provider = await source();
  assert.match(provider, /matchConfidence: Number\(matchResult\.confidence\.toFixed\(3\)\)/);
  assert.match(provider, /candidateCount: events\.length/);
  assert.doesNotMatch(provider, /data:\s*\{[^}]*apiKey/s);
});