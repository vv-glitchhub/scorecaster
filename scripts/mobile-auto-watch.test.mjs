import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("native More hub exposes Auto-Watch without crowding the primary tab bar", async () => {
  const more = await readFile(new URL("../mobile/src/screens/MoreScreen.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  assert.match(more, /import AutoWatchScreen from "\.\/AutoWatchScreen"/);
  assert.match(more, /autoWatchOpen/);
  assert.match(more, /<AutoWatchScreen\s*\/>/);
  const tabBlock = app.slice(app.indexOf("const tabs"), app.indexOf("function chooseTab"));
  assert.doesNotMatch(tabBlock, /auto-watch|autoWatch/i);
});

test("native Auto-Watch uses recommendation and private preference APIs only", async () => {
  const screen = await readFile(new URL("../mobile/src/screens/AutoWatchScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /\/api\/cloud\/auto-watch-recommendations/);
  assert.match(screen, /\/api\/recommendations\?limit=3/);
  assert.match(screen, /authenticated:\s*false/);
  assert.match(screen, /method:\s*"PATCH"/);
  assert.doesNotMatch(screen, /\/api\/cloud\/bets/);
  assert.doesNotMatch(screen, /placeBet|suggestedStake|realMoneyActionAvailable\s*:\s*true/i);
});

test("native Auto-Watch keeps decision and evidence gates visible", async () => {
  const screen = await readFile(new URL("../mobile/src/screens/AutoWatchScreen.tsx", import.meta.url), "utf8");
  assert.match(screen, /readiness/);
  assert.match(screen, /nextGate/);
  assert.match(screen, /verified-evidence/);
  assert.match(screen, /CAUTION/);
  assert.match(screen, /PLAY/);
  assert.match(screen, /SKIP/);
  assert.match(screen, /paper/i);
});
