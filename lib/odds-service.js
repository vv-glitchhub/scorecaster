import {
  clearExpiredOddsCache,
  getOddsCache,
  getOddsCacheMeta,
  setOddsCache,
} from "./odds-cache";

export const DEFAULT_TTL_SECONDS = 600;
export const LIVE_TTL_SECONDS = 600;
export const DEMO_TTL_SECONDS = 180;
export const ERROR_TTL_SECONDS = 300;

const DEMO_MATCHES = [
  {
    id: "demo-liiga-1",
    sport_key: "icehockey_liiga",
    sport_title: "Liiga",
    commence_time: "2026-04-05T17:30:00Z",
    home_team: "Tappara",
    away_team: "Ilves",
  },
  {
    id: "demo-liiga-2",
    sport_key: "icehockey_liiga",
    sport_title: "Liiga",
    commence_time: "2026-04-06T15:00:00Z",
    home_team: "Lukko",
    away_team: "TPS",
  },
  {
    id: "demo-nhl-1",
    sport_key: "icehockey_nhl",
    sport_title: "NHL",
    commence_time: "2026-04-05T23:00:00Z",
    home_team: "Boston Bruins",
    away_team: "Toronto Maple Leafs",
  },
  {
    id: "demo-nba-1",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: "2026-04-05T23:30:00Z",
    home_team: "Lakers",
    away_team: "Celtics",
  },
  {
    id: "demo-epl-1",
    sport_key: "soccer_epl",
    sport_title: "Premier League",
    commence_time: "2026-04-05T14:00:00Z",
    home_team: "Arsenal",
    away_team: "Liverpool",
  },
  {
    id: "demo-nfl-1",
    sport_key: "americanfootball_nfl",
    sport_title: "NFL",
    commence_time: "2026-04-06T00:20:00Z",
    home_team: "Chiefs",
    away_team: "Bills",
  },
];

function buildDemoOdds(match) {
  const isSoccer = String(match.sport_key).startsWith("soccer_");

  const outcomes = isSoccer
    ? [
        { name: match.home_team, price: 2.55 },
        { name: "Draw", price: 3.35 },
        { name: match.away_team, price: 2.75 },
      ]
    : [
        { name: match.home_team, price: 2.25 },
        { name: match.away_team, price: 1.78 },
      ];

  return {
    id: match.id,
    sport_key: match.sport_key,
    sport_title: match.sport_title,
    commence_time: match.commence_time,
    home_team: match.home_team,
    away_team: match.away_team,
    bookmakers: [
      {
        key: "demobook",
        title: "DemoBook",
        markets: [
          {
            key: "h2h",
            outcomes,
          },
        ],
      },
      {
        key: "sharpdemo",
        title: "SharpDemo",
        markets: [
          {
            key: "h2h",
            outcomes: isSoccer
              ? [
                  { name: match.home_team, price: 2.62 },
                  { name: "Draw", price: 3.22 },
                  { name: match.away_team, price: 2.68 },
                ]
              : [
                  { name: match.home_team, price: 2.34 },
                  { name: match.away_team, price: 1.72 },
                ],
          },
        ],
      },
    ],
  };
}

export function normalizeSportToOddsKey(sport) {
  const value = String(sport ?? "").trim().toLowerCase();

  if (!value) return "icehockey_liiga";

  const exactMap = {
    icehockey_liiga: "icehockey_liiga",
    icehockey_nhl: "icehockey_nhl",
    icehockey_allsvenskan: "icehockey_allsvenskan",
    icehockey_sweden_hockey_league: "icehockey_sweden_hockey_league",
    basketball_nba: "basketball_nba",
    basketball_euroleague: "basketball_euroleague",
    basketball_ncaab: "basketball_ncaab",
    soccer_epl: "soccer_epl",
    soccer_spain_la_liga: "soccer_spain_la_liga",
    soccer_italy_serie_a: "soccer_italy_serie_a",
    soccer_germany_bundesliga: "soccer_germany_bundesliga",
    americanfootball_nfl: "americanfootball_nfl",
    americanfootball_ncaaf: "americanfootball_ncaaf",
  };

  if (exactMap[value]) return exactMap[value];

  if (value.includes("liiga")) return "icehockey_liiga";
  if (value.includes("nhl")) return "icehockey_nhl";
  if (value.includes("allsvenskan")) return "icehockey_allsvenskan";
  if (value.includes("shl")) return "icehockey_sweden_hockey_league";
  if (value.includes("nba")) return "basketball_nba";
  if (value.includes("euroleague")) return "basketball_euroleague";
  if (value.includes("ncaab")) return "basketball_ncaab";
  if (value.includes("epl") || value.includes("premier")) return "soccer_epl";
  if (value.includes("la liga")) return "soccer_spain_la_liga";
  if (value.includes("serie a")) return "soccer_italy_serie_a";
  if (value.includes("bundesliga")) return "soccer_germany_bundesliga";
  if (value.includes("nfl")) return "americanfootball_nfl";
  if (value.includes("ncaaf")) return "americanfootball_ncaaf";

  return value;
}

export function getGroupFromSportKey(sportKey) {
  if (sportKey.startsWith("icehockey_")) return "icehockey";
  if (sportKey.startsWith("basketball_")) return "basketball";
  if (sportKey.startsWith("soccer_")) return "soccer";
  if (sportKey.startsWith("americanfootball_")) return "americanfootball";
  return "unknown";
}

function isQuotaError(status, bodyText) {
  const body = String(bodyText ?? "");
  return (
    status === 401 ||
    status === 429 ||
    body.includes("OUT_OF_USAGE_CREDITS") ||
    body.includes("EXCEEDED_FREQ_LIMIT") ||
    body.includes("Usage quota") ||
    body.includes("Requests are being made too frequently")
  );
}

function buildCacheKey({ sportKey, group }) {
  return `odds:${group}:${sportKey}`;
}

function pickDemoData(sportKey) {
  const exact = DEMO_MATCHES.filter((m) => m.sport_key === sportKey);
  if (exact.length > 0) return exact.map(buildDemoOdds);

  const fallback = DEMO_MATCHES.filter(
    (m) => getGroupFromSportKey(m.sport_key) === getGroupFromSportKey(sportKey)
  );

  return (fallback.length > 0 ? fallback : DEMO_MATCHES).map(buildDemoOdds);
}

function normalizeOddsResponse(raw) {
  if (!Array.isArray(raw)) return [];

  return raw.map((match) => ({
    id: match.id,
    sport_key: match.sport_key,
    sport_title: match.sport_title,
    commence_time: match.commence_time,
    home_team: match.home_team,
    away_team: match.away_team,
    bookmakers: Array.isArray(match.bookmakers) ? match.bookmakers : [],
  }));
}

export async function getOddsData({ requestedSport, requestedGroup }) {
  clearExpiredOddsCache();

  const sportKey = normalizeSportToOddsKey(requestedSport);
  const group = requestedGroup || getGroupFromSportKey(sportKey);
  const cacheKey = buildCacheKey({ sportKey, group });

  const cached = getOddsCache(cacheKey);
  const cacheMeta = getOddsCacheMeta(cacheKey);

  if (cached) {
    return {
      ...cached,
      debug: {
        ...(cached.debug || {}),
        cacheHit: true,
        cacheKey,
        cacheCreatedAt: cacheMeta?.createdAt ?? null,
        cacheExpiresAt: cacheMeta?.expiresAt ?? null,
      },
    };
  }

  const apiKey =
    process.env.ODDS_API_KEY ||
    process.env.THE_ODDS_API_KEY ||
    "";

  if (!apiKey) {
    const demoData = pickDemoData(sportKey);

    const payload = {
      ok: true,
      source: "demo",
      data: demoData,
      empty: demoData.length === 0,
      quotaExceeded: false,
      message: "Missing API key, using demo fallback",
      debug: {
        requestedSport: sportKey,
        requestedGroup: group,
        rawCount: 0,
        usableCount: 0,
        cachedCount: 0,
        demoCount: demoData.length,
        status: 401,
        reason: "Missing API key",
        hasApiKey: false,
        cacheSeconds: DEMO_TTL_SECONDS,
      },
    };

    setOddsCache(cacheKey, payload, DEMO_TTL_SECONDS);
    return payload;
  }

  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
    `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

  try {
    const res = await fetch(url, {
      next: { revalidate: LIVE_TTL_SECONDS },
      headers: {
        Accept: "application/json",
      },
    });

    const rawText = await res.text();

    if (!res.ok) {
      const demoData = pickDemoData(sportKey);
      const quotaExceeded = isQuotaError(res.status, rawText);

      const payload = {
        ok: true,
        source: "demo",
        data: demoData,
        empty: demoData.length === 0,
        quotaExceeded,
        message: quotaExceeded
          ? "Live data unavailable, using demo fallback"
          : "Odds API request failed, using demo fallback",
        debug: {
          requestedSport: sportKey,
          requestedGroup: group,
          rawCount: 0,
          usableCount: 0,
          cachedCount: 0,
          demoCount: demoData.length,
          status: res.status,
          reason: quotaExceeded
            ? "Live data unavailable, using demo fallback"
            : "Odds API request failed",
          hasApiKey: true,
          oddsApiErrorBody: rawText,
          oddsApiErrorCode: rawText.includes("OUT_OF_USAGE_CREDITS")
            ? "OUT_OF_USAGE_CREDITS"
            : rawText.includes("EXCEEDED_FREQ_LIMIT")
            ? "EXCEEDED_FREQ_LIMIT"
            : null,
          cacheSeconds: quotaExceeded ? DEFAULT_TTL_SECONDS : ERROR_TTL_SECONDS,
        },
      };

      setOddsCache(
        cacheKey,
        payload,
        quotaExceeded ? DEFAULT_TTL_SECONDS : ERROR_TTL_SECONDS
      );

      return payload;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = [];
    }

    const normalized = normalizeOddsResponse(parsed);
    const usable = normalized.filter(
      (match) =>
        match &&
        match.home_team &&
        match.away_team &&
        Array.isArray(match.bookmakers)
    );

    if (usable.length === 0) {
      const demoData = pickDemoData(sportKey);

      const payload = {
        ok: true,
        source: "demo",
        data: demoData,
        empty: demoData.length === 0,
        quotaExceeded: false,
        message: "No usable live odds found, using demo fallback",
        debug: {
          requestedSport: sportKey,
          requestedGroup: group,
          rawCount: normalized.length,
          usableCount: 0,
          cachedCount: 0,
          demoCount: demoData.length,
          status: 200,
          reason: "No usable live odds found",
          hasApiKey: true,
          cacheSeconds: DEMO_TTL_SECONDS,
        },
      };

      setOddsCache(cacheKey, payload, DEMO_TTL_SECONDS);
      return payload;
    }

    const payload = {
      ok: true,
      source: "live",
      data: usable,
      empty: false,
      quotaExceeded: false,
      message: "",
      debug: {
        requestedSport: sportKey,
        requestedGroup: group,
        rawCount: normalized.length,
        usableCount: usable.length,
        cachedCount: 0,
        demoCount: 0,
        status: 200,
        reason: "Fresh live data",
        hasApiKey: true,
        cacheSeconds: LIVE_TTL_SECONDS,
      },
    };

    setOddsCache(cacheKey, payload, LIVE_TTL_SECONDS);
    return payload;
  } catch (error) {
    const demoData = pickDemoData(sportKey);

    const payload = {
      ok: true,
      source: "demo",
      data: demoData,
      empty: demoData.length === 0,
      quotaExceeded: false,
      message: "Unexpected error, using demo fallback",
      debug: {
        requestedSport: sportKey,
        requestedGroup: group,
        rawCount: 0,
        usableCount: 0,
        cachedCount: 0,
        demoCount: demoData.length,
        status: 500,
        reason: error?.message ?? "Unknown error",
        hasApiKey: true,
        cacheSeconds: ERROR_TTL_SECONDS,
      },
    };

    setOddsCache(cacheKey, payload, ERROR_TTL_SECONDS);
    return payload;
  }
}
