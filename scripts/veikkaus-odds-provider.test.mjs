import assert from "node:assert/strict";
import {
  enrichGamesWithVeikkaus,
  normalizeVeikkausBookmaker,
  veikkausOddsConfiguration
} from "../lib/veikkaus-odds-provider.mjs";
import { getBookmakerCatalog, getConsensusPrices } from "../lib/market-consensus-engine.mjs";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const baseGame = {
  id: "event-1",
  sport_key: "basketball_wnba",
  sport_title: "WNBA",
  commence_time: "2026-08-21T18:00:00Z",
  home_team: "Las Vegas Aces",
  away_team: "Connecticut Sun",
  bookmakers: [
    {
      key: "unibet_eu",
      title: "Unibet",
      last_update: "2026-08-20T08:00:00Z",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Las Vegas Aces", price: 1.10 },
            { name: "Connecticut Sun", price: 8.50 }
          ]
        }
      ]
    }
  ]
};

const veikkausPayload = {
  id: 777,
  home: "Las Vegas Aces",
  away: "Connecticut Sun",
  date: "2026-08-21T18:00:00Z",
  bookmakers: {
    Veikkaus: [
      {
        name: "ML",
        updatedAt: "2026-08-20T08:01:00Z",
        odds: [{ home: "1.08", away: "9.95" }]
      },
      {
        name: "Spread",
        updatedAt: "2026-08-20T08:01:00Z",
        odds: [{ hdp: -12.5, home: "1.90", away: "1.92" }]
      },
      {
        name: "Totals",
        updatedAt: "2026-08-20T08:01:00Z",
        odds: [{ hdp: 166.5, over: "1.91", under: "1.91" }]
      }
    ]
  },
  urls: {
    Veikkaus: "https://example.invalid/betslip"
  }
};

{
  const config = veikkausOddsConfiguration({});
  assert.equal(config.configured, false);
}

{
  let calls = 0;
  const result = await enrichGamesWithVeikkaus({
    games: [baseGame],
    sportKey: "basketball_wnba",
    env: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not call network without key");
    }
  });
  assert.equal(calls, 0);
  assert.equal(result.state.mode, "not-configured");
  assert.equal(result.state.networkRequestMade, false);
  assert.deepEqual(result.games, [baseGame]);
}

{
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes("/events?")) {
      return response([
        {
          id: 777,
          home: "Las Vegas Aces",
          away: "Connecticut Sun",
          date: "2026-08-21T18:00:00Z",
          status: "pending"
        }
      ]);
    }
    if (url.includes("/odds/multi?")) return response([veikkausPayload]);
    return response({}, 404);
  };

  const result = await enrichGamesWithVeikkaus({
    games: [baseGame],
    sportKey: "basketball_wnba",
    markets: ["h2h", "spreads", "totals"],
    env: { VEIKKAUS_ODDS_API_IO_KEY: "secret-key-that-must-not-leak" },
    fetchImpl,
    now: Date.parse("2026-08-20T08:02:00Z")
  });

  assert.equal(result.state.mode, "live");
  assert.equal(result.state.matchedEvents, 1);
  assert.equal(result.state.networkRequestMade, true);
  assert.equal(JSON.stringify(result.state).includes("secret-key-that-must-not-leak"), false);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].includes("bookmaker=Veikkaus"), true);
  assert.equal(seen[1].includes("bookmakers=Veikkaus"), true);

  const books = result.games[0].bookmakers;
  const veikkaus = books.find((book) => book.key === "veikkaus");
  assert.ok(veikkaus);
  assert.equal(veikkaus.title, "Veikkaus");
  assert.equal(veikkaus.source_provider, "odds-api.io");
  assert.equal(veikkaus.markets.length, 3);
  assert.equal(JSON.stringify(veikkaus).includes("betslip"), false);

  const catalog = getBookmakerCatalog(result.games, "h2h");
  const catalogVeikkaus = catalog.find((book) => book.key === "veikkaus");
  assert.ok(catalogVeikkaus);
  assert.equal(catalogVeikkaus.title, "Veikkaus");
  assert.equal(catalogVeikkaus.eventCount, 1);

  const consensus = getConsensusPrices(result.games[0], "h2h");
  const sun = consensus.find((item) => item.selection === "Connecticut Sun");
  assert.ok(sun);
  assert.equal(sun.bookmaker, "Veikkaus");
  assert.equal(sun.odds, 9.95);
  assert.equal(sun.bookmakerCount, 2);
  assert.equal(sun.offers.some((offer) => offer.bookmakerKey === "veikkaus"), true);
}

{
  const normalized = normalizeVeikkausBookmaker(veikkausPayload, ["spreads", "totals"]);
  const spread = normalized.markets.find((market) => market.key === "spreads");
  const totals = normalized.markets.find((market) => market.key === "totals");
  assert.equal(spread.outcomes.find((outcome) => outcome.name === "Las Vegas Aces").point, -12.5);
  assert.equal(spread.outcomes.find((outcome) => outcome.name === "Connecticut Sun").point, 12.5);
  assert.equal(totals.outcomes.find((outcome) => outcome.name === "Over").point, 166.5);
}

{
  const duplicateGame = {
    ...baseGame,
    bookmakers: [
      ...baseGame.bookmakers,
      {
        key: "veikkaus",
        title: "Veikkaus stale",
        markets: [{ key: "h2h", outcomes: [{ name: "Las Vegas Aces", price: 1.01 }, { name: "Connecticut Sun", price: 20 }] }]
      }
    ]
  };
  const fetchImpl = async (url) => url.includes("/events?")
    ? response([{ id: 777, home: "Las Vegas Aces", away: "Connecticut Sun", date: "2026-08-21T18:00:00Z" }])
    : response([veikkausPayload]);
  const result = await enrichGamesWithVeikkaus({
    games: [duplicateGame],
    sportKey: "basketball_wnba",
    env: { VEIKKAUS_ODDS_API_IO_KEY: "x" },
    fetchImpl,
    now: Date.parse("2026-08-20T08:02:00Z")
  });
  assert.equal(result.games[0].bookmakers.filter((book) => book.key === "veikkaus").length, 1);
  assert.equal(result.games[0].bookmakers.find((book) => book.key === "veikkaus").title, "Veikkaus");
}

{
  let calls = 0;
  const result = await enrichGamesWithVeikkaus({
    games: [baseGame],
    sportKey: "basketball_wnba",
    env: { VEIKKAUS_ODDS_API_IO_KEY: "x" },
    fetchImpl: async () => {
      calls += 1;
      return response({ error: "quota and raw provider text that must not escape" }, 429);
    },
    now: Date.parse("2026-08-20T08:02:00Z")
  });
  assert.equal(calls, 1);
  assert.equal(result.state.mode, "rate-limited");
  assert.equal(result.state.networkRequestMade, true);
  assert.equal(JSON.stringify(result.state).includes("raw provider text"), false);
  assert.deepEqual(result.games, [baseGame]);
}

{
  let calls = 0;
  const result = await enrichGamesWithVeikkaus({
    games: [baseGame],
    sportKey: "basketball_wnba",
    env: { VEIKKAUS_ODDS_API_IO_KEY: "x" },
    fetchImpl: async (url) => {
      calls += 1;
      if (url.includes("/events?")) {
        return response([{ id: 888, home: "Different Team", away: "Connecticut Sun", date: "2026-08-21T18:00:00Z" }]);
      }
      throw new Error("odds fetch must not happen for unmatched event");
    },
    now: Date.parse("2026-08-20T08:02:00Z")
  });
  assert.equal(calls, 1);
  assert.equal(result.state.mode, "live-no-match");
  assert.deepEqual(result.games, [baseGame]);
}

console.log("Veikkaus odds provider regression tests passed");
