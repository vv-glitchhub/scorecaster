import { collectorRegistrySummary } from "../../../../lib/collector-source-registry.mjs";
import { collectorJsonProviderConfiguration } from "../../../../lib/collector-json-provider";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff"
};

export async function GET() {
  const registry = collectorRegistrySummary();
  return Response.json({
    ok: true,
    version: "collector-source-registry-v1",
    generatedAt: new Date().toISOString(),
    summary: {
      total: registry.total,
      enabled: registry.enabled,
      productionApproved: registry.productionApproved,
      researchOnly: registry.researchOnly
    },
    sources: registry.sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      accessMode: source.accessMode,
      enabled: source.enabled,
      commercialUseAllowed: source.commercialUseAllowed,
      redistributionAllowed: source.redistributionAllowed,
      modelTrainingAllowed: source.modelTrainingAllowed,
      attributionRequired: source.attributionRequired,
      attribution: source.attribution,
      license: source.license,
      termsUrl: source.termsUrl,
      sports: source.sports,
      notes: source.notes
    })),
    genericProvider: collectorJsonProviderConfiguration(),
    safety: {
      productionCollectionFailsClosed: true,
      unknownSourcesRejected: true,
      researchDataPublished: false,
      paywallBypassSupported: false,
      scrapingProtectionBypassSupported: false
    }
  }, { headers: HEADERS });
}
