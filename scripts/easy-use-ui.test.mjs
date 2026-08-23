import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("web shell exposes five core user tasks and keeps advanced tools in More", async () => {
  const shell = await read("app/components/AppShell.jsx");
  const primaryBlock = shell.slice(shell.indexOf("const primaryItems"), shell.indexOf("const groups"));

  for (const path of ["/", "/feed", "/events", "/tracking", "/profile"]) {
    assert.ok(primaryBlock.includes(`href: "${path}"`), `missing primary route ${path}`);
  }

  for (const path of ["/betting", "/agent", "/analytics", "/simulator", "/operations", "/release-readiness"]) {
    assert.ok(!primaryBlock.includes(`href: "${path}"`), `${path} should not be a primary tab`);
  }

  assert.match(shell, /href: "\/betting"/);
  assert.match(shell, /href: "\/agent"/);
  assert.match(shell, /grid-cols-5/);
  assert.match(shell, /NavIcon name="more"/);
  assert.match(shell, /Developer and operator tools|Advanced \/ operator/);
  assert.match(shell, /<details className="mt-4 border-t/);
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

test("shared UX styles preserve keyboard and reduced-motion accessibility", async () => {
  const styles = await read("app/globals.css");
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /scroll-behavior: smooth/);
  assert.match(styles, /sc-button-primary/);
  assert.match(styles, /sc-input/);
});

test("Visual V3 provides a custom brand, icons, team identity and persisted light-dark appearance", async () => {
  const brand = await read("app/components/BrandUI.jsx");
  const shell = await read("app/components/AppShell.jsx");
  const productUi = await read("app/components/ProductUI.jsx");
  const analytics = await read("app/analytics/AnalyticsClient.jsx");
  const styles = await read("app/globals.css");
  const layout = await read("app/layout.jsx");

  assert.match(brand, /export function BrandMark/);
  assert.match(brand, /export function AppIcon/);
  assert.match(brand, /export function ThemeToggle/);
  assert.match(brand, /export function TeamCrest/);
  assert.match(brand, /scorecaster-theme/);
  assert.match(shell, /<BrandMark/);
  assert.match(shell, /<ThemeToggle/);
  assert.match(shell, /Sports decision OS/);
  assert.match(productUi, /export function MatchIdentity/);
  assert.match(analytics, /<MatchIdentity/);
  assert.match(styles, /html\[data-theme="light"\]/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /--sc-brand: #b8ff5c/);
  assert.match(styles, /sc-shell-header/);
  assert.match(layout, /appearanceScript/);
  assert.match(layout, /themeColor/);
  assert.doesNotMatch(brand + productUi, /https?:\/\//);
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
  assert.match(autonomous, /Autonominen, mutta aina valvottu/);
  assert.match(autonomous, /Vain täydet portit läpäissyt PLAY voidaan tallentaa/);
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

test("Daily Flow V3 connects events, verified watchlist and alert inbox with shared product UI", async () => {
  const events = await read("app/events/EventsClient.jsx");
  const watchlistPage = await read("app/watchlist/page.jsx");
  const watchlist = await read("app/watchlist/WatchlistClient.jsx");
  const candidates = await read("app/watchlist/WatchlistCandidates.jsx");
  const alerts = await read("app/alerts/AlertInboxClient.jsx");

  for (const source of [events, watchlist, alerts]) {
    assert.match(source, /Daily Flow V3/);
    assert.match(source, /PageHero/);
    assert.match(source, /TrustBar/);
    assert.match(source, /MetricTile/);
  }
  assert.match(events, /MatchIdentity/);
  assert.match(events, /DecisionBadge/);
  assert.match(events, /verified live events|verified events only/);
  assert.match(events, /MarketPickExplanation/);
  assert.match(events, /server-verified watchlist and paper-save flow/);
  assert.match(events, /<Link href=\{href\} className="sc-button-primary/);
  assert.doesNotMatch(events, /addTrackedBet/);
  assert.match(watchlist, /Watchlist Monitor V1/);
  assert.match(watchlist, /\/api\/cloud\/watchlist-monitor/);
  assert.match(watchlist, /Muokkaa hälytysrajoja/);
  assert.match(candidates, /server verifies the live-API selection again/i);
  assert.match(alerts, /action: "dismiss"/);
  assert.match(alerts, /action: "restore"/);
  assert.match(alerts, /\/api\/account\/alert-inbox-export/);
  assert.ok(watchlistPage.indexOf("<WatchlistClient />") < watchlistPage.indexOf("<WatchlistCandidates />"));
  assert.doesNotMatch(events + watchlist + alerts, /bg-\[radial-gradient/);
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

test("native Visual V3 uses five primary tabs and a dedicated More hub", async () => {
  const app = await read("mobile/src/App.tsx");
  const more = await read("mobile/src/screens/MoreScreen.tsx");
  const ui = await read("mobile/src/ui.tsx");
  const types = await read("mobile/src/types.ts");
  const tabBlock = app.slice(app.indexOf("const tabs"), app.indexOf("function chooseTab"));

  for (const key of ["home", "picks", "agent", "paper", "more"]) assert.match(tabBlock, new RegExp(`key: \\"${key}\\"`));
  for (const key of ["watchlist", "analytics", "settings"]) assert.doesNotMatch(tabBlock, new RegExp(`key: \\"${key}\\"`));
  assert.match(app, /activePrimaryTab/);
  assert.match(app, /<MoreScreen onNavigate=\{chooseTab\}/);
  assert.match(app, /<BrandMark compact/);
  assert.match(more, /Seurantalista ja hälytykset/);
  assert.match(more, /Results and calibration/);
  assert.match(more, /Profile and settings/);
  assert.match(ui, /export function BrandMark/);
  assert.match(ui, /brand: "#bef264"/);
  assert.match(ui, /mobileHero/);
  assert.match(ui, /tabIndicator/);
  assert.match(types, /\| "more"/);
});

test("root viewport allows user zoom for accessibility", async () => {
  const layout = await read("app/layout.jsx");
  assert.doesNotMatch(layout, /maximumScale/);
  assert.match(layout, /lang="fi"/);
  assert.match(layout, /LanguageProvider/);
});
