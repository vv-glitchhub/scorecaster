import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../lib/supabase";

const MAX_CAPTURE_AGE_MS = 30 * 60 * 1000;
const COHERENT_CAPTURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_QUERY_ROWS = 500;
const MAX_RESULTS = 100;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function confidenceLabel({ decision, coverageScore, providerCount }) {
  if (decision === "PLAY" && coverageScore >= 0.7 && providerCount >= 2) return "HIGH";
  if (decision !== "SKIP" && coverageScore >= 0.5) return "MEDIUM";
  return "LOW";
}

function toCompatibilityRow(row) {
  const odds = finite(row.odds);
  const probability = finite(row.market_probability);
  if (!odds || odds <= 1 || probability === null || probability <= 0 || probability >= 1) return null;

  const valueMultiple = odds * probability;
  const selection = String(row.selection || "").trim();
  if (!selection) return null;

  return {
    id: `${row.event_id}:${selection}`,
    event_id: row.event_id,
    sport_key: row.sport_key,
    home_team: row.home_team,
    away_team: row.away_team,
    league: row.league,
    commence_time: row.commence_time,
    recommendation: selection,
    selection,
    decision: row.decision || "CAUTION",
    confidence: confidenceLabel({
      decision: row.decision,
      coverageScore: finite(row.coverage_score) || 0,
      providerCount: Number(row.provider_count || 0)
    }),
    best_odds: odds,
    best_ev: Number(valueMultiple.toFixed(6)),
    edge: Number((valueMultiple - 1).toFixed(6)),
    model_probability: probability,
    provider_count: Number(row.provider_count || 0),
    coverage_score: finite(row.coverage_score),
    used_factor_count: Number(row.used_factor_count || 0),
    safety_action: row.safety_action || null,
    captured_at: row.captured_at,
    source: "unified-data-snapshots",
    paper_only: true
  };
}

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured", valueBets: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const { data, error } = await supabase
      .from("unified_data_snapshots")
      .select("event_id,sport_key,league,commence_time,home_team,away_team,selection,decision,odds,market_probability,provider_count,coverage_score,used_factor_count,safety_action,captured_at")
      .gte("commence_time", nowIso)
      .order("captured_at", { ascending: false })
      .limit(MAX_QUERY_ROWS);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch current value observations", valueBets: [] },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const newestCapturedAt = rows
      .map((row) => Date.parse(String(row.captured_at || "")))
      .filter(Number.isFinite)
      .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);

    if (!newestCapturedAt || now - newestCapturedAt > MAX_CAPTURE_AGE_MS) {
      return NextResponse.json(
        {
          valueBets: [],
          source: "unified-data-snapshots",
          freshness: "stale",
          generatedAt: nowIso,
          newestCapturedAt: newestCapturedAt ? new Date(newestCapturedAt).toISOString() : null,
          paperOnly: true
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const coherentFloor = newestCapturedAt - COHERENT_CAPTURE_WINDOW_MS;
    const seen = new Set();
    const valueBets = [];

    for (const row of rows) {
      const capturedAt = Date.parse(String(row.captured_at || ""));
      if (!Number.isFinite(capturedAt) || capturedAt < coherentFloor) continue;

      const key = `${row.event_id || ""}:${String(row.selection || "").trim().toLowerCase()}`;
      if (!row.event_id || seen.has(key)) continue;
      seen.add(key);

      const mapped = toCompatibilityRow(row);
      if (!mapped || mapped.best_ev <= 1) continue;
      valueBets.push(mapped);
    }

    valueBets.sort((left, right) => right.best_ev - left.best_ev || Date.parse(left.commence_time) - Date.parse(right.commence_time));

    return NextResponse.json(
      {
        valueBets: valueBets.slice(0, MAX_RESULTS),
        source: "unified-data-snapshots",
        freshness: "live",
        generatedAt: nowIso,
        newestCapturedAt: new Date(newestCapturedAt).toISOString(),
        paperOnly: true
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unexpected server error", valueBets: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
