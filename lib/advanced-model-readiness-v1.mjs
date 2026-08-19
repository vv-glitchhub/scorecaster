export const ADVANCED_MODEL_READINESS_VERSION = "scorecaster-advanced-model-readiness-v1";

const MODEL_SPECS = Object.freeze({
  ice_hockey: Object.freeze({ key: "nhl", modelId: "nhl-xg-goalie-poisson-v1", modelVersion: "nhl-xg-goalie-shadow-v1" }),
  soccer: Object.freeze({ key: "soccer", modelId: "soccer-xg-poisson-v1", modelVersion: "soccer-xg-poisson-shadow-v1" }),
  basketball: Object.freeze({ key: "basketball", modelId: "basketball-efficiency-pace-v1", modelVersion: "basketball-efficiency-shadow-v1" }),
  baseball: Object.freeze({ key: "baseball", modelId: "mlb-pitching-offense-v1", modelVersion: "mlb-pitching-offense-shadow-v1" })
});

const SAFE_PROVIDER_MODES = new Set([
  "live",
  "not-configured",
  "degraded",
  "unavailable",
  "blocked",
  "timeout",
  "rate-limited",
  "quota-exhausted",
  "unknown"
]);

function clean(value, limit = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function token(value, limit = 120) {
  return clean(value, limit)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, limit);
}

function boundedInteger(value, max = 1_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(max, Math.trunc(parsed)));
}

function iso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeReason(value) {
  const normalized = token(value, 140);
  return normalized && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : null;
}

function uniqueTokens(values = [], limit = 30) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => token(value, 140)).filter(Boolean))].slice(0, limit);
}

function safeProvider(provider = {}) {
  const rawMode = token(provider.mode, 60) || "unknown";
  return {
    configured: provider.configured === true,
    source: clean(provider.source, 100) || "external-sports-analytics",
    mode: SAFE_PROVIDER_MODES.has(rawMode) ? rawMode : "unknown",
    ok: provider.ok === true,
    observationCount: boundedInteger(provider.observationCount, 100_000) ?? 0
  };
}

function modelLineage(model = {}) {
  return {
    providers: uniqueTokens(model?.provenance?.providers, 10),
    metrics: uniqueTokens(model?.provenance?.metrics, 30)
  };
}

function inputSummary(model = {}) {
  const summary = model?.inputSummary && typeof model.inputSummary === "object" ? model.inputSummary : {};
  const output = {};
  for (const [key, value] of Object.entries(summary)) {
    const safeKey = token(key, 80);
    if (!safeKey) continue;
    if (typeof value === "boolean") output[safeKey] = value;
    else {
      const integer = boundedInteger(value, 100_000);
      if (integer !== null) output[safeKey] = integer;
    }
  }
  return output;
}

export function buildAdvancedModelReadinessV1({ sport, models = {}, externalProvider = {} } = {}) {
  const canonicalSport = token(sport, 80).replaceAll("-", "_");
  const spec = MODEL_SPECS[canonicalSport] || null;
  const provider = safeProvider(externalProvider);
  if (!spec) {
    return {
      version: ADVANCED_MODEL_READINESS_VERSION,
      sport: canonicalSport || "unknown",
      status: "not-applicable",
      modelId: null,
      modelVersion: null,
      blockers: ["unsupported-sport"],
      provider,
      inputSummary: {},
      lineage: { providers: [], metrics: [] },
      holdoutCaptureReady: false,
      independentProviderRequired: true,
      productionProbabilityChanged: false,
      productionDecisionChanged: false,
      automaticPromotionAllowed: false,
      paperOnly: true
    };
  }

  const model = models?.[spec.key] && typeof models[spec.key] === "object" ? models[spec.key] : {};
  const ready = model.status === "ready";
  const blockers = uniqueTokens((Array.isArray(model.reasons) ? model.reasons : []).map(safeReason).filter(Boolean), 20);
  if (!ready && !provider.configured) blockers.push("external-provider-not-configured");
  else if (!ready && provider.mode !== "live") blockers.push(`external-provider-${provider.mode}`);
  if (!ready && blockers.length === 0) blockers.push("model-inputs-unavailable");

  return {
    version: ADVANCED_MODEL_READINESS_VERSION,
    sport: canonicalSport,
    status: ready ? "ready" : "blocked",
    modelId: clean(model.modelId, 160) || spec.modelId,
    modelVersion: clean(model.modelVersion || model.version, 160) || spec.modelVersion,
    blockers: [...new Set(blockers)].slice(0, 20),
    provider,
    inputSummary: inputSummary(model),
    lineage: modelLineage(model),
    generatedAt: iso(model.generatedAt),
    predictionHorizon: iso(model.predictionHorizon),
    holdoutCaptureReady: ready,
    independentProviderRequired: true,
    productionProbabilityChanged: false,
    productionDecisionChanged: false,
    automaticPromotionAllowed: false,
    paperOnly: true
  };
}

function readinessFromSnapshot(snapshot = {}) {
  const summary = snapshot.raw_summary && typeof snapshot.raw_summary === "object"
    ? snapshot.raw_summary
    : snapshot.rawSummary && typeof snapshot.rawSummary === "object"
      ? snapshot.rawSummary
      : {};
  const readiness = summary.advancedModelReadiness && typeof summary.advancedModelReadiness === "object"
    ? summary.advancedModelReadiness
    : null;
  if (!readiness || readiness.version !== ADVANCED_MODEL_READINESS_VERSION) return null;
  return {
    eventId: clean(snapshot.event_id ?? snapshot.eventId, 180),
    capturedAt: iso(snapshot.captured_at ?? snapshot.capturedAt),
    sport: token(readiness.sport, 80).replaceAll("-", "_"),
    modelId: clean(readiness.modelId, 160),
    modelVersion: clean(readiness.modelVersion, 160),
    status: readiness.status === "ready" ? "ready" : readiness.status === "blocked" ? "blocked" : "not-applicable",
    blockers: uniqueTokens(readiness.blockers, 20),
    provider: safeProvider(readiness.provider)
  };
}

export function summarizeAdvancedModelReadinessSnapshotsV1(snapshotRows = []) {
  const latest = new Map();
  for (const snapshot of Array.isArray(snapshotRows) ? snapshotRows : []) {
    const row = readinessFromSnapshot(snapshot);
    if (!row || !row.eventId || !row.modelId) continue;
    const identity = `${row.eventId}|${row.modelVersion || row.modelId}`;
    const current = latest.get(identity);
    if (!current || Date.parse(row.capturedAt || 0) > Date.parse(current.capturedAt || 0)) latest.set(identity, row);
  }

  const rows = [...latest.values()];
  const blockerCounts = new Map();
  const modelGroups = new Map();
  for (const row of rows) {
    for (const blocker of row.blockers) blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1);
    const key = row.modelVersion || row.modelId;
    if (!modelGroups.has(key)) modelGroups.set(key, []);
    modelGroups.get(key).push(row);
  }

  const models = [...modelGroups.entries()].map(([modelVersion, modelRows]) => {
    const providerModes = new Map();
    const blockers = new Map();
    for (const row of modelRows) {
      const mode = row.provider.mode || "unknown";
      providerModes.set(mode, (providerModes.get(mode) || 0) + 1);
      for (const blocker of row.blockers) blockers.set(blocker, (blockers.get(blocker) || 0) + 1);
    }
    return {
      modelId: modelRows[0]?.modelId || null,
      modelVersion,
      sport: modelRows[0]?.sport || "unknown",
      events: modelRows.length,
      readyEvents: modelRows.filter((row) => row.status === "ready").length,
      blockedEvents: modelRows.filter((row) => row.status === "blocked").length,
      latestCapture: modelRows.map((row) => row.capturedAt).filter(Boolean).sort().at(-1) || null,
      providerModes: Object.fromEntries([...providerModes.entries()].sort((a, b) => b[1] - a[1])),
      topBlockers: [...blockers.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([reason, count]) => ({ reason, count })),
      holdoutCollectionStarted: modelRows.some((row) => row.status === "ready")
    };
  }).sort((a, b) => b.events - a.events || a.modelVersion.localeCompare(b.modelVersion));

  return {
    version: ADVANCED_MODEL_READINESS_VERSION,
    eventModelStates: rows.length,
    readyEvents: rows.filter((row) => row.status === "ready").length,
    blockedEvents: rows.filter((row) => row.status === "blocked").length,
    topBlockers: [...blockerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([reason, count]) => ({ reason, count })),
    models,
    holdoutCollectionStarted: rows.some((row) => row.status === "ready"),
    productionProbabilityChanged: false,
    automaticPromotionAllowed: false,
    paperOnly: true
  };
}

export const ADVANCED_MODEL_READINESS_POLICY = Object.freeze({
  modelSpecs: MODEL_SPECS,
  retainedRawProviderErrors: false,
  retainedCredentials: false,
  marketInputsAcceptedAsIndependentModelInputs: false,
  automaticPromotionAllowed: false,
  productionProbabilityChanged: false,
  paperOnly: true
});
