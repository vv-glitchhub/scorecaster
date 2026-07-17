import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("web shell exposes a small canonical task navigation", async () => {
  const shell = await read("app/components/AppShell.jsx");
  const primaryBlock = shell.slice(shell.indexOf("const primaryItems"), shell.indexOf("const secondaryGroups"));

  for (const path of ["/", "/betting", "/agent", "/tracking", "/analytics", "/simulator"]) {
    assert.match(primaryBlock, new RegExp(`href: \\"${path.replace("/", "\\/")}\\"`));
  }

  assert.doesNotMatch(primaryBlock, /open-bets|agent-v7|agent-memory|ai-research|tournament|core-status/);
  assert.match(shell, /ContextHelp/);
  assert.match(shell, /LanguageSwitcher/);
  assert.match(shell, /t\("mode\.paper"\)/);
  assert.match(shell, /aria-label=\{t\("nav\.mainAria"\)\}/);
  assert.match(shell, /aria-label=\{t\("nav\.quickAria"\)\}/);
});

test("home page teaches the three-step paper-only workflow and uses current Top Picks", async () => {
  const home = await read("app/DashboardClient.jsx");
  const i18n = await read("lib/i18n.js");

  assert.match(home, /home\.startTitle/);
  assert.match(home, /home\.step1Title/);
  assert.match(home, /home\.step2Title/);
  assert.match(home, /home\.step3Title/);
  assert.match(home, /fetch\("\/api\/top-picks"/);
  assert.doesNotMatch(home, /api\/agent-v9|Agent V9 ranked|BET Signals|Open Betting Workspace/);
  assert.match(i18n, /Aloita kolmessa vaiheessa/);
  assert.match(i18n, /Start in three steps/);
  assert.match(i18n, /Empieza en tres pasos/);
});

test("obsolete Agent V7 route redirects to the current Agent page", async () => {
  const legacyAgent = await read("app/agent-v7/page.jsx");
  assert.match(legacyAgent, /redirect\("\/agent"\)/);
  assert.doesNotMatch(legacyAgent, /AgentV7Dashboard/);
});

test("help experience explains the product in three languages", async () => {
  const page = await read("app/help/page.jsx");
  const client = await read("app/help/HelpClient.jsx");
  const i18n = await read("lib/i18n.js");

  assert.match(page, /HelpClient/);
  for (const term of ["Edge", "EV", "CLV", "Brier score", "PLAY", "WATCH", "SKIP"]) assert.match(client + i18n, new RegExp(term));
  assert.match(i18n, /Scorecaster no es un operador de apuestas/);
  assert.match(i18n, /Scorecaster is not a betting operator/);
  assert.match(i18n, /Scorecaster ei ole vedonlyöntipalvelu/);
});

test("canonical simulator page renders the validated reproducible client", async () => {
  const page = await read("app/simulator/page.jsx");
  assert.match(page, /import SimulatorClient/);
  assert.match(page, /<SimulatorClient \/>/);
  assert.doesNotMatch(page, /getMonteCarlo|worldCupFixtures|Monte Carlo Risk Lab/);
});

test("betting keeps advanced paper settings out of the primary flow", async () => {
  const betting = await read("app/betting/BettingClient.jsx");
  assert.match(betting, /Advanced paper settings/);
  assert.match(betting, /Ajustes simulados avanzados/);
  assert.match(betting, /Edistyneet paperiasetukset/);
  assert.match(betting, /<details/);
  assert.match(betting, /Choose sport/);
  assert.match(betting, /Elegir liga/);
  assert.doesNotMatch(betting, /Betting Decision Workspace|Paper Bet Slip|bookkeria/);
});

test("tracking uses translated labels and confirmation for destructive actions", async () => {
  const tracking = await read("app/tracking/page.jsx");
  assert.match(tracking, /Remove this paper pick from history/);
  assert.match(tracking, /Eliminar este pronóstico simulado del historial/);
  assert.match(tracking, /Poistetaanko tämä paperikohde historiasta/);
  assert.match(tracking, /Mark as win/);
  assert.match(tracking, /Marcar victoria/);
  assert.doesNotMatch(tracking, /Clear All Local Bets|Tracked Bets/);
});

test("native home keeps advanced risk fields collapsed by default", async () => {
  const app = await read("mobile/src/App.tsx");
  const home = await read("mobile/src/screens/HomeScreen.tsx");

  assert.match(app, /Sports analysis and paper tracking/);
  assert.match(app, /Análisis deportivo y seguimiento simulado/);
  assert.match(home, /showRiskSettings/);
  assert.match(home, /Edit paper limits/);
  assert.match(home, /Editar límites simulados/);
  assert.match(home, /showRiskSettings &&/);
});

test("root viewport allows user zoom for accessibility", async () => {
  const layout = await read("app/layout.jsx");
  assert.doesNotMatch(layout, /maximumScale/);
  assert.match(layout, /lang="fi"/);
  assert.match(layout, /LanguageProvider/);
});
