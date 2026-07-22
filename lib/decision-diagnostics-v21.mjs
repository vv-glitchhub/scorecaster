function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function rate(count, total) {
  const safeTotal = Math.max(0, finite(total));
  return safeTotal > 0 ? Math.max(0, finite(count)) / safeTotal : 0;
}

function snapshotPoint(item = {}) {
  const total = Math.max(0, finite(item.total));
  const counts = item.counts || {};
  const capturedAt = item.capturedAt || item.captured_at || null;
  return {
    id: item.id || capturedAt || null,
    capturedAt,
    total,
    playRate: rate(counts.PLAY ?? item.play_count, total),
    cautionRate: rate(counts.CAUTION ?? item.caution_count, total),
    skipRate: rate(counts.SKIP ?? item.skip_count, total),
    staleRate: finite(item.staleRate ?? item.stale_rate ?? item.dataQuality?.staleRate),
    averageBookmakers: item.averageBookmakers ?? item.average_bookmakers ?? item.dataQuality?.averageBookmakers ?? null,
    averageConfidence: item.averageConfidence ?? item.average_confidence ?? item.dataQuality?.averageConfidence ?? null,
    providerScore: finite(item.providerHealth?.score ?? item.provider_health?.score),
    providerStatus: item.providerHealth?.status || item.provider_health?.status || "unknown",
    status: item.status || "unknown"
  };
}

function windowSummary(points = []) {
  return {
    snapshots: points.length,
    playRate: average(points.map((point) => point.playRate)) ?? 0,
    cautionRate: average(points.map((point) => point.cautionRate)) ?? 0,
    skipRate: average(points.map((point) => point.skipRate)) ?? 0,
    staleRate: average(points.map((point) => point.staleRate)) ?? 0,
    averageBookmakers: average(points.map((point) => point.averageBookmakers)),
    averageConfidence: average(points.map((point) => point.averageConfidence)),
    providerScore: average(points.map((point) => point.providerScore)) ?? 0
  };
}

function trendDirection(delta, tolerance, lowerIsBetter = false) {
  if (Math.abs(delta) <= tolerance) return "stable";
  const improving = lowerIsBetter ? delta < 0 : delta > 0;
  return improving ? "improving" : "worsening";
}

export function summarizeDiagnosticTrends(items = [], options = {}) {
  const windowSize = Math.max(3, Math.min(24, Math.trunc(finite(options.windowSize, 6))));
  const unique = new Map();
  for (const item of items) {
    const point = snapshotPoint(item);
    const timestamp = Date.parse(point.capturedAt || "");
    if (!Number.isFinite(timestamp)) continue;
    unique.set(point.capturedAt, point);
  }
  const points = [...unique.values()].sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));
  const currentWindow = points.slice(-windowSize);
  const previousWindow = points.slice(-(windowSize * 2), -windowSize);
  const current = windowSummary(currentWindow);
  const previous = windowSummary(previousWindow);
  const deltas = {
    playRate: current.playRate - previous.playRate,
    skipRate: current.skipRate - previous.skipRate,
    staleRate: current.staleRate - previous.staleRate,
    providerScore: current.providerScore - previous.providerScore,
    averageBookmakers: current.averageBookmakers === null || previous.averageBookmakers === null ? null : current.averageBookmakers - previous.averageBookmakers
  };

  let noPlayStreak = 0;
  let allSkipStreak = 0;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.total > 0 && point.playRate === 0) noPlayStreak += 1;
    else break;
  }
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.total > 0 && point.skipRate === 1) allSkipStreak += 1;
    else break;
  }

  const directions = {
    playRate: trendDirection(deltas.playRate, 0.02),
    skipRate: trendDirection(deltas.skipRate, 0.03, true),
    staleRate: trendDirection(deltas.staleRate, 0.03, true),
    providerScore: trendDirection(deltas.providerScore, 3),
    averageBookmakers: deltas.averageBookmakers === null ? "unknown" : trendDirection(deltas.averageBookmakers, 0.25)
  };
  const worseningSignals = Object.values(directions).filter((value) => value === "worsening").length;
  const improvingSignals = Object.values(directions).filter((value) => value === "improving").length;
  const status = points.length < Math.max(3, windowSize)
    ? "insufficient-history"
    : worseningSignals >= 3 || allSkipStreak >= 2
      ? "worsening"
      : improvingSignals >= 3
        ? "improving"
        : "stable";

  return {
    version: "diagnostic-trends-v1",
    status,
    sampleSize: points.length,
    windowSize,
    current,
    previous,
    deltas,
    directions,
    noPlayStreak,
    allSkipStreak,
    points: points.slice(-48)
  };
}

const PROVIDER_CAUSES = Object.freeze({
  "provider-unavailable": {
    category: "availability",
    severity: "high",
    title: "Provider feed is unavailable",
    action: "Verify provider credentials, quota, upstream status and the live odds request path."
  },
  "low-fixture-acceptance": {
    category: "coverage",
    severity: "high",
    title: "Too few provider fixtures pass validation",
    action: "Inspect excluded fixture reasons, league keys, start times and market completeness."
  },
  "stale-market-data": {
    category: "freshness",
    severity: "high",
    title: "Market timestamps are stale",
    action: "Compare provider update timestamps, cache headers and refresh cadence before changing decision thresholds."
  },
  "weak-bookmaker-coverage": {
    category: "bookmakers",
    severity: "medium",
    title: "Bookmaker coverage is too narrow",
    action: "Check region and market parameters and whether provider quota is truncating bookmaker sources."
  },
  "low-market-confidence": {
    category: "agreement",
    severity: "medium",
    title: "Market confidence is low",
    action: "Inspect price disagreement, outliers and source count before treating this as a model problem."
  }
});

export function diagnoseProviderRootCauses(provider = {}, current = {}) {
  const causes = (provider.reasons || []).map((code) => ({
    code,
    ...(PROVIDER_CAUSES[code] || {
      category: "unknown",
      severity: "medium",
      title: code,
      action: "Inspect provider diagnostics and recent snapshots."
    })
  }));
  const degradedLeagues = (provider.leagues || [])
    .filter((league) => league.status === "degraded")
    .sort((left, right) => finite(right.staleRate) - finite(left.staleRate))
    .slice(0, 8)
    .map((league) => ({
      league: league.league,
      staleRate: finite(league.staleRate),
      averageBookmakers: league.averageBookmakers === null ? null : finite(league.averageBookmakers),
      total: finite(league.total)
    }));

  let classification = "healthy";
  if (provider.status === "down") classification = "provider-outage";
  else if (provider.status === "degraded") classification = "provider-degradation";
  else if (["blocked", "watch"].includes(current.status)) classification = "decision-gates-or-model";

  return {
    version: "provider-root-cause-v1",
    classification,
    primaryCause: causes[0] || null,
    causes,
    degradedLeagues,
    evidence: {
      providerStatus: provider.status || "unknown",
      providerScore: finite(provider.score),
      coverageRate: finite(provider.coverageRate),
      staleRate: finite(provider.staleRate),
      averageBookmakers: provider.averageBookmakers ?? null,
      averageConfidence: provider.averageConfidence ?? null,
      decisionStatus: current.status || "unknown"
    },
    recommendation: causes[0]?.action || (classification === "decision-gates-or-model"
      ? "Provider data is healthy. Inspect decision reasons, evidence readiness and model calibration before changing thresholds."
      : "No provider intervention is currently indicated.")
  };
}

export function buildDiagnosticReport(payload = {}) {
  return {
    version: "scorecaster-diagnostic-report-v1",
    exportedAt: new Date().toISOString(),
    generatedAt: payload.generatedAt || null,
    paperOnly: true,
    current: payload.current || null,
    trends: payload.trends || null,
    providerHealth: payload.providerHealth || null,
    providerDiagnosis: payload.providerDiagnosis || null,
    alerts: payload.alerts || null,
    history: payload.history || null,
    outcomes: payload.outcomes || null,
    simulator: payload.simulator || null,
    productionThresholds: payload.productionThresholds || null,
    disclaimer: payload.disclaimer || "Diagnostics are descriptive and do not change production decisions."
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function diagnosticReportCsv(report = {}) {
  const rows = [["section", "captured_at", "status", "total", "play", "caution", "skip", "stale_rate", "provider_score", "details"]];
  const current = report.current || {};
  rows.push([
    "current",
    current.capturedAt || report.generatedAt,
    current.status,
    current.total,
    current.counts?.PLAY,
    current.counts?.CAUTION,
    current.counts?.SKIP,
    current.dataQuality?.staleRate,
    report.providerHealth?.score,
    report.providerDiagnosis?.classification
  ]);
  for (const item of report.history?.items || []) {
    rows.push([
      "history",
      item.capturedAt,
      item.status,
      item.total,
      item.counts?.PLAY,
      item.counts?.CAUTION,
      item.counts?.SKIP,
      item.staleRate,
      item.providerHealth?.score,
      item.reasons
    ]);
  }
  for (const alert of report.alerts?.stored || report.alerts?.live || []) {
    rows.push(["alert", alert.last_seen_at || alert.detectedAt, alert.active === false ? "resolved" : "active", "", "", "", "", "", "", `${alert.alert_type || alert.alertType}: ${alert.title}`]);
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
