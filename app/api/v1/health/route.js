import {
  authenticateEnterpriseApi,
  enterpriseApiHeaders
} from "../../../../lib/enterprise-api-auth.js";

export const dynamic = "force-dynamic";

function json(payload, status, auth = null) {
  return Response.json(payload, { status, headers: enterpriseApiHeaders(auth) });
}

export async function GET(request) {
  const auth = await authenticateEnterpriseApi(request, "recommendations:read");
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, auth);

  return json({
    ok: true,
    version: "scorecaster-enterprise-api-v1",
    generatedAt: new Date().toISOString(),
    tenant: { slug: auth.tenant.slug, name: auth.tenant.name },
    dataBoundary: "derived-analysis-only",
    rawOddsRedistributed: false,
    rawProviderPayloadRedistributed: false,
    writesAvailable: false,
    wagerExecutionAvailable: false,
    paperOnly: true,
    endpoints: [
      { method: "GET", path: "/api/v1/health", scope: "recommendations:read" },
      { method: "GET", path: "/api/v1/recommendations", scope: "recommendations:read" },
      { method: "GET", path: "/api/v1/leagues/readiness", scope: "leagues:read" }
    ]
  }, 200, auth);
}
