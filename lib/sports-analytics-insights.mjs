function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 4) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function clean(value, limit = 160) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function average(values = []) {
  const valid = values.map(finite).filter((value) => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function latestByEvent(rows = []) {
  const latest = new Map();
  for (const row of rows) {
    const id = clean(row.event_id || row.eventId, 180);
    const at = timestamp(row.captured_at || row.capturedAt);
    if (!id || at === null) continue;
    const current = latest.get(id);
    if (!current || at > current.at) latest.set(id, { at, row });
  }
  return [...latest.values()].map((item) => item.row);
}

function observationTime(row = {}) {
  return timestamp(row.capturedAt || row.captured_at || row.observedAt || row.observed_at);
}

export function buildMetricTimeSeries(observations = [], { maxSeries = 12, maxPoints = 48 } = {}) {
  const groups = new Map();
  for (const row of observations || []) {
    const value = finite(row.value);
    const at = observationTime(row);
    const metric = clean(row.metric, 120);
    const sport = clean(row.canonicalSport || row.canonical_sport || row.sportKey || row.sport_key, 60);
    if (value === null || at === null || !metric) continue;
    const key = `${sport}:${metric}`;
    if (!groups.has(key)) groups.set(key, { key, sport, metric, family: clean(row.family, 50), unit: clean(row.unit, 40), points: new Map(), providers: new Set(), events: new Set() });
    const group = groups.get(key);
    const bucket = new Date(Math.floor(at / 1_800_000) * 1_800_000).toISOString();
    if (!group.points.has(bucket)) group.points.set(bucket, []);
    group.points.get(bucket).push(value);
    if (row.provider) group.providers.add(clean(row.provider, 80));
    if (row.eventId || row.event_id) group.events.add(clean(row.eventId || row.event_id, 180));
  }

  return [...groups.values()].map((group) => {
    const points = [...group.points.entries()]
      .map(([at, values]) => ({ at, value: round(average(values)), samples: values.length, minimum: round(Math.min(...values)), maximum: round(Math.max(...values)) }))
      .sort((a, b) => timestamp(a.at) - timestamp(b.at))
      .slice(-maxPoints);
    const first = points[0]?.value ?? null;
    const latest = points.at(-1)?.value ?? null;
    return {
      key: group.key,
      sport: group.sport,
      metric: group.metric,
      family: group.family,
      unit: group.unit,
      points,
      samples: points.reduce((sum, point) => sum + point.samples, 0),
      events: group.events.size,
      providers: group.providers.size,
      first,
      latest,
      absoluteChange: first === null || latest === null ? null : round(latest - first),
      relativeChange: first === null || latest === null || first === 0 ? null : round((latest - first) / Math.abs(first))
    };
  }).filter((row) => row.points.length >= 1)
    .sort((a, b) => b.points.length - a.points.length || b.samples - a.samples)
    .slice(0, maxSeries);
}

export function buildProviderQualitySummary(observations = [], { now = Date.now() } = {}) {
  const groups = new Map();
  for (const row of observations || []) {
    const provider = clean(row.provider || "unknown", 80) || "unknown";
    if (!groups.has(provider)) groups.set(provider, { provider, rows: 0, trust: [], confidence: [], latestAt: null, metrics: new Set(), sports: new Set(), events: new Set() });
    const group = groups.get(provider);
    group.rows += 1;
    const trust = finite(row.sourceTrust ?? row.source_trust);
    const confidence = finite(row.confidence);
    if (trust !== null) group.trust.push(clamp(trust, 0, 1));
    if (confidence !== null) group.confidence.push(clamp(confidence, 0, 1));
    const at = observationTime(row);
    if (at !== null && (group.latestAt === null || at > group.latestAt)) group.latestAt = at;
    if (row.metric) group.metrics.add(clean(row.metric, 120));
    if (row.canonicalSport || row.canonical_sport) group.sports.add(clean(row.canonicalSport || row.canonical_sport, 60));
    if (row.eventId || row.event_id) group.events.add(clean(row.eventId || row.event_id, 180));
  }

  return [...groups.values()].map((group) => {
    const trust = average(group.trust) ?? 0;
    const confidence = average(group.confidence) ?? 0;
    const ageMinutes = group.latestAt === null ? null : Math.max(0, (now - group.latestAt) / 60_000);
    const freshnessScore = ageMinutes === null ? 0 : Math.exp(-ageMinutes / 180);
    const score = clamp(trust * 0.35 + confidence * 0.35 + freshnessScore * 0.2 + Math.min(1, group.rows / 100) * 0.1, 0, 1);
    return {
      provider: group.provider,
      observations: group.rows,
      events: group.events.size,
      metrics: group.metrics.size,
      sports: group.sports.size,
      averageTrust: round(trust),
      averageConfidence: round(confidence),
      latestAt: group.latestAt === null ? null : new Date(group.latestAt).toISOString(),
      ageMinutes: ageMinutes === null ? null : round(ageMinutes, 1),
      score: round(score),
      grade: score >= 0.85 ? "A" : score >= 0.7 ? "B" : score >= 0.5 ? "C" : score >= 0.3 ? "D" : "E",
      status: ageMinutes === null ? "unknown" : ageMinutes <= 90 ? "fresh" : ageMinutes <= 360 ? "aging" : "stale"
    };
  }).sort((a, b) => b.score - a.score || b.observations - a.observations);
}

export function buildParticipantMetricLeaders(observations = [], { maxMetrics = 8, maxParticipants = 8 } = {}) {
  const metrics = new Map();
  for (const row of observations || []) {
    const participantId = clean(row.participantId || row.participant_id, 120);
    const metric = clean(row.metric, 120);
    const value = finite(row.value);
    if (!participantId || !metric || value === null) continue;
    const metricKey = `${clean(row.canonicalSport || row.canonical_sport, 60)}:${metric}`;
    if (!metrics.has(metricKey)) metrics.set(metricKey, { sport: clean(row.canonicalSport || row.canonical_sport, 60), metric, family: clean(row.family, 50), unit: clean(row.unit, 40), participants: new Map() });
    const metricGroup = metrics.get(metricKey);
    if (!metricGroup.participants.has(participantId)) metricGroup.participants.set(participantId, { participantId, values: [], latestAt: null, providers: new Set(), events: new Set() });
    const participant = metricGroup.participants.get(participantId);
    participant.values.push(value);
    const at = observationTime(row);
    if (at !== null && (participant.latestAt === null || at > participant.latestAt)) participant.latestAt = at;
    if (row.provider) participant.providers.add(clean(row.provider, 80));
    if (row.eventId || row.event_id) participant.events.add(clean(row.eventId || row.event_id, 180));
  }

  return [...metrics.values()].map((metric) => ({
    sport: metric.sport,
    metric: metric.metric,
    family: metric.family,
    unit: metric.unit,
    participants: [...metric.participants.values()].map((participant) => ({
      participantId: participant.participantId,
      samples: participant.values.length,
      average: round(average(participant.values)),
      minimum: round(Math.min(...participant.values)),
      maximum: round(Math.max(...participant.values)),
      latestAt: participant.latestAt === null ? null : new Date(participant.latestAt).toISOString(),
      providers: participant.providers.size,
      events: participant.events.size
    })).sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity)).slice(0, maxParticipants)
  })).filter((metric) => metric.participants.length >= 2)
    .sort((a, b) => b.participants.reduce((sum, row) => sum + row.samples, 0) - a.participants.reduce((sum, row) => sum + row.samples, 0))
    .slice(0, maxMetrics);
}

export function buildEventAnalyticsDrilldowns(snapshots = [], observations = [], { maxEvents = 30 } = {}) {
  const latest = latestByEvent(snapshots).slice(0, maxEvents);
  const observationsByEvent = new Map();
  for (const row of observations || []) {
    const id = clean(row.eventId || row.event_id, 180);
    if (!id) continue;
    if (!observationsByEvent.has(id)) observationsByEvent.set(id, []);
    observationsByEvent.get(id).push(row);
  }
  return latest.map((snapshot) => {
    const id = clean(snapshot.event_id || snapshot.eventId, 180);
    const rows = observationsByEvent.get(id) || [];
    const latestMetric = new Map();
    for (const row of rows) {
      const key = `${clean(row.participantId || row.participant_id, 120)}:${clean(row.metric, 120)}`;
      const at = observationTime(row) ?? 0;
      const current = latestMetric.get(key);
      if (!current || at > current.at) latestMetric.set(key, { at, row });
    }
    const metrics = [...latestMetric.values()].map(({ row }) => ({
      participantId: clean(row.participantId || row.participant_id, 120),
      family: clean(row.family, 50),
      metric: clean(row.metric, 120),
      value: finite(row.value),
      unit: clean(row.unit, 40),
      provider: clean(row.provider, 80),
      confidence: round(clamp(finite(row.confidence) ?? 0, 0, 1)),
      sourceTrust: round(clamp(finite(row.sourceTrust ?? row.source_trust) ?? 0, 0, 1)),
      observedAt: row.observedAt || row.observed_at || null
    })).sort((a, b) => a.family.localeCompare(b.family) || a.metric.localeCompare(b.metric));
    return {
      eventId: id,
      sport: clean(snapshot.canonical_sport || snapshot.canonicalSport, 60),
      league: clean(snapshot.league, 140),
      match: clean(snapshot.match, 240),
      capturedAt: snapshot.captured_at || snapshot.capturedAt || null,
      commenceTime: snapshot.commence_time || snapshot.commenceTime || null,
      observationCount: Number(snapshot.observation_count ?? snapshot.observationCount ?? rows.length),
      providerCount: Number(snapshot.provider_count ?? snapshot.providerCount ?? 0),
      coverageScore: round(snapshot.coverage_score ?? snapshot.coverageScore ?? 0),
      availableMetrics: snapshot.available_metrics || snapshot.availableMetrics || [],
      missingMetrics: snapshot.missing_metrics || snapshot.missingMetrics || [],
      familyCoverage: snapshot.family_coverage || snapshot.familyCoverage || [],
      metrics: metrics.slice(0, 120)
    };
  });
}

export function detectSportsAnalyticsIncidents(snapshots = [], providerQuality = [], { now = Date.now() } = {}) {
  const incidents = [];
  const latest = latestByEvent(snapshots);
  if (!latest.length) {
    incidents.push({ id: "no-events", severity: "info", type: "coverage", title: "No analytics events", message: "No verified events have produced an analytics snapshot yet." });
    return incidents;
  }

  const latestCapture = latest.map((row) => timestamp(row.captured_at || row.capturedAt)).filter((value) => value !== null).sort((a, b) => b - a)[0] ?? null;
  if (latestCapture !== null) {
    const ageMinutes = Math.max(0, (now - latestCapture) / 60_000);
    if (ageMinutes > 120) incidents.push({ id: "capture-stale", severity: ageMinutes > 360 ? "critical" : "warning", type: "freshness", title: "Automatic capture is stale", message: `The latest analytics snapshot is ${Math.round(ageMinutes)} minutes old.`, ageMinutes: round(ageMinutes, 1) });
  }

  const lowCoverage = latest.filter((row) => Number(row.coverage_score ?? row.coverageScore ?? 0) < 0.08);
  if (lowCoverage.length) incidents.push({ id: "low-advanced-coverage", severity: "info", type: "coverage", title: "Advanced metric coverage is limited", message: `${lowCoverage.length} current event(s) have less than 8% catalogue coverage. This is expected until sport-specific providers are configured.`, eventCount: lowCoverage.length });

  for (const provider of providerQuality) {
    if (provider.status === "stale") incidents.push({ id: `provider-stale:${provider.provider}`, severity: "warning", type: "provider", title: `${provider.provider} is stale`, message: `Latest observation is ${Math.round(provider.ageMinutes || 0)} minutes old.`, provider: provider.provider });
    if (provider.observations >= 5 && provider.averageTrust < 0.45) incidents.push({ id: `provider-trust:${provider.provider}`, severity: "warning", type: "quality", title: `${provider.provider} trust is low`, message: `Average source trust is ${Math.round(provider.averageTrust * 100)}%.`, provider: provider.provider });
  }

  return incidents.slice(0, 30);
}

export function buildSportsAnalyticsInsights({ snapshots = [], observations = [], now = Date.now() } = {}) {
  const providers = buildProviderQualitySummary(observations, { now });
  return {
    generatedAt: new Date(now).toISOString(),
    metricSeries: buildMetricTimeSeries(observations),
    providerQuality: providers,
    leaderboards: buildParticipantMetricLeaders(observations),
    events: buildEventAnalyticsDrilldowns(snapshots, observations),
    incidents: detectSportsAnalyticsIncidents(snapshots, providers, { now })
  };
}
