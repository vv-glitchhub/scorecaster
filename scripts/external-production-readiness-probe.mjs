import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_EVIDENCE_THRESHOLDS,
  PRODUCTION_EVIDENCE_VERSION
} from "../lib/production-evidence-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = String(process.env.PRODUCTION_EVIDENCE_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const days = Math.max(1, Math.min(180, Number.parseInt(process.env.PRODUCTION_EVIDENCE_DAYS || "30", 10) || 30));
const reportPath = process.env.EXTERNAL_PRODUCTION_READINESS_REPORT_PATH
  ? path.resolve(root, process.env.EXTERNAL_PRODUCTION_READINESS_REPORT_PATH)
  : null;

const clean = (value, maximum = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const boundedList = (value, maximum = 100) => Array.isArray(value)
  ? value.slice(0, maximum).map((item) => clean(item, 160)).filter(Boolean)
  : [];

let parsedBase;
try {
  parsedBase = new URL(baseUrl);
} catch {
  console.error("External production readiness probe requires a valid base URL.");
  process.exit(2);
}
if (parsedBase.protocol !== "https:" || parsedBase.host !== "scorecaster.vercel.app") {
  console.error(`External production readiness probe refuses non-production host: ${parsedBase.host || "missing"}`);
  process.exit(2);
}

const url = new URL("/api/production-evidence", `${baseUrl}/`);
url.searchParams.set("days", String(days));
const response = await fetch(url, {
  method: "GET",
  cache: "no-store",
  redirect: "error",
  headers: {
    Accept: "application/json",
    "User-Agent": "Scorecaster-External-Production-Evidence/1.0"
  }
});

const failures = [];
const contentType = clean(response.headers.get("content-type"), 120).toLowerCase();
const cacheControl = clean(response.headers.get("cache-control"), 180).toLowerCase();
const ageRaw = response.headers.get("age");
const ageSeconds = ageRaw !== null && /^\d+$/.test(ageRaw) ? Number(ageRaw) : null;
const vercelCache = clean(response.headers.get("x-vercel-cache"), 32).toUpperCase() || null;
if (response.status !== 200) failures.push(`http-status-not-200:${response.status}`);
if (!contentType.includes("application/json")) failures.push("content-type-not-json");
if (!cacheControl.includes("no-store")) failures.push("cache-control-missing-no-store");
if (ageSeconds !== null && ageSeconds !== 0) failures.push("age-not-zero");
if (["HIT", "STALE"].includes(vercelCache || "")) failures.push(`api-cache-state-forbidden:${vercelCache}`);

let payload = null;
try {
  payload = await response.json();
} catch {
  failures.push("response-json-invalid");
}

if (payload?.version !== PRODUCTION_EVIDENCE_VERSION) failures.push("production-evidence-version-mismatch");
if (payload?.ok !== true) failures.push("production-evidence-not-ok");
if (!["ready", "degraded", "blocked"].includes(payload?.releaseState)) failures.push("release-state-invalid");
if (payload?.windowDays !== days) failures.push("window-days-mismatch");
if (payload?.ready !== (payload?.releaseState === "ready")) failures.push("ready-flag-inconsistent");
if (payload?.safety?.paperOnly !== true) failures.push("paper-only-boundary-invalid");
if (payload?.safety?.realMoneyExecution !== false) failures.push("real-money-boundary-invalid");
if (payload?.safety?.bookmakerCredentials !== false) failures.push("bookmaker-credential-boundary-invalid");
if (payload?.safety?.probabilityChanged !== false) failures.push("probability-change-boundary-invalid");
if (payload?.safety?.automaticPlayUpgrade !== false) failures.push("automatic-play-boundary-invalid");
if (payload?.safety?.rawProviderPayloadsExposed !== false) failures.push("raw-provider-payload-boundary-invalid");
if (payload?.safety?.userIdentifiersExposed !== false) failures.push("user-identifier-boundary-invalid");
if (payload?.safety?.closingLineUsedForPregameDecision !== false) failures.push("closing-line-decision-boundary-invalid");

const thresholds = payload?.thresholds && typeof payload.thresholds === "object" ? payload.thresholds : {};
for (const [key, expected] of Object.entries(PRODUCTION_EVIDENCE_THRESHOLDS)) {
  if (finite(thresholds[key]) !== expected) failures.push(`threshold-mismatch:${key}`);
}

const worker = payload?.worker && typeof payload.worker === "object" ? payload.worker : {};
const summary = payload?.summary && typeof payload.summary === "object" ? payload.summary : {};
const leagues = Array.isArray(payload?.leagues) ? payload.leagues : [];
const providers = Array.isArray(payload?.providers) ? payload.providers : [];
const dataAvailability = payload?.dataAvailability && typeof payload.dataAvailability === "object" ? payload.dataAvailability : {};

const providerStates = {
  enabled: providers.filter((item) => item?.state === "enabled").length,
  degraded: providers.filter((item) => item?.state === "degraded").length,
  disabled: providers.filter((item) => item?.state === "disabled").length
};

const report = {
  version: "scorecaster-external-production-readiness-probe-v1",
  observedAt: new Date().toISOString(),
  source: {
    host: parsedBase.host,
    path: "/api/production-evidence",
    days,
    httpStatus: response.status,
    contentType,
    cacheControl,
    ageSeconds,
    vercelCache
  },
  productionEvidenceVersion: clean(payload?.version, 120) || null,
  releaseState: clean(payload?.releaseState, 32) || null,
  ready: payload?.ready === true,
  blockers: boundedList(payload?.blockers, 40),
  summary: {
    leagues: finite(summary.leagues),
    enabledLeagues: finite(summary.enabledLeagues),
    degradedLeagues: finite(summary.degradedLeagues),
    disabledLeagues: finite(summary.disabledLeagues),
    events: finite(summary.events),
    verifiedFixtureIdentityRate: finite(summary.verifiedFixtureIdentityRate),
    multiProviderEventRate: finite(summary.multiProviderEventRate),
    closingEligibleEvents: finite(summary.closingEligibleEvents),
    closingEvents: finite(summary.closingEvents),
    closingLineCoverage: finite(summary.closingLineCoverage),
    providerCount: finite(summary.providerCount),
    averageProviderAvailability: finite(summary.averageProviderAvailability),
    activeIncidents: finite(summary.activeIncidents)
  },
  worker: {
    state: clean(worker.state, 24) || null,
    cycles: finite(worker.cycles),
    observedCycles: finite(worker.observedCycles),
    successes: finite(worker.successes),
    partial: finite(worker.partial),
    failed: finite(worker.failed),
    successRate: finite(worker.successRate),
    latestStatus: clean(worker.latestStatus, 32) || null,
    latestAt: clean(worker.latestAt, 64) || null,
    latestAgeMinutes: finite(worker.latestAgeMinutes),
    denominator: finite(worker.denominator),
    target: finite(worker.target),
    enoughCycles: worker.enoughCycles === true,
    fresh: worker.fresh === true
  },
  providerStates,
  leagues: leagues.slice(0, 100).map((league) => ({
    sport: clean(league?.sport, 80) || "unknown",
    league: clean(league?.league, 120) || "unknown",
    state: clean(league?.state, 24) || "unknown",
    score: finite(league?.score),
    events: finite(league?.events),
    verifiedIdentityRate: finite(league?.verifiedIdentityRate),
    multiProviderRate: finite(league?.multiProviderRate),
    averageProviderCount: finite(league?.averageProviderCount),
    averageProviderDisagreement: finite(league?.averageProviderDisagreement),
    averageCoverageScore: finite(league?.averageCoverageScore),
    latestAgeMinutes: finite(league?.latestAgeMinutes),
    closingEligibleEvents: finite(league?.closingEligibleEvents),
    closingEvents: finite(league?.closingEvents),
    closingLineCoverage: finite(league?.closingLineCoverage),
    activeIncidents: finite(league?.activeIncidents),
    reasons: boundedList(league?.reasons, 30),
    denominators: {
      identity: finite(league?.denominators?.identity),
      multiProvider: finite(league?.denominators?.multiProvider),
      closingLine: finite(league?.denominators?.closingLine)
    }
  })),
  dataAvailability: {
    snapshots: dataAvailability.snapshots === true,
    providerObservations: dataAvailability.providerObservations === true,
    closingRecords: dataAvailability.closingRecords === true,
    incidents: dataAvailability.incidents === true,
    collectorRuns: dataAvailability.collectorRuns === true,
    unavailableSources: boundedList(dataAvailability.unavailableSources, 20)
  },
  thresholds: { ...PRODUCTION_EVIDENCE_THRESHOLDS },
  safety: {
    paperOnly: true,
    realMoneyExecution: false,
    credentialsSent: false,
    userIdentifiersRetained: false,
    rawProviderPayloadsRetained: false,
    responseBodyRetained: false
  },
  structuralPassed: failures.length === 0,
  failures: [...new Set(failures)].sort()
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  releaseState: report.releaseState,
  ready: report.ready,
  blockers: report.blockers,
  summary: report.summary,
  worker: report.worker,
  providerStates: report.providerStates,
  leagueStates: report.leagues.map((league) => ({ league: league.league, state: league.state, score: league.score, events: league.events, reasons: league.reasons })),
  dataAvailability: report.dataAvailability,
  structuralPassed: report.structuralPassed,
  failures: report.failures
}, null, 2));

if (failures.length) {
  console.error("Scorecaster external production readiness probe failed structural/safety validation:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster external production readiness probe completed: releaseState=${report.releaseState}, leagues=${report.summary.leagues ?? "unknown"}, worker=${report.worker.state || "unknown"}.`);
}
