import { getCollectorSource, sourceCanCollect } from "./collector-source-registry.mjs";
import { normalizeCollectorBatch } from "./collector-normalize.mjs";

function clean(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function collectorJsonProviderConfiguration(env = process.env) {
  const sourceId = clean(env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 80).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  return {
    sourceId,
    configured: Boolean(source?.baseUrl),
    enabled: Boolean(source?.enabled),
    productionAllowed: permission.allowed,
    blockedReason: permission.reason,
    baseUrl: source?.baseUrl ? "configured" : null,
    hasApiKey: Boolean(env.COLLECTOR_JSON_API_KEY),
    commercialUseAllowed: Boolean(source?.commercialUseAllowed),
    accessMode: source?.accessMode || "disabled",
    license: source?.license || "unverified"
  };
}

export async function fetchCollectorJsonRecords(context = {}, options = {}) {
  const env = options.env || process.env;
  const sourceId = clean(env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 80).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  if (!source?.baseUrl) return { ok: true, mode: "unconfigured", source: sourceId, records: [], rejected: [] };
  if (!permission.allowed) return { ok: true, mode: "blocked", reason: permission.reason, source: sourceId, records: [], rejected: [] };
  if (!isHttps(source.baseUrl)) return { ok: false, mode: "blocked", reason: "https-required", source: sourceId, records: [], rejected: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(60_000, Number(options.timeoutMs || 20_000))));
  try {
    const response = await fetch(source.baseUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(env.COLLECTOR_JSON_API_KEY ? { authorization: `Bearer ${env.COLLECTOR_JSON_API_KEY}` } : {})
      },
      body: JSON.stringify({
        version: "scorecaster-collector-contract-v1",
        requestedAt: new Date().toISOString(),
        context: {
          eventIds: Array.isArray(context.eventIds) ? context.eventIds.map((item) => clean(item, 180)).filter(Boolean).slice(0, 100) : [],
          sports: Array.isArray(context.sports) ? context.sports.map((item) => clean(item, 60)).filter(Boolean).slice(0, 30) : [],
          since: context.since || null
        }
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, mode: "error", reason: `provider-http-${response.status}`, source: sourceId, records: [], rejected: [] };
    }
    const items = Array.isArray(payload?.records) ? payload.records : Array.isArray(payload?.data) ? payload.data : [];
    const normalized = normalizeCollectorBatch(items, { sourceId, collectedAt: new Date().toISOString(), env });
    return { ok: true, mode: "live", source: sourceId, ...normalized };
  } catch (error) {
    return {
      ok: false,
      mode: "error",
      reason: error?.name === "AbortError" ? "provider-timeout" : "provider-request-failed",
      source: sourceId,
      records: [],
      rejected: []
    };
  } finally {
    clearTimeout(timer);
  }
}
