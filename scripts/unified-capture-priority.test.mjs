import test from "node:test";
import assert from "node:assert/strict";
import { selectCapturePicks } from "../lib/unified-capture-priority-v1.mjs";

const make = (league, id) => ({ league, eventId: String(id), marketKey: "h2h", selection: "home", point: null });
test("prioritizes European football and bounds historical writes", () => {
  const mls = Array.from({ length: 30 }, (_, i) => make("soccer_usa_mls", i));
  const epl = Array.from({ length: 15 }, (_, i) => make("soccer_epl", i + 100));
  const chosen = selectCapturePicks([...mls, ...epl]);
  assert.equal(chosen.length, 18);
  assert.equal(chosen.filter((p) => p.league === "soccer_epl").length, 12);
  assert.equal(chosen.filter((p) => p.league === "soccer_usa_mls").length, 6);
});
test("deduplicates same event-market-selection before capture", () => {
  const a = make("soccer_epl", 1);
  assert.equal(selectCapturePicks([a, { ...a }, make("soccer_epl", 2)]).length, 2);
});
test("does not mutate original candidate list", () => {
  const picks = [make("soccer_usa_mls", 1), make("soccer_epl", 2)];
  selectCapturePicks(picks);
  assert.equal(picks.length, 2);
  assert.equal(picks[0].league, "soccer_usa_mls");
});

test("MLS cannot exhaust unused owned-football budget", () => {
  const onlyMls = Array.from({ length: 30 }, (_, i) => make("soccer_usa_mls", i));
  assert.equal(selectCapturePicks(onlyMls).length, 6);
});
