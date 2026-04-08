import { NextResponse } from "next/server";

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
];

function buildDemoOdds(match) {
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
            outcomes: [
              { name: match.home_team, price: 2.25 },
              { name: match.away_team, price: 1.78 },
            ],
          },
        ],
      },
    ],
  };
}

function normalizeSportToOddsKey(sport) {
  const value = String(sport ?? "").trim().toLowerCase();

  if (!value) return "icehockey_liiga";
  if (value.includes("liiga")) return "icehockey_liiga";
  if (value.includes("nhl")) return "icehockey_nhl";
  if (value.includes("soccer") || value.includes("jalkapallo")) return "soccer_epl";
  if (value.includes("basket")) return "basketball_nba";

  return value;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedSport = searchParams.get("sport") || "icehockey_liiga";
    const sportKey = normalizeSportToOddsKey(requestedSport);

    const apiKey =
      process.env.ODDS_API_KEY ||
      process.env.THE_ODDS_API_KEY ||
      "";

    const demoData = DEMO_MATCHES
      .filter((m) => m.sport_key === sportKey || sportKey === "icehockey_liiga")
      .map(buildDemoOdds);

    console.log("ODDS_API_KEY exists:", Boolean(apiKey));
    console.log("Requested sport:", requestedSport);
    console.log("Normalized sport key:", sportKey);

    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        source: "demo",
        data: demoData,
        debug: {
          requestedSport: sportKey,
          requestedGroup: "icehockey",
          rawCount: 0,
          usableCount: 0,
          cachedCount: 0,
          demoCount: demoData.length,
          status: 401,
          reason: "Missing API key",
          hasApiKey: false,
          cacheSeconds: 600,
        },
      });
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/` +
      `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

    console.log("Odds request URL:", url.replace(apiKey, "HIDDEN"));

    const res = await fetch(url, {
      next: { revalidate: 600 }, // 10 min cache
    });

    console.log("Odds API response status:", res.status);

    if (!res.ok) {
      let errorBody = "";

      try {
        errorBody = await res.text();
      } catch {
        errorBody = "Could not read error body";
      }

      let parsedError = null;
      try {
        parsedError = JSON.parse(errorBody);
      } catch {}

      const isQuotaError =
        parsedError?.error_code === "OUT_OF_USAGE_CREDITS";

      return NextResponse.json({
        ok: true,
        source: "demo",
        data: demoData,
        debug: {
          requestedSport: sportKey,
          requestedGroup: "icehockey",
          rawCount: 0,
          usableCount: 0,
          cachedCount: 0,
          demoCount: demoData.length,
          status: res.status,
          reason: isQuotaError
            ? "Odds API credits exhausted, using demo fallback"
            : "Live data unavailable, using demo fallback",
          hasApiKey: true,
          oddsApiErrorBody: errorBody,
          oddsApiErrorCode: parsedError?.error_code ?? null,
          cacheSeconds: 600,
        },
      });
    }

    const raw = await res.json();

    const normalized = Array.isArray(raw)
      ? raw.map((match) => ({
          id: match.id,
          sport_key: match.sport_key,
          sport_title: match.sport_title,
          commence_time: match.commence_time,
          home_team: match.home_team,
          away_team: match.away_team,
          bookmakers: Array.isArray(match.bookmakers) ? match.bookmakers : [],
        }))
      : [];

    return NextResponse.json({
      ok: true,
      source: "live",
      data: normalized,
      debug: {
        requestedSport: sportKey,
        requestedGroup: "icehockey",
        rawCount: normalized.length,
        usableCount: normalized.length,
        cachedCount: 0,
        demoCount: 0,
        status: 200,
        hasApiKey: true,
        cacheSeconds: 600,
      },
    });
  } catch (error) {
    const demoData = DEMO_MATCHES.map(buildDemoOdds);

    return NextResponse.json({
      ok: true,
      source: "demo",
      data: demoData,
      debug: {
        requestedSport: "icehockey_liiga",
        requestedGroup: "icehockey",
        rawCount: 0,
        usableCount: 0,
        cachedCount: 0,
        demoCount: demoData.length,
        status: 500,
        reason: error?.message ?? "Unknown error",
        cacheSeconds: 600,
      },
    });
  }
}
