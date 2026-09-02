import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildContextEngine } from "../../../lib/context-engine.mjs";

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
const clean = (value, max = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const timestamp = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const decimalOdds = (value) => {
  const number = finite(value);
  return number !== null && number > 1 && number <= 1000 ? number : null;
};
const boolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const first = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return null;
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

function ratingProfile(row) {
  return {
    team: row.team,
    rating: first(row, ["rating", "elo", "power_rating"]),
    attack: first(row, ["attack", "attack_rating", "attack_strength"]),
    defense: first(row, ["defense", "defence", "defense_rating", "defence_rating", "defense_strength"]),
    form: first(row, ["form", "form_rating", "recent_form"])
  };
}

function contextRecord(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    teamRole: row.team_role,
    team: row.team,
    category: row.category,
    subject: row.subject,
    status: row.status,
    confirmation: row.confirmation,
    impact: row.impact,
    confidence: row.confidence,
    sourceTrust: row.source_trust,
    sourceId: row.source_id,
    observedAt: row.observed_at,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    supersedesId: row.supersedes_id,
    publicNote: row.public_note
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set([
    "eventId", "home", "away", "kickoff", "neutral",
    "homeOdds", "drawOdds", "awayOdds"
  ]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const eventId = clean(url.searchParams.get("eventId"));
  const home = clean(url.searchParams.get("home"), 120);
  const away = clean(url.searchParams.get("away"), 120);
  const kickoffAt = timestamp(url.searchParams.get("kickoff"));
  if (!eventId || !home || !away || !kickoffAt) {
    return json({ ok: false, error: "eventId, home, away and valid kickoff are required" }, 400);
  }
  if (home.toLowerCase() === away.toLowerCase()) {
    return json({ ok: false, error: "Home and away teams must differ" }, 400);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({ ok: false, error: "Production database is not configured", paperOnly: true }, 503);
  }

  try {
    const [ratingsResult, contextResult] = await Promise.all([
      admin.from("team_ratings").select("*").in("team", [home, away]),
      admin
        .from("context_evidence_v1")
        .select("id,event_id,team_role,team,category,subject,status,confirmation,impact,confidence,source_trust,source_id,observed_at,effective_at,expires_at,supersedes_id,public_note")
        .eq("event_id", eventId)
        .order("observed_at", { ascending: false })
        .limit(500)
    ]);

    if (ratingsResult.error) throw ratingsResult.error;
    if (contextResult.error) {
      const missingRelation = String(contextResult.error.code || "") === "42P01" || /context_evidence_v1/i.test(String(contextResult.error.message || ""));
      if (missingRelation) {
        return json({
          ok: false,
          error: "Context Engine production patch is not applied",
          requiredMigration: "scripts/apply-context-engine-v1.sql",
          paperOnly: true
        }, 503);
      }
      throw contextResult.error;
    }

    const ratingRows = ratingsResult.data || [];
    const homeRow = ratingRows.find((row) => String(row.team).toLowerCase() === home.toLowerCase());
    const awayRow = ratingRows.find((row) => String(row.team).toLowerCase() === away.toLowerCase());
    if (!homeRow || !awayRow) {
      return json({
        ok: false,
        error: "Missing stored ratings for one or both teams",
        missingTeams: [!homeRow ? home : null, !awayRow ? away : null].filter(Boolean),
        paperOnly: true
      }, 404);
    }

    const marketOdds = {
      home: decimalOdds(url.searchParams.get("homeOdds")),
      draw: decimalOdds(url.searchParams.get("drawOdds")),
      away: decimalOdds(url.searchParams.get("awayOdds"))
    };
    const result = buildContextEngine({
      eventId,
      kickoffAt,
      generatedAt: new Date().toISOString(),
      evidence: (contextResult.data || []).map(contextRecord),
      baselineInput: {
        homeTeam: ratingProfile(homeRow),
        awayTeam: ratingProfile(awayRow),
        neutralVenue: boolean(url.searchParams.get("neutral")),
        marketOdds: Object.values(marketOdds).every(Boolean) ? marketOdds : undefined,
        trainingEvidence: { sampleScore: 0, calibrationScore: 0 }
      }
    });

    if (!result.ok) {
      const status = result.reason?.includes("missing") ? 422 : 409;
      return json(result, status);
    }

    return json({
      ...result,
      teams: { home, away },
      sourceRegistryPath: "/api/sources",
      publicApi: { path: "/api/context", authenticationRequired: false, cors: "*" }
    });
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Context Engine data could not be loaded" : String(error),
      paperOnly: true
    }, 500);
  }
}
