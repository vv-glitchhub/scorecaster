import { publicSourceRegistrySummary } from "../../../lib/source-governance.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clean = (value, limit = 80) => String(value || "")
  .replace(/[^a-zA-Z0-9_.:-]/g, "")
  .slice(0, limit);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

export function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["id", "sport", "status"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const id = clean(url.searchParams.get("id"));
  const sport = clean(url.searchParams.get("sport"));
  const status = clean(url.searchParams.get("status"));
  const registry = publicSourceRegistrySummary();
  let sources = registry.sources;

  if (id) sources = sources.filter((source) => source.id === id);
  if (sport) sources = sources.filter((source) => source.sports.includes(sport) || source.sports.includes("multi-sport"));
  if (status) sources = sources.filter((source) => source.status === status);

  return json({
    ok: true,
    generatedAt: new Date().toISOString(),
    registryVersion: registry.version,
    filters: { id: id || null, sport: sport || null, status: status || null },
    summary: {
      total: registry.total,
      visible: sources.length,
      enabled: registry.enabled,
      production: registry.production,
      researchOnly: registry.researchOnly,
      publishable: registry.publishable,
      attributionRequired: registry.attributionRequired,
      rawPayloadsPublic: registry.rawPayloadsPublic
    },
    sources,
    governance: {
      unknownSourcesRejected: true,
      unregisteredFieldsBlocked: true,
      rawPayloadsPublished: false,
      keysAndCredentialsPublished: false,
      missingRightsFailClosed: true,
      staleDataMustBeLabelled: true,
      paperOnly: true
    },
    publicApi: {
      path: "/api/sources",
      authenticationRequired: false,
      cors: "*",
      examples: [
        "/api/sources",
        "/api/sources?id=the_odds_api",
        "/api/sources?sport=soccer",
        "/api/sources?status=research-only"
      ]
    }
  });
}
