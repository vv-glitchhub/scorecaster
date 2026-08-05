import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse
} from "../../../lib/api-security";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { buildCalibrationReport } from "../../../lib/calibration-lab-v1.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SELECT = "id,bet_id,event_id,sport,league,market,selection,bookmaker,decision,model_version,entry_odds,entry_market_probability,model_probability,closing_consensus_probability,closing_fair_odds,closing_provider_count,closing_captured_at,commence_time,bet_created_at,settled_at,status,outcome_value,stake,profit,price_clv,probability_clv,brier_score,log_loss,exclusion_reason,evidence_version,source_id,created_at";
const MAX_RECORDS = 5000;

function missingPatch(error) {
  return error?.code === "42P01" || /calibration_observations_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvExport(records = []) {
  const columns = [
    "eventId", "sport", "league", "market", "selection", "bookmaker", "decision", "modelVersion",
    "entryOdds", "entryMarketProbability", "modelProbability", "closingConsensusProbability", "closingFairOdds",
    "closingProviderCount", "outcomeValue", "stake", "profit", "priceClv", "probabilityClv", "brier", "logLoss",
    "createdAt", "kickoffAt", "closingCapturedAt", "settledAt"
  ];
  return [columns.join(","), ...records.map((record) => columns.map((column) => csvCell(record[column])).join(","))].join("\n");
}

function redactedReport(report) {
  return {
    ...report,
    records: Array.isArray(report.records)
      ? report.records.map(({ betId: _betId, ...record }) => record)
      : undefined,
    exportBoundary: {
      personalIdentifiersIncluded: false,
      rawProviderPayloadIncluded: false,
      apiKeysIncluded: false
    }
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "calibration_lab_read",
    limit: 30,
    windowSeconds: 60
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const allowed = new Set(["days", "format", "includeRecords"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);
  }
  const days = Math.max(7, Math.min(1825, Number.parseInt(url.searchParams.get("days") || "365", 10) || 365));
  const format = cleanText(url.searchParams.get("format") || "json", 20).toLowerCase();
  const includeRecords = format === "csv" || ["1", "true", "yes"].includes(String(url.searchParams.get("includeRecords") || "").toLowerCase());
  if (!new Set(["json", "csv"]).has(format)) {
    return jsonResponse({ ok: false, error: "format must be json or csv" }, 400, requestId);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return jsonResponse({ ok: false, error: "Production database is not configured" }, 503, requestId);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    const { data, error } = await admin
      .from("calibration_observations_v1")
      .select(SELECT)
      .eq("user_id", auth.user.id)
      .gte("bet_created_at", since)
      .order("bet_created_at", { ascending: true })
      .limit(MAX_RECORDS);
    if (error) throw error;

    const report = redactedReport(buildCalibrationReport(data || [], {
      generatedAt: new Date().toISOString(),
      includeRecords
    }));
    const payload = {
      ...report,
      requestedWindowDays: days,
      rowLimit: MAX_RECORDS,
      truncated: (data || []).length >= MAX_RECORDS,
      authenticationRequired: true,
      methodologyPath: "/calibration",
      healthPath: "/api/calibration/health"
    };

    if (format === "csv") {
      return new Response(csvExport(payload.records || []), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="scorecaster-calibration-${days}d.csv"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    return jsonResponse(payload, 200, requestId, { "Cache-Control": "private, no-store" });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: missingPatch(error)
        ? "Calibration Lab production patch is not active"
        : "Calibration evidence could not be loaded",
      requiredPatch: missingPatch(error) ? "scripts/apply-calibration-lab-v1.sql" : undefined,
      paperOnly: true
    }, missingPatch(error) ? 503 : 500, requestId);
  }
}
