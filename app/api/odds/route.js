import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedData = null;
let cachedAt = 0;

const CACHE_MS = 10 * 60 * 1000;

const DEMO_DATA = {
  source: "fallback",
  status: "demo",
  provider: "demo",
  cached: false,
  reason:
    "Live-dataa ei saatu ladattua. Näytetään testidata, jotta käyttöliittymää voi testata.",
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

function getBestH2hOdds(event) {
  const bookmakers = Array.isArray(event?.bookmakers) ? event.bookmakers : [];

  let bestHome = null;
  let bestDraw = null;
  let bestAway = null;

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker?.markets || []) {
      if (market?.key !== "h2h") continue;

      for (const outcome of market?.outcomes || []) {
        const price = Number(outcome?.price);
        if (!Number.isFinite(price)) continue;

        if (outcome?.name === event.home_team) {
          bestHome = bestHome == null ? price : Math.max(bestHome, price);
        }

        if (outcome?.name === event.away_team) {
          bestAway = bestAway == null ? price : Math.max(bestAway, price);
        }

        if (String(outcome?.name || "").toLowerCase() === "draw") {
          bestDraw = bestDraw == null ? price : Math.max(bestDraw, price);
        }
      }
    }
  }

  return {
    home: bestHome,
    draw: bestDraw,
    away: bestAway,
  };
}

function normalizeTheOddsApiMatch(event) {
  const bestH2h = getBestH2hOdds(event);

  return {
    id: event?.id,
    sport_key: event?.sport_key,
    sport_title: event?.sport_title || event?.sport_key || "Unknown",
    commence_time: event?.commence_time,
    home_team: event?.home_team || "Home",
    away_team: event?.away_team || "Away",
    bestOdds: {
      home: bestH2h.home,
      draw: bestH2h.draw,
      away: bestH2h.away,
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

async function fetchFromTheOddsApi() {
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      data: null,
      error: "ODDS_API_KEY puuttuu Vercel Environment Variables -asetuksista.",
      meta: {},
    };
  }

  const sport = "icehockey_liiga";

  const url =
    `https://api.the-odds-api.com/v4/sports/${sport}/odds/` +
    `?apiKey=${apiKey}` +
    "&regions=eu" +
    "&markets=h2h" +
    "&oddsFormat=decimal" +
    "&dateFormat=iso";

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();

  const meta = {
    requestsRemaining: response.headers.get("x-requests-remaining"),
    requestsUsed: response.headers.get("x-requests-used"),
    requestsLast: response.headers.get("x-requests-last"),
  };

  if (!response.ok) {
    return {
      ok: false,
      data: null,
      error: `The Odds API error ${response.status}: ${text}`,
      meta,
    };
  }

  const raw = JSON.parse(text);

  const matches = Array.isArray(raw)
    ? raw.map(normalizeTheOddsApiMatch).filter(Boolean)
    : [];

  if (matches.length === 0) {
    return {
      ok: false,
      data: null,
      error:
        "The Odds API vastasi onnistuneesti, mutta icehockey_liiga ei palauttanut pelejä juuri nyt.",
      meta,
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
      quota: meta,
      matches,
    },
    error: "",
    meta,
  };
}

/**
 * Backup provider -valmius.
 *
 * SportsGameOdds vaatii oman API-avaimen ja sen response-rakenne on eri.
 * Pidämme tämän nyt turvallisena fallback-paikkana, jotta The Odds API ei pala
 * vahingossa monesta providerista samalla napinpainalluksella.
 *
 * Kun olet hankkinut SGO_API_KEY:n, rakennetaan tähän oikea normalisointi.
 */
async function fetchFromBackupProvider() {
  const apiKey = process.env.SGO_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      data: null,
      error: "SGO_API_KEY puuttuu. Backup API ei ole vielä käytössä.",
      meta: {},
    };
  }

  return {
    ok: false,
    data: null,
    error:
      "SGO_API_KEY löytyy, mutta SportsGameOdds-normalisointia ei ole vielä aktivoitu.",
    meta: {},
  };
}

export async function GET(request) {
  const now = Date.now();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const useBackup = url.searchParams.get("backup") === "1";

  if (!force && cachedData && now - cachedAt < CACHE_MS) {
    return NextResponse.json({
      ...cachedData,
      cached: true,
      cacheAgeSeconds: Math.round((now - cachedAt) / 1000),
    });
  }

  const primary = await fetchFromTheOddsApi();

  if (primary.ok) {
    cachedData = primary.data;
    cachedAt = now;

    return NextResponse.json(primary.data);
  }

  if (useBackup) {
    const backup = await fetchFromBackupProvider();

    if (backup.ok) {
      cachedData = backup.data;
      cachedAt = now;
      return NextResponse.json(backup.data);
    }

    return NextResponse.json({
      ...DEMO_DATA,
      status: "backup_failed",
      reason: `${primary.error} Backup: ${backup.error}`,
      quota: primary.meta,
    });
  }

  return NextResponse.json({
    ...DEMO_DATA,
    status: "api_error",
    reason: primary.error,
    quota: primary.meta,
  });
}
