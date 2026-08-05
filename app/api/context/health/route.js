import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { contextProviderConfiguration } from "../../../../lib/context-ingestion.mjs";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*"
};
const response = (body, status = 200) => Response.json(body, { status, headers: HEADERS });

function missingMigration(error) {
  return error?.code === "42P01" || /context_evidence_v1|does not exist|schema cache/i.test(String(error?.message || error || ""));
}

export async function GET() {
  const admin = getSupabaseAdmin();
  const provider = contextProviderConfiguration();
  if (!admin) {
    return response({
      ok: false,
      status: "database-unconfigured",
      provider,
      paperOnly: true
    }, 503);
  }

  try {
    const now = new Date().toISOString();
    const [{ count, error: countError }, { data: latest, error: latestError }] = await Promise.all([
      admin
        .from("context_evidence_v1")
        .select("id", { count: "exact", head: true })
        .gte("kickoff_at", now),
      admin
        .from("context_evidence_v1")
        .select("observed_at,source_id,event_id,category")
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    if (countError) throw countError;
    if (latestError) throw latestError;

    const sourceState = !provider.configured
      ? "unconfigured"
      : provider.productionAllowed
        ? "ready"
        : "blocked";

    return response({
      ok: true,
      version: "scorecaster-context-health-v1",
      status: sourceState === "ready" ? "ready" : `source-${sourceState}`,
      database: {
        tableAvailable: true,
        upcomingEvidenceCount: Number(count || 0),
        latestObservedAt: latest?.observed_at || null,
        latestSourceId: latest?.source_id || null,
        latestEventId: latest?.event_id || null,
        latestCategory: latest?.category || null
      },
      provider,
      safety: {
        directBrowserWrite: false,
        rawPayloadPublic: false,
        probabilityChangedByIngestion: false,
        realMoneyExecution: false,
        paperOnly: true
      },
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return response({
      ok: false,
      version: "scorecaster-context-health-v1",
      status: missingMigration(error) ? "migration-required" : "database-error",
      requiredPatch: missingMigration(error) ? "scripts/apply-context-engine-v1.sql" : undefined,
      provider,
      paperOnly: true
    }, 503);
  }
}
