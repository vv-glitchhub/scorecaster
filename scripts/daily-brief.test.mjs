import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Daily Brief is discoverable and uses the shared Scorecaster product shell", async () => {
  const page = await read("app/brief/page.jsx");
  const client = await read("app/brief/DailyBriefClient.jsx");
  const shell = await read("app/components/AppShell.jsx");

  assert.match(page, /DailyBriefClient/);
  assert.match(page, /Daily Brief \| Scorecaster/);
  assert.match(shell, /href: "\/brief"/);
  assert.match(shell, /Päivän briefi/);

  for (const component of ["PageHero", "TrustBar", "MetricTile", "DecisionBadge", "MatchIdentity", "EmptyState"]) {
    assert.match(client, new RegExp(component));
  }
});

test("Daily Brief separates PLAY WATCH and SKIP without overriding probabilities", async () => {
  const client = await read("app/brief/DailyBriefClient.jsx");

  assert.match(client, /normalizedDecision/);
  assert.match(client, /buckets\.play/);
  assert.match(client, /buckets\.watch/);
  assert.match(client, /buckets\.skip/);
  assert.match(client, /focus === "observe"/);
  assert.match(client, /focus === "selective"/);
  assert.match(client, /Se ei lisää oikean rahan toimintaa eikä muuta mallin todennäköisyyksiä/);
  assert.match(client, /No probability overrides/);
  assert.match(client, /SKIP is valid/);
  assert.doesNotMatch(client, /placeBet|realMoney|deposit|withdraw/);
});

test("Daily Brief keeps user preferences and snapshots local and fetches governed Top Picks", async () => {
  const client = await read("app/brief/DailyBriefClient.jsx");

  assert.match(client, /fetch\("\/api\/top-picks\?view=summary"/);
  assert.match(client, /scorecaster_daily_brief_focus/);
  assert.match(client, /scorecaster_daily_brief_snapshot/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(client, /getTrackedBets/);
  assert.match(client, /calculateTrackingStats/);
  assert.match(client, /cache: "no-store"/);
});
