import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedData = null;
let cachedAt = 0;

const CACHE_MS = 10 * 60 * 1000;

const DEMO_DATA = {
  source: "demo",
  status: "demo",
  provider: "demo",
  cached: false,
  reason:
    "Live-dataa ei saatu ladattua. Näytetään testidata, jotta käyttöliittymää voi käyttää.",
  matches: [
    {
      id: "demo-liiga-1",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: new Date().toISOString(),
      home_team: "Tappara",
      away_team: "Ilves",
      bestOdds: {
        home: 2.1,
        draw: 4.2,
        away: 2.75,
        point: 5.5,
        over: 1.9,
        under: 1.92,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.45,
        spreadAway: 1.55,
      },
    },
    {
      id: "demo-liiga-2",
      sport_key: "icehockey_liiga",
      sport_title: "Liiga",
      commence_time: new Date().toISOString(),
      home_team: "Lukko",
      away_team: "TPS",
      bestOdds: {
        home: 1.85,
        draw: 4.4,
        away: 3.25,
        point: 5.5,
        over: 1.88,
        under: 1.95,
        spreadPointHome: -1.5,
        spreadPointAway: 1.5,
        spreadHome: 2.2,
        spreadAway: 1.7,
      },
    },
  ],
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function getArrayFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function extractTeamName(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return value;

  return (
    value.name ||
    value.displayName ||
    value.fullName ||
    value.teamName ||
    value.abbreviation ||
    fallback
  );
}

function findOddsDeep(event, searchTerms = []) {
  const terms = searchTerms.map((term) => String(term || "").toLowerCase());
  const candidates = [];

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }

    const name = String(
      obj.name ||
        obj.label ||
        obj.outcome ||
        obj.side ||
        obj.betName ||
        obj.selection ||
        obj.team ||
        ""
    ).toLowerCase();

    const price = toNumber(
      obj.price ||
        obj.odds ||
        obj.decimalOdds ||
        obj.value ||
        obj.bookOdds ||
        obj.currentOdds
    );

    if (price) {
      candidates.push({ name, price });
    }

    Object.values(obj).forEach(walk);
  }

  walk(event);

  for (const term of terms) {
    const exact = candidates.find((candidate) => candidate.name === term);
    if (exact) return exact.price;

    const includes = candidates.find((candidate) => candidate.name.includes(term));
    if (includes) return includes.price;
  }

  return null;
}

function normalizeSportsGameOddsEvent(event) {
  const homeTeam = extractTeamName(
    firstDefined(
      event.homeTeam,
      event.home_team,
      event.home,
      event.teams?.home,
      event.competitors?.home
    ),
    "Home"
  );

  const awayTeam = extractTeamName(
    firstDefined(
      event.awayTeam,
      event.away_team,
      event.away,
      event.teams?.away,
      event.competitors?.away
    ),
    "Away"
  );

  const homeOdds = firstDefined(
    toNumber(event.homeOdds),
    toNumber(event.moneylineHome),
    toNumber(event.odds?.home),
    findOddsDeep(event, [homeTeam, "home"])
  );

  const awayOdds = firstDefined(
    toNumber(event.awayOdds),
    toNumber(event.moneylineAway),
    toNumber(event.odds?.away),
    findOddsDeep(event, [awayTeam, "away"])
  );

  const drawOdds = firstDefined(
    toNumber(event.drawOdds),
    toNumber(event.moneylineDraw),
    toNumber(event.odds?.draw),
    findOddsDeep(event, ["draw", "tie"])
  );

  return {
    id: String(
      firstDefined(event.eventID, event.eventId, event.gameID, event.gameId, event.id)
    ),
    sport_key: String(firstDefined(event.sportID, event.sport, "sportsgameodds")),
    sport_title: String(firstDefined(event.leagueID, event.league, "SportsGameOdds")),
    commence_time: firstDefined(event.startTime, event.commence_time, event.startDate, null),
    home_team: homeTeam,
    away_team: awayTeam,
    bestOdds: {
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds,
      point: null,
      over: null,
      under: null,
      spreadPointHome: null,
      spreadPointAway: null,
      spreadHome: null,
      spreadAway: null,
    },
  };
}

async function fetchSportsGameOdds() {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: "SPORTSGAMEODDS_API_KEY puuttuu Vercelistä.",
    };
  }

  const url =
    "https://api.sportsgameodds.com/v2/events" +
    `?apiKey=${apiKey}` +
    "&leagueID=NHL" +
    "&oddsAvailable=true" +
    "&includeAltLines=false" +
    "&limit=25";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      error: `SportsGameOdds error ${response.status}: ${text}`,
    };
  }

  const payload = JSON.parse(text);
  const events = getArrayFromPayload(payload);

  const matches = events
    .map(normalizeSportsGameOddsEvent)
    .filter((match) => match.home_team && match.away_team);

  if (matches.length === 0) {
    return {
      ok: false,
      error: "SportsGameOdds vastasi, mutta pelejä ei löytynyt.",
    };
  }

  return {
    ok: true,
    data: {
      source: "live",
      status: "fresh",
      provider: "sportsgameodds",
      cached: false,
      reason: "",
      matches,
    },
  };
}

async function fetchTheOddsApiFallback() {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: "ODDS_API_KEY puuttuu.",
    };
  }

  const url =
    "https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/" +
    `?apiKey=${apiKey}` +
    "&regions=us" +
    "&markets=h2h" +
    "&oddsFormat=decimal";

  const response = await fetch(url, {
    cache: "no-store",
  });

  const text = await response.text();

  const quota = {
    requestsRemaining: response.headers.get("x-requests-remaining"),
    requestsUsed: response.headers.get("x-requests-used"),
    requestsLast: response.headers.get("x-requests-last"),
  };

  if (!response.ok) {
    return {
      ok: false,
      error: `The Odds API error ${response.status}: ${text}`,
      quota,
    };
  }

  const raw = JSON.parse(text);

  const matches = Array.isArray(raw)
    ? raw.map((event) => {
        const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];

        let home = null;
        let away = null;
        let draw = null;

        for (const bookmaker of bookmakers) {
          for (const market of bookmaker.markets || []) {
            if (market.key !== "h2h") continue;

            for (const outcome of market.outcomes || []) {
              const price = toNumber(outcome.price);
              if (!price) continue;

              if (outcome.name === event.home_team) home = home ? Math.max(home, price) : price;
              if (outcome.name === event.away_team) away = away ? Math.max(away, price) : price;

              if (String(outcome.name).toLowerCase() === "draw") {
                draw = draw ? Math.max(draw, price) : price;
              }
            }
          }
        }

        return {
          id: event.id,
          sport_key: event.sport_key,
          sport_title: event.sport_title,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          bestOdds: {
            home,
            draw,
            away,
            point: null,
            over: null,
            under: null,
            spreadPointHome: null,
            spreadPointAway: null,
            spreadHome: null,
            spreadAway: null,
          },
        };
      })
    : [];

  if (matches.length === 0) {
    return {
      ok: false,
      error: "The Odds API ei palauttanut pelejä.",
      quota,
    };
  }

  return {
    ok: true,
    data: {
      source: "live",
      status: "fresh",
      provider: "the-odds-api",
      cached: false,
      reason: "",
      quota,
      matches,
    },
  };
}

export async function GET(request) {
  const now = Date.now();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  if (!force && cachedData && now - cachedAt < CACHE_MS) {
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cacheAgeSeconds: Math.round((now - cachedAt) / 1000),
    });
  }

  const primary = await fetchSportsGameOdds();

  if (primary.ok) {
    cachedData = primary.data;
    cachedAt = now;
    return NextResponse.json(primary.data);
  }

  const fallback = await fetchTheOddsApiFallback();

  if (fallback.ok) {
    cachedData = fallback.data;
    cachedAt = now;
    return NextResponse.json(fallback.data);
  }

  return NextResponse.json({
    ...DEMO_DATA,
    status: "api_error",
    reason: `Primary failed: ${primary.error} Fallback failed: ${fallback.error}`,
    debug: {
      primaryError: primary.error,
      fallbackError: fallback.error,
    },
  });
}
