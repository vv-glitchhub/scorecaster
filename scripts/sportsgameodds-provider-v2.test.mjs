import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const providerSource = () => readFile(new URL("../lib/sportsgameodds-provider.js", import.meta.url), "utf8");
const matchSource = () => readFile(new URL("../lib/sportsgameodds-match-v3.mjs", import.meta.url), "utf8");

test("secondary odds keeps scored team, time and confidence gates unchanged", async () => {
  const [provider, matcher] = await Promise.all([providerSource(), matchSource()]);
  assert.match(matcher, /SPORTSGAMEODDS_MIN_TEAM_SIMILARITY = 0\.55/);
  assert.match(matcher, /SPORTSGAMEODDS_TIME_WINDOW_HOURS = 8/);
  assert.match(matcher, /SPORTSGAMEODDS_MIN_MATCH_CONFIDENCE = 0\.72/);
  assert.match(matcher, /candidate\.homeScore >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY/);
  assert.match(matcher, /candidate\.awayScore >= SPORTSGAMEODDS_MIN_TEAM_SIMILARITY/);
  assert.match(provider, /mode: "low_match_confidence"/);
  assert.match(provider, /evaluateSportsGameOddsCandidates/);
});

test("swapped provider orientation is normalized before ledger use", async () => {
  const provider = await providerSource();
  assert.match(provider, /const home = matchResult\.swapped \? providerAway : providerHome/);
  assert.match(provider, /const away = matchResult\.swapped \? providerHome : providerAway/);
  assert.match(provider, /provider-sides-swapped/);
  assert.match(provider, /homeTeam: match\.homeTeam/);
  assert.match(provider, /awayTeam: match\.awayTeam/);
});

test("provider responses expose bounded match diagnostics without credentials", async () => {
  const provider = await providerSource();
  assert.match(provider, /safeSportsGameOddsMatchDiagnostics/);
  assert.match(provider, /matchConfidence: Number\(matchResult\.confidence\.toFixed\(3\)\)/);
  assert.match(provider, /candidateCount: events\.length/);
  assert.match(provider, /matchDiagnostics/);
  assert.doesNotMatch(provider, /data:\s*\{[^}]*apiKey/s);
});
