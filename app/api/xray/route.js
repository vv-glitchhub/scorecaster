import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildMatchXRay } from "../../../lib/match-xray-engine.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, max = 120) => String(value || "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const decimalOdds = (value) => {
  const parsed = finite(value);
  return parsed !== null && parsed > 1 && parsed <= 1000 ? parsed : null;
};
const boolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const timestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const first = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return null;
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

function profileFromRow(row) {
  const observedAt = timestamp(first(row, [
    "observed_at",
    "updated_at",
    "calculated_at",
    "rated_at",
    "created_at"
  ]));

  return {
    team: row.team,
    rating: first(row, ["rating", "elo", "power_rating"]),
    attack: first(row, ["attack", "attack_rating", "attack_strength"]),
    defense: first(row, ["defense", "defence", "defense_rating", "defence_rating", "defense_strength"]),
    form: first(row, ["form", "form_rating", "recent_form"]),
    sampleSize: first(row, ["sample_size", "matches_played", "games_played", "n_matches"]),
    observedAt,
    windowStart: timestamp(first(row, ["window_start", "period_start", "season_start"])),
    windowEnd: timestamp(first(row, ["window_end", "period_end", "season_end"])) || observedAt,
    sourceId: "scorecaster_internal_team_ratings",
    xgFor: first(row, ["xg_for", "xg", "expected_goals_for"]),
    xgAgainst: first(row, ["xg_against", "xga", "expected_goals_against"]),
    shotsFor: first(row, ["shots_for", "shots", "average_shots_for"]),
    shotsAgainst: first(row, ["shots_against", "average_shots_against"]),
    possession: first(row, ["possession", "possession_pct", "average_possession"]),
    pressIntensity: first(row, ["press_intensity", "pressing_rating", "ppda_rating"]),
    transitionThreat: first(row, ["transition_threat", "transition_rating", "counter_attack_rating"]),
    setPieceThreat: first(row, ["set_piece_threat", "set_piece_rating"])
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set([
    "home",
    "away",
    "neutral",
    "kickoff",
    "eventId",
    "homeOdds",
    "drawOdds",
    "awayOdds"
  ]);

  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const home = clean(url.searchParams.get("home"));
  const away = clean(url.searchParams.get("away"));
  const kickoffAt = timestamp(url.searchParams.get("kickoff"));
  const eventId = clean(url.searchParams.get("eventId"), 160) || null;

  if (!home || !away) return json({ ok: false, error: "Missing home or away team" }, 400);
  if (home.toLowerCase() === away.toLowerCase()) return json({ ok: false, error: "Home and away teams must differ" }, 400);
  if (url.searchParams.get("kickoff") && !kickoffAt) return json({ ok: false, error: "Invalid kickoff timestamp" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({
      ok: false,
      error: "Production ratings database is not configured",
      xrayStatus: "unavailable",
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

    const homeProfile = profileFromRow(homeRow);
    const awayProfile = profileFromRow(awayRow);
    const missingTimestamps = [
      !homeProfile.observedAt ? home : null,
      !awayProfile.observedAt ? away : null
    ].filter(Boolean);

    if (missingTimestamps.length) {
      return json({
        ok: false,
        error: "Match X-Ray requires timestamped rating evidence",
        missingEvidenceTimestamps: missingTimestamps,
        paperOnly: true
      }, 422);
    }

    const marketOdds = {
      home: decimalOdds(url.searchParams.get("homeOdds")),
      draw: decimalOdds(url.searchParams.get("drawOdds")),
      away: decimalOdds(url.searchParams.get("awayOdds"))
    };

    const result = buildMatchXRay({
      eventId,
      homeTeam: homeProfile,
      awayTeam: awayProfile,
      neutralVenue: boolean(url.searchParams.get("neutral")),
      kickoffAt,
      marketOdds: Object.values(marketOdds).every(Boolean) ? marketOdds : null,
      generatedAt: new Date().toISOString(),
      trainingEvidence: {
        sampleScore: 0,
        calibrationScore: 0
      }
    });

    if (!result.ok) {
      const status = result.reason === "chronology-violation" ? 409 : 422;
      return json(result, status);
    }

    return json({
      ...result,
      sourceRegistryPath: "/api/sources",
      publicApi: {
        path: "/api/xray",
        authenticationRequired: false,
        cors: "*"
      },
      safety: {
        closingLineUsed: false,
        postKickoffDataUsed: false,
        inventedMetrics: false,
        canPromotePlayByItself: false,
        bookmakerConnection: false,
        realMoneyExecution: false,
        paperOnly: true
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Match X-Ray data could not be loaded" : String(error),
      paperOnly: true
    }, 500);
  }
}
