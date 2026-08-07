import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const requireComplete = args.has("--require-complete");
const repositoryAuditPassed = args.has("--repository-audit-passed");
const reportPath = path.resolve(root, process.env.MOBILE_RELEASE_EVIDENCE_REPORT_PATH || "artifacts/mobile-release-evidence.json");
const signedAuditPath = path.resolve(root, process.env.MOBILE_SIGNED_BUNDLE_REPORT_PATH || "artifacts/signed-bundle-audit.json");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function optionalJson(absolutePath) {
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) return null;
    return JSON.parse(await readFile(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

const [appConfig, eas, blockers, matrix, signedAudit] = await Promise.all([
  json("app.json"),
  json("eas.json"),
  json("store/release-blockers.json"),
  json("store/physical-device-test-matrix.json"),
  optionalJson(signedAuditPath)
]);

const expo = appConfig.expo || {};
const requiredFlows = new Set(matrix.criticalFlows || []);
const requiredAccessibility = new Set(matrix.accessibilityChecks || []);
const requiredNotifications = new Set(matrix.notificationChecks || []);
const expectedCells = new Set((matrix.requiredPlatforms || []).flatMap((platform) => (matrix.requiredLocales || []).map((locale) => `${platform}:${locale}`)));
const cells = Array.isArray(matrix.matrix) ? matrix.matrix : [];

function containsAll(actual, required) {
  const have = new Set(actual || []);
  return [...required].every((item) => have.has(item));
}

function cellComplete(cell) {
  return cell?.status === "passed"
    && Boolean(cell.buildReference)
    && Boolean(cell.deviceClass)
    && Boolean(cell.osVersion)
    && Boolean(cell.completedAt)
    && containsAll(cell.criticalFlowsPassed, requiredFlows)
    && containsAll(cell.accessibilityChecksPassed, requiredAccessibility)
    && containsAll(cell.notificationChecksPassed, requiredNotifications)
    && Array.isArray(cell.evidenceReferences)
    && cell.evidenceReferences.length > 0
    && (!Array.isArray(cell.blockers) || cell.blockers.length === 0);
}

const matrixKeys = cells.map((cell) => `${cell.platform}:${cell.locale}`);
const matrixStructureValid = matrixKeys.length === expectedCells.size
  && new Set(matrixKeys).size === expectedCells.size
  && [...expectedCells].every((key) => matrixKeys.includes(key));
const completeCells = cells.filter(cellComplete);
const deviceMatrixComplete = matrixStructureValid && completeCells.length === expectedCells.size;

const requiredExternalBlockers = (blockers.externalBlockers || []).filter((item) => item.required !== false);
const externalBlockersComplete = requiredExternalBlockers.length > 0 && requiredExternalBlockers.every((item) => item.completed === true);
const unresolvedExternalBlockers = requiredExternalBlockers.filter((item) => item.completed !== true).map((item) => item.id);

const signedIosPassed = signedAudit?.iosArtifactPassed === true;
const signedAndroidPassed = signedAudit?.androidArtifactPassed === true;
const signedBundlesComplete = signedAudit?.status === "passed" && signedIosPassed && signedAndroidPassed;

const easLinked = Boolean(expo.extra?.eas?.projectId);
const productionProfilesConfigured = eas.build?.production?.autoIncrement === true
  && eas.build?.production?.android?.buildType === "app-bundle"
  && eas.submit?.production?.android?.track === "internal"
  && eas.submit?.production?.android?.releaseStatus === "draft";
const metadataConfigured = eas.submit?.production?.ios?.metadataPath === "./store.config.json";

const repositoryBoundary = {
  repositoryAuditPassed,
  appVersion: expo.version || null,
  iosBundleIdentifier: expo.ios?.bundleIdentifier || null,
  androidPackage: expo.android?.package || null,
  productMode: expo.extra?.productMode || null,
  realMoneyBetting: expo.extra?.realMoneyBetting === true,
  easProjectLinked: easLinked,
  productionProfilesConfigured,
  metadataConfigured,
  signedBundleAuditToolConfigured: true,
  physicalDeviceMatrixConfigured: matrixStructureValid
};

const repositoryReady = repositoryAuditPassed
  && repositoryBoundary.realMoneyBetting === false
  && productionProfilesConfigured
  && metadataConfigured
  && matrixStructureValid;
const internalBetaEvidenceComplete = repositoryReady
  && easLinked
  && signedBundlesComplete
  && deviceMatrixComplete
  && externalBlockersComplete;

const blockersList = [];
if (!repositoryAuditPassed) blockersList.push("repository-release-audit-not-attested-for-this-report");
if (!easLinked) blockersList.push("eas-project-not-linked");
if (!signedBundlesComplete) blockersList.push("signed-ios-and-android-bundle-audit-incomplete");
if (!deviceMatrixComplete) blockersList.push("physical-device-fi-en-es-matrix-incomplete");
blockersList.push(...unresolvedExternalBlockers.map((id) => `external:${id}`));

const report = {
  version: "scorecaster-mobile-release-evidence-v2",
  generatedAt: new Date().toISOString(),
  status: internalBetaEvidenceComplete ? "internal-beta-evidence-complete" : repositoryReady ? "repository-ready-external-evidence-required" : "repository-evidence-incomplete",
  repository: repositoryBoundary,
  signedBundles: signedAudit ? {
    reportVersion: signedAudit.version || null,
    status: signedAudit.status || null,
    iosPassed: signedIosPassed,
    androidPassed: signedAndroidPassed,
    bothPlatformsPassed: signedBundlesComplete,
    artifactCount: Array.isArray(signedAudit.artifactReports) ? signedAudit.artifactReports.length : 0,
    reportReference: path.relative(root, signedAuditPath).replaceAll("\\", "/")
  } : {
    status: "unverified",
    iosPassed: false,
    androidPassed: false,
    bothPlatformsPassed: false,
    artifactCount: 0,
    reportReference: null
  },
  physicalDevices: {
    matrixSchemaVersion: matrix.schemaVersion,
    matrixStructureValid,
    requiredCellCount: expectedCells.size,
    completedCellCount: completeCells.length,
    complete: deviceMatrixComplete,
    requiredLocales: matrix.requiredLocales,
    requiredPlatforms: matrix.requiredPlatforms,
    evidenceContainsSyntheticTestDataOnly: matrix.evidenceRules?.screenshotsMayContainSyntheticTestDataOnly === true
  },
  external: {
    requiredBlockerCount: requiredExternalBlockers.length,
    completedBlockerCount: requiredExternalBlockers.filter((item) => item.completed === true).length,
    complete: externalBlockersComplete,
    unresolved: unresolvedExternalBlockers
  },
  gates: {
    repositoryReady,
    easLinked,
    signedBundlesComplete,
    deviceMatrixComplete,
    externalBlockersComplete,
    internalBetaEvidenceComplete,
    publicStoreSubmissionAllowed: false
  },
  blockers: [...new Set(blockersList)],
  releaseEvidenceFragment: {
    gateId: "signed-mobile-internal-beta",
    status: internalBetaEvidenceComplete ? "passed" : "unverified",
    reason: internalBetaEvidenceComplete ? "signed-ios-android-and-physical-device-evidence-complete" : "external-or-physical-mobile-evidence-incomplete"
  },
  safety: {
    rawAccessTokensIncluded: false,
    sessionCookiesIncluded: false,
    passwordsIncluded: false,
    pushTokensIncluded: false,
    signingCredentialsIncluded: false,
    serverSecretValuesIncluded: false,
    bookmakerCredentialsIncluded: false,
    depositsWithdrawalsSupported: false,
    realMoneyExecution: false,
    paperOnly: true
  }
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (requireComplete && !internalBetaEvidenceComplete) {
  console.error("Mobile internal-beta evidence is incomplete.");
  report.blockers.forEach((blocker) => console.error(`- ${blocker}`));
  process.exitCode = 1;
} else {
  console.log(`Mobile release evidence: ${report.status}.`);
  if (!internalBetaEvidenceComplete) console.log("Repository CI does not count missing signed builds, store accounts, or physical-device tests as passed.");
}
