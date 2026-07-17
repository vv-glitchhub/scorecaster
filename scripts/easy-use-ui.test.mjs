import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("web shell exposes a small canonical task navigation", async () => {
  const shell = await read("app/components/AppShell.jsx");
  const primaryBlock = shell.slice(
    shell.indexOf("const primaryItems"),
    shell.indexOf("const secondaryGroups")
  );

  for (const path of ["/", "/betting", "/agent", "/tracking", "/analytics", "/simulator"]) {
    assert.match(primaryBlock, new RegExp(`href: \\"${path.replace("/", "\\/")}\\"`));
  }

  assert.doesNotMatch(primaryBlock, /open-bets|agent-v7|agent-memory|ai-research|tournament|core-status/);
  assert.match(shell, /ContextHelp/);
  assert.match(shell, /PAPERITILA · EI OIKEAA RAHAA/);
  assert.match(shell, /aria-label="Päävalikko"/);
  assert.match(shell, /aria-label="Pikavalikko"/);
});

test("home page teaches the three-step paper-only workflow and uses current Top Picks", async () => {
  const home = await read("app/DashboardClient.jsx");

  assert.match(home, /Aloita kolmessa vaiheessa/);
  assert.match(home, /Aseta paperirajat/);
  assert.match(home, /Katso päivän analyysit/);
  assert.match(home, /Seuraa paperituloksia/);
  assert.match(home, /fetch\("\/api\/top-picks"/);
  assert.doesNotMatch(home, /api\/agent-v9|Agent V9 ranked|BET Signals|Open Betting Workspace/);
  assert.match(home, /ei talletuksia, maksuja tai oikean rahan vetoja/i);
});

test("obsolete Agent V7 route redirects to the current Agent page", async () => {
  const legacyAgent = await read("app/agent-v7/page.jsx");
  assert.match(legacyAgent, /redirect\("\/agent"\)/);
  assert.doesNotMatch(legacyAgent, /AgentV7Dashboard/);
});

test("help page explains the product in plain Finnish", async () => {
  const help = await read("app/help/page.jsx");
  for (const term of ["No-vig-konsensus", "Edge", "EV", "CLV", "Brier score", "PLAY", "WATCH", "SKIP", "Paperipanos"]) {
    assert.match(help, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(help, /ei ole vedonlyöntipalvelu eikä käsittele oikeaa rahaa/i);
});

test("canonical simulator page renders the validated reproducible client", async () => {
  const page = await read("app/simulator/page.jsx");
  assert.match(page, /import SimulatorClient/);
  assert.match(page, /<SimulatorClient \/>/);
  assert.doesNotMatch(page, /getMonteCarlo|worldCupFixtures|Monte Carlo Risk Lab/);
});

test("betting keeps advanced paper settings out of the primary flow", async () => {
  const betting = await read("app/betting/BettingClient.jsx");
  assert.match(betting, /Päivän kohteet/);
  assert.match(betting, /Edistyneet paperiasetukset/);
  assert.match(betting, /<details/);
  assert.match(betting, /aria-label="Valitse laji"/);
  assert.match(betting, /aria-label="Valitse liiga"/);
  assert.match(betting, /aria-label="Valitse markkina"/);
  assert.doesNotMatch(betting, /Betting Decision Workspace|Paper Bet Slip|bookkeria/);
});

test("tracking uses Finnish labels and confirmation for destructive actions", async () => {
  const tracking = await read("app/tracking/page.jsx");
  assert.match(tracking, /Seuranta/);
  assert.match(tracking, /Näytä edistyneet mittarit/);
  assert.match(tracking, /window\.confirm\("Poistetaanko tämä paperikohde/);
  assert.match(tracking, /window\.confirm\("Poistetaanko koko paikallinen paperihistoria/);
  assert.match(tracking, /Merkitse voitoksi/);
  assert.doesNotMatch(tracking, /Clear All Local Bets|Mark Win|Mark Loss|Tracked Bets/);
});

test("native home keeps advanced risk fields collapsed by default", async () => {
  const app = await read("mobile/src/App.tsx");
  const home = await read("mobile/src/screens/HomeScreen.tsx");

  assert.match(app, /Urheiluanalyysi ja paperiseuranta/);
  assert.match(app, /PAPERITILA/);
  assert.match(home, /Aloita näin/);
  assert.match(home, /showRiskSettings/);
  assert.match(home, /Muokkaa paperirajoja/);
  assert.match(home, /showRiskSettings &&/);
});

test("root viewport allows user zoom for accessibility", async () => {
  const layout = await read("app/layout.jsx");
  assert.doesNotMatch(layout, /maximumScale/);
  assert.match(layout, /lang="fi"/);
});
