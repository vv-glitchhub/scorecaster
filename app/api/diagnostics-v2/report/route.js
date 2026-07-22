import { getRequestId, jsonResponse } from "../../../../lib/api-security";
import { buildDiagnosticReport, diagnosticReportCsv } from "../../../../lib/decision-diagnostics-v21.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function forwardedHeaders(request) {
  const headers = { Accept: "application/json" };
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  const unknown = [...url.searchParams.keys()].filter((key) => key !== "format");
  if (unknown.length || !["json", "csv"].includes(format)) {
    return jsonResponse({ ok: false, error: "Unsupported report format" }, 400, requestId);
  }

  try {
    const response = await fetch(`${url.origin}/api/diagnostics-v2?limit=168`, {
      headers: forwardedHeaders(request),
      cache: "no-store",
      signal: AbortSignal.timeout(45000)
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      return jsonResponse({ ok: false, error: payload?.error || "Diagnostics report unavailable" }, 503, requestId);
    }

    const report = buildDiagnosticReport(payload);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(diagnosticReportCsv(report), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="scorecaster-diagnostics-${stamp}.csv"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Request-Id": requestId
        }
      });
    }

    return new Response(`${JSON.stringify(report, null, 2)}\n`, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="scorecaster-diagnostics-${stamp}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId
      }
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Diagnostics report could not be generated" : String(error)
    }, 500, requestId);
  }
}
