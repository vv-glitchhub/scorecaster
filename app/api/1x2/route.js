import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildTransparent1X2 } from "../../../lib/transparent-1x2-engine.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const cleanTeam = (value) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 120);
const odds = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 1 && parsed <= 1000 ? parsed : null;
};
const boolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

function teamInput(row) {
  return {
    team: row.team,
    rating: row.rating ?? row.elo ?? row.power_rating,
    attack: row.attack ?? row.attack_rating,
    defense: row.defense ?? row.defence ?? row.defense_rating,
    form: row.form ?? row.form_rating
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["home", "away", "neutral", "homeOdds", "drawOdds", "awayOdds"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const home = cleanTeam(url.searchParams.get("home"));
  const away = cleanTeam(url.searchParams.get("away"));
  if (!home || !away) return json({ ok: false, error: "Missing home or away team" }, 400);
  if (home.toLowerCase() === away.toLowerCase()) return json({ ok: false, error: "Home and away teams must differ" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({
      ok: false,
      error: "Production ratings database is not configured",
      modelStatus: "unavailable",
      paperOnly: true
    }, 503);
  }

  try {
    const { data, error } = await admin
      .from("team_ratings")
      .select("*")
      .in("team", [home, away]);
    if (error) throw error;

    const rows = data || [];
    const homeRow = rows.find((row) => String(row.team).toLowerCase() === home.toLowerCase());
    const awayRow = rows.find((row) => String(row.team).toLowerCase() === away.toLowerCase());
    if (!homeRow || !awayRow) {
      return json({
        ok: false,
        error: "Missing stored ratings for one or both teams",
        missingTeams: [!homeRow ? home : null, !awayRow ? away : null].filter(Boolean),
        paperOnly: true
      }, 404);
    }

    const marketOdds = {
      home: odds(url.searchParams.get("homeOdds")),
      draw: odds(url.searchParams.get("drawOdds")),
      away: odds(url.searchParams.get("awayOdds"))
    };
    const result = buildTransparent1X2({
      homeTeam: teamInput(homeRow),
      awayTeam: teamInput(awayRow),
      neutralVenue: boolean(url.searchParams.get("neutral")),
      marketOdds: Object.values(marketOdds).every(Boolean) ? marketOdds : null,
      trainingEvidence: {
        sampleScore: 0,
        calibrationScore: 0
      }
    });

    if (!result.ok) return json(result, 422);

    return json({
      ...result,
      sourceEvidence: [{
        sourceId: "scorecaster_internal",
        sourceTable: "team_ratings",
        fieldsUsed: ["rating", "attack", "defense", "form"],
        rawDatabaseRowsPublished: false
      }],
      publicApi: {
        path: "/api/1x2",
        authenticationRequired: false,
        cors: "*"
      },
      safety: {
        closingLineUsed: false,
        postKickoffDataUsed: false,
        canPromotePlayByItself: false,
        realMoneyExecution: false,
        paperOnly: true
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "1X2 model data could not be loaded" : String(error),
      paperOnly: true
    }, 500);
  }
}
