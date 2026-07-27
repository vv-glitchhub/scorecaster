function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoTime(value) {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : null;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(number(value) * factor) / factor;
}

function average(values = []) {
  const valid = values.map((value) => Number(value)).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function grade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  return "E";
}

function freshnessScore(ageMinutes) {
  if (!Number.isFinite(ageMinutes)) return 0;
  if (ageMinutes <= 45) return 100;
  if (ageMinutes <= 90) return 85;
  if (ageMinutes <= 180) return 65;
  if (ageMinutes <= 360) return 40;
  if (ageMinutes <= 1440) return 20;
  return 0;
}

export function buildCollectorTimeSeries(records = [], { bucketMinutes = 60 } = {}) {
  const bucketMs = Math.max(5, Math.min(1440, Number(bucketMinutes) || 60)) * 60_000;
  const buckets = new Map();
  for (const record of records) {
    const time = isoTime(record.collectedAt || record.collected_at || record.observedAt || record.observed_at);
    if (time === null) continue;
    const bucket = Math.floor(time / bucketMs) * bucketMs;
    const current = buckets.get(bucket) || { timestamp: new Date(bucket).toISOString(), records: 0, events: new Set(), sources: new Set(), metrics: new Set() };
    current.records += 1;
    if (record.eventId || record.event_id) current.events.add(record.eventId || record.event_id);
    if (record.sourceId || record.source_id) current.sources.add(record.sourceId || record.source_id);
    if (record.metric) current.metrics.add(record.metric);
    buckets.set(bucket, current);
  }
  return [...buckets.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((bucket) => ({
    timestamp: bucket.timestamp,
    records: bucket.records,
    events: bucket.events.size,
    sources: bucket.sources.size,
    metrics: bucket.metrics.size
  }));
}

export function buildCollectorSourceQuality(records = [], { now = Date.now() } = {}) {
  const groups = new Map();
  for (const record of records) {
    const sourceId = String(record.sourceId || record.source_id || "unknown");
    const group = groups.get(sourceId) || { sourceId, rows: [], events: new Set(), sports: new Set(), metrics: new Set(), latestTime: null };
    group.rows.push(record);
    if (record.eventId || record.event_id) group.events.add(record.eventId || record.event_id);
    if (record.sport) group.sports.add(record.sport);
    if (record.metric) group.metrics.add(record.metric);
    const time = isoTime(record.collectedAt || record.collected_at || record.observedAt || record.observed_at);
    if (time !== null && (group.latestTime === null || time > group.latestTime)) group.latestTime = time;
    groups.set(sourceId, group);
  }

  return [...groups.values()].map((group) => {
    const ageMinutes = group.latestTime === null ? null : Math.max(0, Math.round((now - group.latestTime) / 60_000));
    const trust = average(group.rows.map((row) => row.sourceTrust ?? row.source_trust));
    const confidence = average(group.rows.map((row) => row.confidence));
    const completeness = average(group.rows.map((row) => {
      const fields = [row.eventId || row.event_id, row.sport, row.metric, row.observedAt || row.observed_at, row.collectedAt || row.collected_at];
      return fields.filter(Boolean).length / fields.length;
    }));
    const fresh = freshnessScore(ageMinutes);
    const score = round(fresh * 0.35 + trust * 100 * 0.25 + confidence * 100 * 0.2 + completeness * 100 * 0.2, 1);
    return {
      sourceId: group.sourceId,
      score,
      grade: grade(score),
      status: ageMinutes === null || ageMinutes > 360 ? "stale" : ageMinutes > 90 ? "aging" : "fresh",
      ageMinutes,
      records: group.rows.length,
      events: group.events.size,
      sports: group.sports.size,
      metrics: group.metrics.size,
      trust: round(trust),
      confidence: round(confidence),
      completeness: round(completeness),
      latestAt: group.latestTime === null ? null : new Date(group.latestTime).toISOString()
    };
  }).sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId));
}

export function buildCollectorCoverage(records = []) {
  const sports = new Map();
  const events = new Set();
  const sources = new Set();
  const metrics = new Set();
  for (const record of records) {
    const sport = String(record.sport || "unknown");
    const current = sports.get(sport) || { sport, records: 0, events: new Set(), sources: new Set(), metrics: new Set(), latestAt: null };
    current.records += 1;
    const eventId = record.eventId || record.event_id;
    const sourceId = record.sourceId || record.source_id;
    const time = isoTime(record.collectedAt || record.collected_at || record.observedAt || record.observed_at);
    if (eventId) { current.events.add(eventId); events.add(eventId); }
    if (sourceId) { current.sources.add(sourceId); sources.add(sourceId); }
    if (record.metric) { current.metrics.add(record.metric); metrics.add(record.metric); }
    if (time !== null && (!current.latestAt || time > current.latestAt)) current.latestAt = time;
    sports.set(sport, current);
  }
  return {
    totals: { records: records.length, events: events.size, sources: sources.size, metrics: metrics.size, sports: sports.size },
    sports: [...sports.values()].map((item) => ({
      sport: item.sport,
      records: item.records,
      events: item.events.size,
      sources: item.sources.size,
      metrics: item.metrics.size,
      latestAt: item.latestAt ? new Date(item.latestAt).toISOString() : null
    })).sort((a, b) => b.records - a.records || a.sport.localeCompare(b.sport))
  };
}

export function buildCollectorEventSummaries(records = [], { limit = 50 } = {}) {
  const groups = new Map();
  for (const record of records) {
    const eventId = String(record.eventId || record.event_id || "");
    if (!eventId) continue;
    const group = groups.get(eventId) || { eventId, sport: record.sport || "unknown", league: record.league || null, records: 0, sources: new Set(), metrics: new Set(), latestTime: null, latestMetrics: new Map() };
    group.records += 1;
    if (record.sourceId || record.source_id) group.sources.add(record.sourceId || record.source_id);
    if (record.metric) group.metrics.add(record.metric);
    const time = isoTime(record.observedAt || record.observed_at || record.collectedAt || record.collected_at);
    if (time !== null && (group.latestTime === null || time > group.latestTime)) group.latestTime = time;
    const previous = group.latestMetrics.get(record.metric);
    if (!previous || (time ?? 0) >= (previous.time ?? 0)) group.latestMetrics.set(record.metric, { time, value: record.value ?? null, unit: record.unit || null, sourceId: record.sourceId || record.source_id || null });
    groups.set(eventId, group);
  }
  return [...groups.values()].sort((a, b) => (b.latestTime || 0) - (a.latestTime || 0)).slice(0, Math.max(1, Math.min(200, Number(limit) || 50))).map((group) => ({
    eventId: group.eventId,
    sport: group.sport,
    league: group.league,
    records: group.records,
    sources: group.sources.size,
    metrics: group.metrics.size,
    latestAt: group.latestTime === null ? null : new Date(group.latestTime).toISOString(),
    latestMetrics: Object.fromEntries([...group.latestMetrics.entries()].map(([metric, value]) => [metric, { value: value.value, unit: value.unit, sourceId: value.sourceId }]))
  }));
}

export function detectCollectorIncidents({ records = [], sourceQuality = [], coverage = null, now = Date.now() } = {}) {
  const incidents = [];
  if (!records.length) incidents.push({ severity: "critical", code: "no-records", title: "Collector has no publishable observations", detail: "Run the migration and protected collector worker before relying on the data layer." });
  const latest = records.reduce((max, record) => Math.max(max, isoTime(record.collectedAt || record.collected_at || record.observedAt || record.observed_at) || 0), 0);
  const ageMinutes = latest ? Math.max(0, Math.round((now - latest) / 60_000)) : null;
  if (ageMinutes !== null && ageMinutes > 180) incidents.push({ severity: "critical", code: "capture-stale", title: "Collector capture is stale", detail: `Latest publishable observation is ${ageMinutes} minutes old.` });
  else if (ageMinutes !== null && ageMinutes > 90) incidents.push({ severity: "warning", code: "capture-aging", title: "Collector capture is aging", detail: `Latest publishable observation is ${ageMinutes} minutes old.` });
  for (const source of sourceQuality) {
    if (source.status === "stale") incidents.push({ severity: "warning", code: `source-stale:${source.sourceId}`, title: `${source.sourceId} is stale`, detail: `Latest source observation is ${source.ageMinutes ?? "unknown"} minutes old.` });
    if (source.trust < 0.5) incidents.push({ severity: "warning", code: `source-low-trust:${source.sourceId}`, title: `${source.sourceId} trust is low`, detail: `Average source trust is ${round(source.trust * 100, 1)}%.` });
    if (source.confidence < 0.5) incidents.push({ severity: "warning", code: `source-low-confidence:${source.sourceId}`, title: `${source.sourceId} confidence is low`, detail: `Average confidence is ${round(source.confidence * 100, 1)}%.` });
  }
  if (coverage?.totals?.sources === 1 && records.length >= 20) incidents.push({ severity: "info", code: "single-source", title: "Coverage depends on one source", detail: "A second licensed source would improve disagreement detection and resilience." });
  return incidents.slice(0, 30);
}

export function buildCollectorInsights(records = [], options = {}) {
  const sourceQuality = buildCollectorSourceQuality(records, options);
  const coverage = buildCollectorCoverage(records);
  const timeSeries = buildCollectorTimeSeries(records, options);
  const events = buildCollectorEventSummaries(records, options);
  const incidents = detectCollectorIncidents({ records, sourceQuality, coverage, now: options.now });
  return {
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    coverage,
    sourceQuality,
    timeSeries,
    events,
    incidents,
    safety: { publishableOnly: true, researchDataExcluded: true, paperOnly: true, probabilityChanged: false }
  };
}
