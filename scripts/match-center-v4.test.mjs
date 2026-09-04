import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Match Center V4 consolidates the verified event surface without inventing unavailable data", async () => {
  const [page, center] = await Promise.all([
    read("app/event/[eventId]/page.jsx"),
    read("app/event/[eventId]/MatchCenterV4.jsx")
  ]);

  assert.match(page, /MatchCenterV4/);
  assert.match(page, /<MatchCenterV4 eventId=\{eventId\} sport=\{sport\} selection=\{selection\}/);
  assert.match(center, /data-match-center-v4/);
  for (const token of ["summary", "form", "lineups", "h2h", "standings", "players", "markets"]) {
    assert.match(center, new RegExp(`\\"${token}\\"`));
  }
  assert.match(center, /\/api\/event-detail/);
  assert.match(center, /cache: "no-store"/);
  assert.match(center, /verified data required/);
  assert.match(center, /A predicted XI is never invented/);
  assert.match(center, /H2H awaits verified history data/);
  assert.match(center, /Standings data bridge is not active yet/);
  assert.match(center, /paper only/);
  assert.doesNotMatch(center, /window\.location|bookmaker.*(?:login|password)|placeBet|deposit|withdraw/i);
});
