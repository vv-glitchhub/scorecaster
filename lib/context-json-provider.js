import { getCollectorSource, sourceCanCollect } from "./collector-source-registry.mjs";
import { contextProviderConfiguration, normalizeContextBatch } from "./context-ingestion.mjs";

const clean = (value, max = 500) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

function isHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function publicEvents(events = []) {
  return (Array.isArray(events) ? events : []).slice(0, 250).map((event) => ({
    eventId: clean(event.eventId ?? event.id, 180),
    sport: clean(event.sport ?? event.sportKey, 100) || null,
    league: clean(event.league ?? event.sportTitle, 140) || null,
    homeTeam: clean(event.homeTeam, 140) || null,
    awayTeam: clean(event.awayTeam, 140) || null,
    kickoffAt: event.kickoffAt ?? event.commenceTime ?? null
  })).filter((event) => event.eventId && event.kickoffAt);
}

export async function fetchContextJsonRecords(events = [], options = {}) {
  const env = options.env || process.env;
  const sourceId = clean(env.COLLECTOR_JSON_SOURCE_ID || "configured_json_api", 80).toLowerCase();
  const source = getCollectorSource(sourceId, env);
  const permission = sourceCanCollect(source, { production: env.NODE_ENV === "production" });
  const requestedEvents = publicEvents(events);

  if (!source?.baseUrl) {
    return {
      ok: true,
      mode: "unconfigured",
      sourceId,
      records: [],
      normalized: normalizeContextBatch([], { events: requestedEvents, sourceId, env }),
      configuration: contextProviderConfiguration(env)
    };
  }
  if (!permission.allowed) {
    return {
      ok: true,
      mode: "blocked",
      reason: permission.reason,
      sourceId,
      records: [],
      normalized: normalizeContextBatch([], { events: requestedEvents, sourceId, env }),
      configuration: contextProviderConfiguration(env)
    };
  }
  if (!isHttps(source.baseUrl)) {
    return {
      ok: false,
      mode: "blocked",
      reason: "https-required",
      sourceId,
      records: [],
      normalized: normalizeContextBatch([], { events: requestedEvents, sourceId, env }),
      configuration: contextProviderConfiguration(env)
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Math.min(60_000, Number(options.timeoutMs || 25_000)));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const collectedAt = new Date().toISOString();

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
        version: "scorecaster-context-provider-contract-v1",
        requestedAt: collectedAt,
        paperOnly: true,
        context: {
          events: requestedEvents,
          categories: [
            "lineup", "injury", "suspension", "availability", "rest", "travel",
            "weather", "surface", "official"
          ],
          confirmationStates: ["confirmed", "probable", "unconfirmed", "rumor"],
          rawPayloadRequested: false
        }
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        mode: "error",
        reason: `provider-http-${response.status}`,
        sourceId,
        records: [],
        normalized: normalizeContextBatch([], { events: requestedEvents, sourceId, collectedAt, env }),
        configuration: contextProviderConfiguration(env)
      };
    }

    const records = Array.isArray(payload?.contextRecords)
      ? payload.contextRecords
      : Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
    const normalized = normalizeContextBatch(records, {
      events: requestedEvents,
      sourceId,
      collectedAt,
      env
    });

    return {
      ok: true,
      mode: "live",
      sourceId,
      received: records.length,
      records: normalized.accepted,
      normalized,
      configuration: contextProviderConfiguration(env),
      rawPayloadStored: false
    };
  } catch (error) {
    return {
      ok: false,
      mode: "error",
      reason: error?.name === "AbortError" ? "provider-timeout" : "provider-request-failed",
      sourceId,
      records: [],
      normalized: normalizeContextBatch([], { events: requestedEvents, sourceId, collectedAt, env }),
      configuration: contextProviderConfiguration(env)
    };
  } finally {
    clearTimeout(timer);
  }
}
