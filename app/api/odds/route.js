import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cachedData = new Map();

const CACHE_MS = 10 * 60 * 1000;

const SPORTS_GAME_ODDS_LEAGUES = [
  "NHL",
  "NBA",
  "NFL",
  "MLB",
  "NCAAF",
  "NCAAB",
  "WNBA",
  "MLS",
  "EPL",
  "UCL",
];

const FINNISH_LEAGUES = {
  FIN_LIIGA: {
    id: "4931",
    title: "Liiga",
    sport: "Ice Hockey",
  },
  FIN_VEIKKAUSLIIGA: {
    id: "4636",
    title: "Veikkausliiga",
    sport: "Soccer",
  },
  FIN_CUP: {
    id: "5186",
    title: "Finnish Cup",
    sport: "Soccer",
  },
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
  let best =
    americanToDecimal(odd?.bookOdds) ||
    americanToDecimal(odd?.fairOdds) ||
    toNumber(odd?.decimalOdds);

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

function normalizeSportsGameOddsEvent(event) {
  const match = {
    id: String(event?.eventID || event?.id),
    sport_key: String(event?.sportID || "SPORT"),
    sport_title: String(event?.leagueID || "League"),
    commence_time: event?.status?.startsAt || event?.startTime || null,
    is_live: Boolean(event?.status?.live),
    is_completed: Boolean(event?.status?.completed || event?.status?.ended),
    home_team: getTeamName(event, "home"),
    away_team: getTeamName(event, "away"),
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

function hasAnyOdds(match) {
  return Boolean(
    match.bestOdds.home ||
      match.bestOdds.away ||
      match.bestOdds.draw ||
      match.bestOdds.over ||
      match.bestOdds.under ||
      match.bestOdds.spreadHome ||
      match.bestOdds.spreadAway
  );
}

async function fetchSportsGameOddsLeague({ apiKey, leagueID, oddsOnly }) {
  const url =
    "https://api.sportsgameodds.com/v2/events" +
    `?apiKey=${apiKey}` +
    `&leagueID=${encodeURIComponent(leagueID)}` +
    `&oddsAvailable=${oddsOnly ? "true" : "false"}` +
    "&includeAltLines=false" +
    "&limit=50";

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
      leagueID,
      error: `SportsGameOdds ${leagueID} error ${response.status}: ${text}`,
      matches: [],
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

  return {
    ok: true,
    leagueID,
    error: "",
    matches: events.map(normalizeSportsGameOddsEvent),
  };
}

function normalizeTheSportsDbEvent(event, leagueKey, leagueInfo) {
  return {
    id: String(event?.idEvent),
    sport_key: leagueInfo.sport,
    sport_title: leagueInfo.title,
    commence_time: event?.strTimestamp || event?.dateEvent || null,
    is_live: false,
    is_completed: false,
    home_team: event?.strHomeTeam || "Home",
    away_team: event?.strAwayTeam || "Away",
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
    fixturesOnly: true,
    leagueKey,
  };
}

async function fetchTheSportsDbLeague({ leagueKey }) {
  const leagueInfo = FINNISH_LEAGUES[leagueKey];
  const apiKey = process.env.THESPORTSDB_API_KEY || "3";

  if (!leagueInfo) {
    return {
      ok: false,
      leagueID: leagueKey,
      error: `Unknown Finnish league: ${leagueKey}`,
      matches: [],
    };
  }

  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnextleague.php?id=${leagueInfo.id}`;

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
      leagueID: leagueKey,
      error: `TheSportsDB ${leagueKey} error ${response.status}: ${text}`,
      matches: [],
    };
  }

  const payload = JSON.parse(text);
  const events = Array.isArray(payload?.events) ? payload.events : [];

  return {
    ok: true,
    leagueID: leagueKey,
    error: "",
    matches: events.map((event) =>
      normalizeTheSportsDbEvent(event, leagueKey, leagueInfo)
    ),
  };
}

function getLeagueSelection(searchParams) {
  const league = searchParams.get("league") || "ALL";
  const sport = searchParams.get("sport") || "all";

  if (league !== "ALL") {
    return [league];
  }

  if (sport === "finland") {
    return Object.keys(FINNISH_LEAGUES);
  }

  if (sport === "hockey") {
    return ["NHL", "FIN_LIIGA"];
  }

  if (sport === "basketball") {
    return ["NBA", "NCAAB", "WNBA"];
  }

  if (sport === "football") {
    return ["NFL", "NCAAF"];
  }

  if (sport === "baseball") {
    return ["MLB"];
  }

  if (sport === "soccer") {
    return ["EPL", "MLS", "UCL", "FIN_VEIKKAUSLIIGA", "FIN_CUP"];
  }

  return [...SPORTS_GAME_ODDS_LEAGUES, ...Object.keys(FINNISH_LEAGUES)];
}

export async function GET(request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const oddsOnly = url.searchParams.get("oddsOnly") !== "0";
  const status = url.searchParams.get("status") || "all";
  const leagues = getLeagueSelection(url.searchParams);

  const cacheKey = JSON.stringify({ leagues, oddsOnly, status });
  const now = Date.now();
  const cached = cachedData.get(cacheKey);

  if (!force && cached && now - cached.cachedAt < CACHE_MS) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAgeSeconds: Math.round((now - cached.cachedAt) / 1000),
    });
  }

  const sgoApiKey = process.env.SPORTSGAMEODDS_API_KEY;

  const tasks = leagues.map((leagueID) => {
    if (FINNISH_LEAGUES[leagueID]) {
      return fetchTheSportsDbLeague({ leagueKey: leagueID });
    }

    if (!sgoApiKey) {
      return Promise.resolve({
        ok: false,
        leagueID,
        error: "SPORTSGAMEODDS_API_KEY puuttuu Vercelistä.",
        matches: [],
      });
    }

    return fetchSportsGameOddsLeague({
      apiKey: sgoApiKey,
      leagueID,
      oddsOnly,
    });
  });

  const results = await Promise.all(tasks);

  let matches = results.flatMap((result) => result.matches);

  if (status === "live") {
    matches = matches.filter((match) => match.is_live);
  }

  if (status === "upcoming") {
    matches = matches.filter((match) => !match.is_live && !match.is_completed);
  }

  if (oddsOnly) {
    matches = matches.filter((match) => hasAnyOdds(match));
  }

  const seen = new Set();
  matches = matches.filter((match) => {
    if (!match.id) return false;
    if (seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });

  const errors = results.filter((result) => !result.ok).map((result) => result.error);

  const hasFinnish = leagues.some((league) => FINNISH_LEAGUES[league]);
  const fixturesOnlyCount = matches.filter((match) => match.fixturesOnly).length;

  const data = {
    source: "live",
    status: matches.length > 0 ? "fresh" : "empty",
    provider: hasFinnish ? "multi-api" : "sportsgameodds",
    cached: false,
    reason:
      matches.length > 0
        ? fixturesOnlyCount > 0
          ? "Osa Suomen sarjoista tulee ottelulistana ilman odds-dataa."
          : ""
        : "Valituilla filttereillä ei löytynyt pelejä. Kokeile Odds only pois päältä tai All-lajia.",
    debug: errors.length ? { errors } : null,
    filters: {
      leagues,
      oddsOnly,
      status,
    },
    matches,
  };

  cachedData.set(cacheKey, {
    cachedAt: now,
    data,
  });

  return NextResponse.json(data);
}
