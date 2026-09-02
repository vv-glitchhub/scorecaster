import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import {
  buildDecisionTransparency,
  OPEN_METHODOLOGY,
  publicRecord,
  publicSourceCatalogue
} from "../../../lib/decision-transparency.mjs";
import {
  buildProfessionalExplanation,
  reproduceProfessionalExplanation
} from "../../../lib/professional-explanation-v1.mjs";
import { publicModelFormulaRegistry } from "../../../lib/public-model-formula-registry-v2.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const json = (body, status = 200) => Response.json(body, { status, headers: HEADERS });
const clampInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};
const clean = (value, limit = 180) => String(value || "")
  .replace(/[^a-zA-Z0-9_.:@-]/g, "")
  .slice(0, limit);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const enabled = (value) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

function normalize(row) {
  return {
    sourceId: row.source_id,
    eventId: row.event_id,
    entityId: row.entity_id,
    sport: row.sport,
    league: row.league,
    metric: row.metric,
    value: row.value === null ? null : Number(row.value),
    unit: row.unit,
    observedAt: row.observed_at,
    collectedAt: row.collected_at,
    confidence: Number(row.confidence || 0),
    sourceTrust: Number(row.source_trust || 0)
  };
}

function eventSummary(eventId, records) {
  const newest = [...records].sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0))[0];
  return {
    eventId,
    sport: newest?.sport || null,
    league: newest?.league || null,
    newestObservationAt: newest?.observedAt || null,
    recordCount: records.length,
    metrics: [...new Set(records.map((record) => record.metric).filter(Boolean))].sort(),
    sources: [...new Set(records.map((record) => record.sourceId).filter(Boolean))].sort()
  };
}

function pickAudit(url, eventId) {
  return {
    eventId,
    decision: clean(url.searchParams.get("decision"), 30) || undefined,
    bookmaker: clean(url.searchParams.get("bookmaker"), 120) || undefined,
    bestOdds: finite(url.searchParams.get("odds")),
    modelProbability: finite(url.searchParams.get("modelProbability")),
    marketProbability: finite(url.searchParams.get("marketProbability")),
    edge: finite(url.searchParams.get("edge")),
    modelVersion: clean(url.searchParams.get("modelVersion"), 120) || undefined
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set([
    "eventId", "hours", "limit", "mode", "reproduce", "snapshotHash",
    "decision", "bookmaker", "odds", "modelProbability", "marketProbability", "edge", "modelVersion"
  ]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }

  const eventId = clean(url.searchParams.get("eventId"));
  const hours = clampInt(url.searchParams.get("hours"), 168, 24, 8760);
  const limit = clampInt(url.searchParams.get("limit"), 2000, 100, 5000);
  const mode = clean(url.searchParams.get("mode"), 20) === "pro" ? "pro" : "simple";
  const reproduce = enabled(url.searchParams.get("reproduce"));
  const snapshotHash = clean(url.searchParams.get("snapshotHash"), 64);
  if ((mode === "pro" || reproduce || snapshotHash) && !eventId) {
    return json({ ok: false, error: "eventId is required for Pro Mode and reproduction" }, 400);
  }

  const registry = publicSourceCatalogue();
  const modelFormulaRegistry = publicModelFormulaRegistry();
  const admin = getSupabaseAdmin();

  if (!admin) {
    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      methodology: OPEN_METHODOLOGY,
      modelFormulaRegistry,
      sourceRegistry: registry,
      dataAvailable: false,
      reason: "Production database is not configured",
      publicApi: { path: "/api/transparency", authenticationRequired: false, cors: "*" }
    });
  }

  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    let query = admin
      .from("collector_records")
      .select("source_id,event_id,entity_id,sport,league,metric,value,unit,observed_at,collected_at,confidence,source_trust")
      .eq("publishable", true)
      .gte("collected_at", since)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (eventId) query = query.eq("event_id", eventId);

    const { data, error } = await query;
    if (error) throw error;
    const records = (data || []).map(normalize);
    const grouped = new Map();
    for (const record of records) {
      if (!record.eventId) continue;
      const rows = grouped.get(record.eventId) || [];
      rows.push(record);
      grouped.set(record.eventId, rows);
    }

    const usedSourceIds = [...new Set(records.map((record) => record.sourceId).filter(Boolean))];
    const usedSources = usedSourceIds.map((id) => registry.find((source) => source.id === id) || {
      id,
      name: id,
      license: "not listed in public registry",
      termsUrl: null,
      redistributionAllowed: false
    });

    const selectedRecords = eventId ? grouped.get(eventId) || [] : [];
    const audit = eventId ? pickAudit(url, eventId) : null;
    const explanation = eventId
      ? buildDecisionTransparency(selectedRecords, audit, Date.now())
      : null;
    const professionalExplanation = eventId
      ? reproduce
        ? reproduceProfessionalExplanation({
            records: selectedRecords,
            pick: audit,
            generatedAt: explanation?.generatedAt,
            expectedSnapshotHash: snapshotHash || undefined
          })
        : buildProfessionalExplanation(selectedRecords, audit, Date.now())
      : null;

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      methodology: OPEN_METHODOLOGY,
      modelFormulaRegistry,
      sourceRegistry: registry,
      usedSources,
      filters: { eventId: eventId || null, hours, limit, mode, reproduce },
      publicApi: {
        path: "/api/transparency",
        authenticationRequired: false,
        cors: "*",
        examples: [
          "/api/transparency",
          "/api/transparency?eventId=EVENT_ID",
          "/api/transparency?eventId=EVENT_ID&mode=pro",
          "/api/transparency?eventId=EVENT_ID&mode=pro&reproduce=1&snapshotHash=SHA256",
          "/api/transparency?hours=720&limit=5000"
        ]
      },
      events: [...grouped.entries()].map(([id, rows]) => eventSummary(id, rows)),
      explanation,
      professionalExplanation,
      records: eventId ? selectedRecords.map(publicRecord) : [],
      disclosure: {
        allFormulasPublished: true,
        modelRegistryPublished: true,
        allDecisionThresholdsPublished: true,
        allNormalizedInputsForSelectedEventPublished: Boolean(eventId),
        reproducibleSnapshotPublished: Boolean(professionalExplanation?.reproducibility?.snapshotHash),
        allUsedSourceIdsPublished: true,
        rawProviderPayloadsPublished: false,
        personalDataPublished: false,
        privateKeysPublished: false,
        reason: "Raw provider payloads are excluded when redistribution rights are absent or payloads could contain credentials, personal data or security-sensitive fields."
      }
    });
  } catch (error) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Transparency data could not be loaded" : String(error),
      methodology: OPEN_METHODOLOGY,
      modelFormulaRegistry,
      sourceRegistry: registry
    }, 500);
  }
}
