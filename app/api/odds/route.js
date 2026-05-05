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
  reason: "Live-dataa ei saatu ladattua. Näytetään testidata.",
  matches: [],
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function americanToDecimal(value) {
  const n = toNumber(value);
  if (!n) return null;
  if (n > 0) return Number((1 + n / 100).toFixed(2));
  return Number((1 + 100 / Math.abs(n)).toFixed(2));
}

function bestBookDecimal(odd) {
  const direct =
    americanToDecimal(odd?.bookOdds) ||
    americanToDecimal(odd?.fairOdds) ||
    toNumber(odd?.decimalOdds);

  let best = direct;

  if (odd?.byBookmaker && typeof odd.byBookmaker === "object") {
    for (const book of Object.values(odd.byBookmaker)) {
      if (book?.available === false) continue;

      const decimal =
        americanToDecimal(book?.odds) ||
        americanToDecimal(book?.bookOdds) ||
        toNumber(book?.decimalOdds);

      if (decimal && (!best || decimal > best)) {
        best = decimal;
      }
    }
  }

  return best;
}

function getTeamName(event, side) {
  return (
    event?.teams?.[side]?.names?.long ||
    event?.teams?.[side]?.names?.medium ||
    event?.teams?.[side]?.names?.short ||
    event?.teams?.[side]?.teamID ||
    (side === "home" ? "Home" : "Away")
  );
}

function normalizeEvent(event) {
  const homeTeam = getTeamName(event, "home");
  const awayTeam = getTeamName(event, "away");

  const match = {
    id: String(event?.eventID || event?.id),
    sport_key: String(event?.sportID || "HOCKEY"),
    sport_title: String(event?.leagueID || "NHL"),
    commence_time: event?.status?.startsAt || event?.startTime || null,
    home_team: homeTeam,
    away_team: awayTeam,
    bestOdds: {
      home: null,
      draw: null,
      away: null,
      point: null,
      over: null,
      under: null,
      spreadPointHome: null,
      spreadPointAway: null,
      spreadHome: null,
      spreadAway: null,
    },
  };

  const odds = event?.odds && typeof event.odds === "object" ? event.odds : {};

  for (const odd of Object.values(odds)) {
    const betType = String(odd?.betTypeID || "").toLowerCase();
    const side = String(odd?.sideID || "").toLowerCase();
    const period = String(odd?.periodID || "").toLowerCase();

    if (period && period !== "game") continue;

    const price = bestBookDecimal(odd);
    if (!price) continue;

    if (betType === "ml" || betType === "moneyline") {
      if (side === "home") {
        match.bestOdds.home = Math.max(match.bestOdds.home || 0, price);
      }

      if (side === "away") {
        match.bestOdds.away = Math.max(match.bestOdds.away || 0, price);
      }

      if (side === "draw" || side === "tie") {
        match.bestOdds.draw = Math.max(match.bestOdds.draw || 0, price);
      }
    }

    if (betType === "ou" || betType === "total") {
      const line = toNumber(odd?.line) || toNumber(odd?.points);

      if (side === "over") {
        match.bestOdds.over = Math.max(match.bestOdds.over || 0, price);
        if (line) match.bestOdds.point = line;
      }

      if (side === "under") {
        match.bestOdds.under = Math.max(match.bestOdds.under || 0, price);
        if (line) match.bestOdds.point = line;
      }
    }

    if (betType === "sp" || betType === "spread") {
      const line = toNumber(odd?.line) || toNumber(odd?.points);

      if (side === "home") {
        match.bestOdds.spreadHome = Math.max(match.bestOdds.spreadHome || 0, price);
        if (line) match.bestOdds.spreadPointHome = line;
      }

      if (side === "away") {
        match.bestOdds.spreadAway = Math.max(match.bestOdds.spreadAway || 0, price);
        if (line) match.bestOdds.spreadPointAway = line;
      }
    }
  }

  return match;
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
      "X-API-Key": apiKey,
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
  const events = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.events)
    ? payload.events
    : Array.isArray(payload)
    ? payload
    : [];

  const matches = events
    .map(normalizeEvent)
    .filter((match) => match.id && match.home_team && match.away_team);

  if (matches.length === 0) {
    return {
      ok: false,
      error: "SportsGameOdds palautti tyhjän ottelulistan.",
    };
  }

  const usable = matches.filter(
    (match) =>
      match.bestOdds.home ||
      match.bestOdds.away ||
      match.bestOdds.draw ||
      match.bestOdds.over ||
      match.bestOdds.under ||
      match.bestOdds.spreadHome ||
      match.bestOdds.spreadAway
  );

  return {
    ok: true,
    data: {
      source: "live",
      status: usable.length > 0 ? "fresh" : "events_only",
      provider: "sportsgameodds",
      cached: false,
      reason:
        usable.length > 0
          ? ""
          : "Ottelut löytyivät, mutta moneyline/totals/spread-kertoimia ei löytynyt payloadista.",
      debug:
        usable.length > 0
          ? null
          : {
              firstEventKeys: events[0] ? Object.keys(events[0]) : [],
              oddsKeys: events[0]?.odds ? Object.keys(events[0].odds).slice(0, 10) : [],
              firstOdd:
                events[0]?.odds && Object.keys(events[0].odds).length > 0
                  ? events[0].odds[Object.keys(events[0].odds)[0]]
                  : null,
            },
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

  return NextResponse.json({
    ...DEMO_DATA,
    status: "api_error",
    reason: primary.error,
    debug: {
      primaryError: primary.error,
    },
  });
}
