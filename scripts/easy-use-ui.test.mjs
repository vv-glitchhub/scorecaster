import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("web shell exposes four primary tasks plus a dedicated More action", async () => {
  const shell = await read("app/components/AppShell.jsx");
  const primaryBlock = shell.slice(shell.indexOf("const primaryItems"), shell.indexOf("const groups"));

  for (const path of ["/", "/betting", "/agent", "/tracking"]) {
    assert.match(primaryBlock, new RegExp(`href: \\"${path.replace("/", "\\/")}\\"`));
  }

  for (const path of ["/analytics", "/simulator", "/operations", "/release-readiness"]) {
    assert.doesNotMatch(primaryBlock, new RegExp(`href: \\"${path.replace("/", "\\/")}\\"`));
  }

  assert.match(shell, /grid-cols-5/);
  assert.match(shell, /NavIcon name="more"/);
  assert.match(shell, /Advanced \/ operator/);
  assert.match(shell, /ContextHelp/);
  assert.match(shell, /LanguageSwitcher/);
  assert.match(shell, /t\("mode\.paper"\)/);
  assert.match(shell, /aria-label=\{t\("nav\.mainAria"\)\}/);
  assert.match(shell, /aria-label=\{t\("nav\.quickAria"\)\}/);
});

test("home is a decision center with concise actions and trust context", async () => {
  const home = await read("app/DashboardClient.jsx");
  const productUi = await read("app/components/ProductUI.jsx");

  assert.match(home, /fetch\("\/api\/top-picks"/);
  assert.match(home, /PageHero/);
  assert.match(home, /TrustBar/);
  assert.match(home, /DecisionBadge/);
  assert.match(home, /Näytä päivän kohteet/);
  assert.match(home, /Autonominen tila/);
  assert.match(home, /Polymarket/);
  assert.match(home, /paperiseuranta/);
  assert.doesNotMatch(home, /home\.step1Title|home\.step2Title|home\.step3Title/);
  assert.doesNotMatch(home, /api\/agent-v9|Agent V9 ranked|BET Signals|Open Betting Workspace/);
  assert.match(productUi, /export function PageHero/);
  assert.match(productUi, /export function TrustBar/);
  assert.match(productUi, /export function DecisionBadge/);
});

test("shared UX V2 styles preserve keyboard and reduced-motion accessibility", async () => {
  const styles = await read("app/globals.css");
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /scroll-behavior: smooth/);
  assert.match(styles, /sc-button-primary/);
  assert.match(styles, /sc-input/);
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

test("betting keeps advanced controls collapsed and uses the shared decision UI", async () => {
  const betting = await read("app/betting/BettingClient.jsx");
  assert.match(betting, /Advanced: paper bankroll and refresh/);
  assert.match(betting, /Avanzado: banca simulada y actualización/);
  assert.match(betting, /Advanced: paperikassa ja automaattipäivitys/);
  assert.match(betting, /<details/);
  assert.match(betting, /Choose sport/);
  assert.match(betting, /Elegir liga/);
  assert.match(betting, /PageHero/);
  assert.match(betting, /TrustBar/);
  assert.match(betting, /DecisionBadge/);
  assert.match(betting, /MetricTile/);
  assert.doesNotMatch(betting, /Betting Decision Workspace|Paper Bet Slip|bookkeria/);
});

test("Agent V11 prioritizes decisions and keeps audit and limits secondary", async () => {
  const agent = await read("app/agent/AgentClient.jsx");
  assert.match(agent, /PageHero/);
  assert.match(agent, /TrustBar/);
  assert.match(agent, /DecisionBadge/);
  assert.match(agent, /MetricTile/);
  assert.match(agent, /Päätös ensin, auditointi tarvittaessa/);
  assert.match(agent, /Näytä auditointi/);
  assert.match(agent, /Muokkaa paperirajoja/);
  assert.match(agent, /Agent V11 Model Lab/);
  assert.match(agent, /probabilityAdjustedByLearning: false/);
  assert.doesNotMatch(agent, /function decisionClass/);
});

test("autonomous console exposes status first and keeps safety language intact", async () => {
  const autonomous = await read("app/autonomous-agent/AutonomousAgentClient.jsx");
  assert.match(autonomous, /PageHero/);
  assert.match(autonomous, /TrustBar/);
  assert.match(autonomous, /MetricTile/);
  assert.match(autonomous, /Rajattu automaatio, selkeä tila/);
  assert.match(autonomous, /Vain PLAY-päätös voidaan tallentaa/);
  assert.match(autonomous, /Ei talletuksia/);
  assert.match(autonomous, /fetch\("\/api\/cloud\/autonomous-agent"/);
});

test("tracking uses translated labels, shared portfolio UI and destructive confirmations", async () => {
  const tracking = await read("app/tracking/page.jsx");
  assert.match(tracking, /PageHero/);
  assert.match(tracking, /TrustBar/);
  assert.match(tracking, /MetricTile/);
  assert.match(tracking, /Paperisalkku/);
  assert.match(tracking, /Remove this paper pick from history/);
  assert.match(tracking, /Eliminar este pronóstico simulado del historial/);
  assert.match(tracking, /Poistetaanko tämä paperikohde historiasta/);
  assert.match(tracking, /Mark as win/);
  assert.match(tracking, /Marcar victoria/);
  assert.doesNotMatch(tracking, /Clear All Local Bets|Tracked Bets/);
});

test("analytics is a V11 performance cockpit with primary metrics before weights", async () => {
  const analytics = await read("app/analytics/AnalyticsClient.jsx");
  assert.match(analytics, /PageHero/);
  assert.match(analytics, /TrustBar/);
  assert.match(analytics, /DecisionBadge/);
  assert.match(analytics, /MetricTile/);
  assert.match(analytics, /Neljä tärkeintä mittaria/);
  assert.match(analytics, /Agent V11/);
  assert.match(analytics, /Näytä Agent V11:n tekniset painot/);
  assert.doesNotMatch(analytics, /Agent V10/);
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
