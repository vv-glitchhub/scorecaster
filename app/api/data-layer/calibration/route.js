import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { buildUnifiedCalibrationRows, summarizeUnifiedCalibration } from "../../../../lib/unified-data-calibration.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function integer(value, fallback, min, max) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: HEADERS });
}

function migrationMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("unified_data_") && (text.includes("does not exist") || text.includes("schema cache"));
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["days", "limit"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return response({ ok: false, error: "Unsupported query parameter" }, 400);
  }
  const days = integer(url.searchParams.get("days"), 180, 1, 730);
  const limit = integer(url.searchParams.get("limit"), 500, 10, 2000);
  const admin = getSupabaseAdmin();
  if (!admin) {
    return response({ ok: true, available: false, reason: "Supabase admin client is not configured", rows: [], summary: summarizeUnifiedCalibration([]) });
  }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: closingRecords, error: closingError } = await admin
      .from("unified_data_closing_records")
      .select("id,event_id,selection,sport_key,league,commence_time,opening_odds,opening_captured_at,closing_odds,closing_captured_at,price_clv,opening_snapshot_id,closing_snapshot_id,source,finalized_at")
      .gte("commence_time", since)
      .order("commence_time", { ascending: false })
      .limit(limit);
    if (closingError) throw closingError;

    const eventIds = [...new Set((closingRecords || []).map((row) => row.event_id).filter(Boolean))];
    let snapshots = [];
    if (eventIds.length) {
      const { data, error } = await admin
        .from("unified_data_snapshots")
        .select("id,event_id,selection,sport_key,league,commence_time,captured_at,decision,odds,market_probability,provider_count,provider_disagreement,coverage_score,used_factor_count,total_context_impact,safety_action,missing_families,factor_statuses")
        .in("event_id", eventIds.slice(0, 500))
        .order("captured_at", { ascending: true })
        .limit(Math.min(10000, limit * 20));
      if (error) throw error;
      snapshots = data || [];
    }

    const rows = buildUnifiedCalibrationRows({ closingRecords: closingRecords || [], snapshots, now: Date.now() });
    return response({
      ok: true,
      available: true,
      version: "unified-data-calibration-api-v1",
      filters: { days, limit },
      summary: summarizeUnifiedCalibration(rows),
      safety: {
        chronologyGuard: true,
        pregameClosingLeakage: false,
        probabilityChanged: false,
        outcomeUsed: false,
        contextCanUpgrade: false,
        paperOnly: true
      },
      rows
    });
  } catch (error) {
    if (migrationMissing(error)) {
      return response({ ok: true, available: false, reason: "Unified data migration is not active", migrationRequired: "supabase/scorecaster_unified_data.sql", rows: [], summary: summarizeUnifiedCalibration([]) });
    }
    return response({ ok: false, error: process.env.NODE_ENV === "production" ? "Calibration data could not be loaded" : String(error) }, 500);
  }
}