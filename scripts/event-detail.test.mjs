import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildEventDetail } from "../lib/event-detail.mjs";

function pick(overrides = {}) {
  return {
    id: "pick-home",
    gameId: "event-123",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    leagueTitle: "NHL",
    match: "Home Team – Away Team",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    odds: 2.1,
    bookmaker: "Example Book",
    consensusProbability: 0.52,
    marketProbability: 1 / 2.1,
    fairOdds: 1 / 0.52,
    edge: 0.044,
    ev: 0.092,
    confidence: 0.71,
    trustScore: 78,
    bookmakerCount: 6,
    freshnessLabel: "fresh",
    productDecision: "PLAY",
    evidenceGateReason: "Independent evidence is verified; it did not override the market probability.",
    fixtureVerifiedByProvider: true,
    fixtureSource: "live-odds-provider",
    commenceTime: "2026-07-20T18:00:00Z",
    sportsIntelligence: {
      version: "sports-intelligence-v1",
      readiness: { level: "verified", score: 1, verifiedCount: 6, totalChecks: 6, missing: [], fullyVerified: true },
      sourceCount: 2,
      sources: ["Official feed", "Independent media"],
      conflicts: [],
      impacts: { home: 0, away: -0.01 },
      injuries: [{ category: "injury", subject: "Player A", status: "out", detail: "Verified absence", source: "Official feed", freshness: "fresh", verified: true }],
      probabilityAdjusted: false
    },
    formRestShadow: {
      version: "form-rest-shadow-v1",
      modelId: "nhl-form-rest-logit-v1",
      mode: "binary-shadow",
      status: "ready",
      marketProbability: 0.52,
      shadowProbability: 0.57,
      probabilityDelta: 0.05,
      probabilityAppliedToProduction: false,
      usedForDecision: false,
      chronologyGuard: true,
      home: { team: "Home Team", sampleSize: 5, restDays: 2.5, gamesLast7Days: 3 },
      away: { team: "Away Team", sampleSize: 5, restDays: 1.5, gamesLast7Days: 4 },
      features: { homeFormAdvantage: 0.2, homeRestAdvantage: 0.1 }
    },
    ...overrides
  };
}

test("event detail contains only the requested verified event and keeps shadow output audit-only", () => {
  const detail = buildEventDetail([
    pick(),
    pick({ id: "pick-away", selection: "Away Team", odds: 1.9, productDecision: "CAUTION" }),
    pick({ id: "other", gameId: "event-other", match: "Other – Match", selection: "Other" })
  ], "event-123", "Away Team");

  assert.ok(detail);
  assert.equal(detail.eventId, "event-123");
  assert.equal(detail.selections.length, 2);
  assert.equal(detail.selections.some((item) => item.selection === "Other"), false);
  assert.equal(detail.selectedSelection, "Away Team");
  assert.equal(detail.fixtureVerifiedByProvider, true);
  assert.equal(detail.paperOnly, true);
  assert.equal(detail.realMoneyActionAvailable, false);
  assert.equal(detail.probabilityAdjustedByDetail, false);
  assert.equal(detail.formRestShadow.probabilityAppliedToProduction, false);
  assert.equal(detail.formRestShadow.usedForDecision, false);
  assert.equal(detail.sportsIntelligence.probabilityAdjusted, false);
  assert.equal(detail.selections[0].dataGate.bookmakerCount, null);
  assert.equal(detail.selections[0].dataAgeHours, null);
});

test("event detail rejects missing or unknown event IDs", () => {
  assert.equal(buildEventDetail([pick()], "", ""), null);
  assert.equal(buildEventDetail([pick()], "missing-event", ""), null);
});

test("price guard is calculated from the unchanged consensus probability", () => {
  const detail = buildEventDetail([pick()], "event-123", "Home Team");
  const selection = detail.selections[0];
  assert.equal(Number(selection.priceGuard.breakEvenOdds.toFixed(6)), Number((1 / 0.52).toFixed(6)));
  assert.equal(Number(selection.priceGuard.minimumPlayOdds.toFixed(6)), Number((1.03 / 0.52).toFixed(6)));
  assert.equal(selection.consensusProbability, 0.52);
});

test("public Event Detail API validates query and resolves only through Top Picks", async () => {
  const route = await readFile(new URL("../app/api/event-detail/route.js", import.meta.url), "utf8");
  const validationIndex = route.indexOf("SUPPORTED_SPORTS.has(sport)");
  const topPicksIndex = route.indexOf("getTopPicks(new Request");
  const detailIndex = route.indexOf("buildEventDetail(payload?.data");
  assert.ok(validationIndex >= 0);
  assert.ok(topPicksIndex > validationIndex);
  assert.ok(detailIndex > topPicksIndex);
  assert.match(route, /ALLOWED_QUERY_KEYS/);
  assert.match(route, /The event is not present in the current verified analysis/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /ODDS_API_KEY/);
  assert.doesNotMatch(route, /OPENAI_API_KEY/);
});

test("web Event Detail uses verified actions without bookmaker redirects", async () => {
  const client = await readFile(new URL("../app/event/[eventId]/EventDetailClient.jsx", import.meta.url), "utf8");
  const directory = await readFile(new URL("../app/events/EventsClient.jsx", import.meta.url), "utf8");
  const gate = await readFile(new URL("../app/event/[eventId]/DecisionGateChecklist.jsx", import.meta.url), "utf8");
  assert.match(client, /\/api\/event-detail/);
  assert.match(client, /\/api\/cloud\/watchlist/);
  assert.match(client, /\/api\/cloud\/bets\/audited/);
  assert.match(client, /eventId: detail\.eventId, selection: selected\.selection, sport: detail\.sportKey, stake: paperStake/);
  assert.doesNotMatch(client, /body: JSON\.stringify\([^\n]*edge: selected\.edge/);
  assert.match(client, /DecisionGateChecklist/);
  assert.match(gate, /data-decision-gate-checklist/);
  assert.match(client, /No deposit, payment, bookmaker link or real-money bet/);
  assert.doesNotMatch(client, /window\.location.*book/i);
  assert.match(directory, /\/event\//);
  assert.match(directory, /current Top Picks analysis/);
});

test("native app opens Event Detail as a transient screen and returns to Picks", async () => {
  const app = await readFile(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
  const picks = await readFile(new URL("../mobile/src/screens/PicksScreen.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../mobile/src/screens/EventDetailScreen.tsx", import.meta.url), "utf8");
  assert.match(app, /selectedEvent/);
  assert.match(app, /<EventDetailScreen pick=\{selectedEvent\}/);
  assert.match(app, /<PicksScreen onOpenEvent=\{setSelectedEvent\}/);
  assert.match(picks, /Avaa kaikki tiedot/);
  assert.match(picks, /onOpenEvent\?\.\(pick\)/);
  assert.match(detail, /\/api\/event-detail/);
  assert.match(detail, /eventId: detail\.eventId/);
  assert.match(detail, /sport: detail\.sportKey/);
  assert.match(detail, /\/api\/cloud\/bets\/audited/);
  assert.match(detail, /PÄÄTÖSPORTIT/);
  assert.match(detail, /\/api\/cloud\/watchlist/);
  assert.match(detail, /No payment, bookmaker link or real-money bet/);
});

test("Event Detail V3 prioritizes the decision ticket and keeps supporting models secondary", async () => {
  const web = await readFile(new URL("../app/event/[eventId]/EventDetailClient.jsx", import.meta.url), "utf8");
  const picks = await readFile(new URL("../mobile/src/screens/PicksScreen.tsx", import.meta.url), "utf8");
  const native = await readFile(new URL("../mobile/src/screens/EventDetailScreen.tsx", import.meta.url), "utf8");

  for (const token of ["PageHero", "TrustBar", "MatchIdentity", "DecisionBadge", "MetricTile", "Decision ticket"]) assert.match(web, new RegExp(token));
  assert.match(web, /Event Detail V3/);
  assert.match(web, /Näytä Sports Intelligence -auditointi/);
  assert.match(web, /Näytä vire- ja lepo-varjomalli/);
  assert.match(web, /<details/);
  assert.match(picks, /Paperitoiminnot/);
  assert.match(picks, /expandedId/);
  assert.match(native, /EVENT DETAIL V3/);
  assert.match(native, /showPaper/);
  assert.match(native, /showIntelligence/);
  assert.match(native, /showFormRest/);
  assert.match(native, /showTimeline/);
});

test("Match Center V4 consolidates the Flashscore-style research surface without fabricating data", async () => {
  const [page, center] = await Promise.all([
    readFile(new URL("../app/event/[eventId]/page.jsx", import.meta.url), "utf8"),
    readFile(new URL("../app/event/[eventId]/MatchCenterV4.jsx", import.meta.url), "utf8")
  ]);

  assert.match(page, /MatchCenterV4/);
  assert.match(page, /<MatchCenterV4 eventId=\{eventId\} sport=\{sport\} selection=\{selection\}/);
  assert.match(center, /data-match-center-v4/);
  for (const token of ["summary", "form", "lineups", "h2h", "standings", "players", "markets"]) assert.match(center, new RegExp(`\\"${token}\\"`));
  assert.match(center, /\/api\/event-detail/);
  assert.match(center, /cache: "no-store"/);
  assert.match(center, /verified data required/);
  assert.match(center, /A predicted XI is never invented/);
  assert.match(center, /H2H awaits verified history data/);
  assert.match(center, /Standings data bridge is not active yet/);
  assert.match(center, /paper only/);
  assert.doesNotMatch(center, /window\.location|bookmaker.*(?:login|password)|placeBet|deposit|withdraw/i);
});
