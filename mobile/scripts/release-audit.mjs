import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function semver(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || ""));
}

async function filesUnder(relativePath) {
  const absolute = path.join(root, relativePath);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const child = path.join(absolute, entry.name);
    const relative = path.relative(root, child);
    if (entry.isDirectory()) files.push(...await filesUnder(relative));
    else if (entry.isFile()) files.push(relative);
  }

  return files;
}

const [appConfig, eas, packageJson, appleStore, googleStore, releaseBlockers, physicalMatrix, reviewerInstructions] = await Promise.all([
  json("app.json"),
  json("eas.json"),
  json("package.json"),
  json("store.config.json"),
  json("store/google-play-listing.json"),
  json("store/release-blockers.json"),
  json("store/physical-device-test-matrix.json"),
  json("store/reviewer-instructions.json")
]);

const expo = appConfig.expo || {};
check(expo.name === "Scorecaster", "Expo display name must remain Scorecaster");
check(expo.slug === "scorecaster", "Expo slug must remain scorecaster");
check(semver(expo.version), "Expo user-facing version must be semantic x.y.z");
check(expo.version === packageJson.version, "app.json and mobile/package.json versions must match");
check(expo.scheme === "scorecaster", "Native auth callback scheme must be scorecaster");
check(expo.orientation === "portrait", "Release scope is portrait-only until landscape is tested");
check(expo.ios?.bundleIdentifier === "com.vvglitchhub.scorecaster", "Unexpected iOS bundle identifier");
check(expo.android?.package === "com.vvglitchhub.scorecaster", "Unexpected Android package identifier");
check(expo.ios?.supportsTablet === false, "iPad support must remain disabled until tablet testing is complete");
check(expo.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, "App Store encryption declaration is missing");
check(expo.ios?.privacyManifests?.NSPrivacyTracking === false, "iOS privacy manifest must declare tracking false");
check(Array.isArray(expo.ios?.privacyManifests?.NSPrivacyTrackingDomains) && expo.ios.privacyManifests.NSPrivacyTrackingDomains.length === 0, "iOS tracking-domain list must be empty");
check(expo.extra?.realMoneyBetting === false, "Mobile product boundary must keep real-money betting disabled");
check(expo.extra?.authRedirectUrl === "scorecaster://auth/confirm", "App config auth redirect does not match the native handler");

const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
check(plugins.some((entry) => Array.isArray(entry) && entry[0] === "expo-notifications" && entry[1]?.defaultChannel === "scorecaster-alerts"), "expo-notifications plugin and default Scorecaster channel are required");
check(packageJson.dependencies?.["expo-notifications"] === "~56.0.20", "expo-notifications must match the reviewed SDK 56 version");
check(packageJson.dependencies?.["expo-constants"] === "~56.0.20", "expo-constants must match the reviewed SDK 56 version");

check(eas.cli?.appVersionSource === "remote", "EAS must use remote developer-facing versions");
check(eas.cli?.requireCommit === true, "EAS builds must require committed source");
check(eas.build?.preview?.distribution === "internal", "Preview builds must use internal distribution");
check(eas.build?.preview?.android?.buildType === "apk", "Android preview must produce an installable APK");
check(eas.build?.production?.autoIncrement === true, "Production build numbers must auto-increment");
check(eas.build?.production?.android?.buildType === "app-bundle", "Android production must produce an App Bundle");
check(eas.submit?.production?.android?.track === "internal", "Google Play submissions must default to the internal track");
check(eas.submit?.production?.android?.releaseStatus === "draft", "Google Play internal submission must remain a draft");
check(eas.submit?.production?.ios?.metadataPath === "./store.config.json", "Apple submission must use the repository metadata file");

const appleLocales = appleStore.apple?.info || {};
for (const locale of ["fi", "en-US", "es-ES"]) {
  const value = appleLocales[locale];
  check(Boolean(value), `Missing Apple localization ${locale}`);
  if (!value) continue;
  check(String(value.title || "").length > 0 && String(value.title).length <= 30, `Apple ${locale} title must be 1-30 characters`);
  check(String(value.subtitle || "").length > 0 && String(value.subtitle).length <= 30, `Apple ${locale} subtitle must be 1-30 characters`);
  check(String(value.description || "").length >= 300, `Apple ${locale} description is too short`);
  check(Array.isArray(value.keywords) && value.keywords.length >= 3, `Apple ${locale} needs at least three keywords`);
  check(String(value.promoText || "").length <= 170, `Apple ${locale} promo text exceeds 170 characters`);
  check(httpsUrl(value.marketingUrl), `Apple ${locale} marketing URL must use HTTPS`);
  check(httpsUrl(value.supportUrl), `Apple ${locale} support URL must use HTTPS`);
  check(httpsUrl(value.privacyPolicyUrl), `Apple ${locale} privacy URL must use HTTPS`);
}

const googleLocales = googleStore.localizations || {};
for (const locale of ["fi-FI", "en-US", "es-ES"]) {
  const value = googleLocales[locale];
  check(Boolean(value), `Missing Google Play localization ${locale}`);
  if (!value) continue;
  check(String(value.title || "").length > 0 && String(value.title).length <= 30, `Google Play ${locale} title must be 1-30 characters`);
  check(String(value.shortDescription || "").length > 0 && String(value.shortDescription).length <= 80, `Google Play ${locale} short description must be 1-80 characters`);
  check(String(value.fullDescription || "").length >= 300, `Google Play ${locale} full description is too short`);
  check(String(value.releaseNotes || "").length > 0 && String(value.releaseNotes).length <= 500, `Google Play ${locale} release notes must be 1-500 characters`);
}
check(httpsUrl(googleStore.supportUrl), "Google Play support URL must use HTTPS");
check(httpsUrl(googleStore.privacyPolicyUrl), "Google Play privacy URL must use HTTPS");

check(releaseBlockers.schemaVersion === 1, "Release blocker schema must stay on reviewed V1 until migrated explicitly");
check(Array.isArray(releaseBlockers.externalBlockers) && releaseBlockers.externalBlockers.length >= 8, "External mobile release blocker registry is incomplete");
check(releaseBlockers.externalBlockers.filter((item) => item.required !== false).every((item) => item.completed === false || item.completed === true), "External blocker completion must be explicit boolean evidence");

const requiredPlatforms = new Set(["ios", "android"]);
const requiredLocales = new Set(["fi", "en", "es"]);
check(physicalMatrix.schemaVersion === 1, "Physical-device matrix schema must remain V1 until explicitly migrated");
check(new Set(physicalMatrix.requiredPlatforms || []).size === requiredPlatforms.size && [...requiredPlatforms].every((item) => physicalMatrix.requiredPlatforms?.includes(item)), "Physical-device matrix must require iOS and Android");
check(new Set(physicalMatrix.requiredLocales || []).size === requiredLocales.size && [...requiredLocales].every((item) => physicalMatrix.requiredLocales?.includes(item)), "Physical-device matrix must require FI EN ES");
const matrixKeys = (physicalMatrix.matrix || []).map((item) => `${item.platform}:${item.locale}`);
check(matrixKeys.length === 6 && new Set(matrixKeys).size === 6, "Physical-device matrix must contain exactly six unique platform-language cells");
for (const platform of requiredPlatforms) {
  for (const locale of requiredLocales) check(matrixKeys.includes(`${platform}:${locale}`), `Physical-device matrix is missing ${platform}:${locale}`);
}
for (const flow of ["sign-in", "paper-save", "paper-settlement-refresh", "account-export", "account-deletion-on-disposable-account", "expired-session-fail-closed"]) {
  check(physicalMatrix.criticalFlows?.includes(flow), `Physical-device matrix is missing critical flow ${flow}`);
}
for (const notificationCheck of ["foreground-notification", "background-notification", "cold-start-notification-deep-link", "notification-disabled-fail-closed"]) {
  check(physicalMatrix.notificationChecks?.includes(notificationCheck), `Physical-device matrix is missing notification check ${notificationCheck}`);
}
check(physicalMatrix.evidenceRules?.rawAccessTokensAllowed === false, "Physical-device evidence must never contain raw access tokens");
check(physicalMatrix.evidenceRules?.passwordsAllowed === false, "Physical-device evidence must never contain passwords");
check(physicalMatrix.evidenceRules?.pushTokensAllowed === false, "Physical-device evidence must never contain push tokens");
check(physicalMatrix.evidenceRules?.deviceIdentifiersAllowed === false, "Physical-device evidence must not contain persistent device identifiers");

check(reviewerInstructions.schemaVersion === 1, "Reviewer instruction package schema must remain V1 until explicitly migrated");
check(reviewerInstructions.productBoundary?.realMoneyBetting === false, "Reviewer package must state that real-money betting is disabled");
check(reviewerInstructions.productBoundary?.depositsWithdrawals === false, "Reviewer package must state that deposits and withdrawals are absent");
check(reviewerInstructions.reviewAccount?.credentialsStoredInRepository === false, "Reviewer credentials must never be stored in the repository");
check(reviewerInstructions.reviewAccount?.credentialsStoredInReleaseArtifacts === false, "Reviewer credentials must never be stored in release artifacts");
check(reviewerInstructions.reviewAccount?.credentialsMustBeEnteredOnlyInStoreDashboard === true, "Reviewer credentials must be supplied only through store dashboards");
for (const url of Object.values(reviewerInstructions.publicUrls || {})) check(httpsUrl(url), "Reviewer public URLs must use HTTPS");

const authScreen = await readFile(path.join(root, "src/screens/AuthScreen.tsx"), "utf8");
const appSource = await readFile(path.join(root, "src/App.tsx"), "utf8");
const authHandler = await readFile(path.join(root, "src/lib/auth-deep-link.ts"), "utf8");
const notificationSource = await readFile(path.join(root, "src/lib/notifications.ts"), "utf8");
check(/emailRedirectTo:\s*authRedirectUrl/.test(authScreen), "Email signup must set the native redirect URL");
check(/Linking\.getInitialURL\(\)/.test(appSource), "App must process a cold-start auth link");
check(/Linking\.addEventListener\("url"/.test(appSource), "App must process auth links while running");
check(/exchangeCodeForSession\(code\)/.test(authHandler), "PKCE auth code exchange is missing");
check(/setSession\(/.test(authHandler), "Legacy token callback fallback is missing");
check(/requestPermissionsAsync/.test(notificationSource), "Native notification permission request is missing");
check(/getExpoPushTokenAsync\(\{ projectId: easProjectId \}\)/.test(notificationSource), "Expo push token must use the EAS project ID");
check(/The EAS project ID is not configured/.test(notificationSource), "Missing EAS project ID must fail closed");
check(!/registerNotificationDevice\(\).*useEffect/s.test(notificationSource), "Push registration must not run automatically");

const scannedFiles = [
  "app.json",
  "eas.json",
  "store.config.json",
  "store/google-play-listing.json",
  "store/release-blockers.json",
  "store/physical-device-test-matrix.json",
  "store/reviewer-instructions.json",
  ...await filesUnder("src")
].filter((file) => /\.(json|js|jsx|mjs|ts|tsx)$/.test(file));
const forbiddenSecrets = [
  ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
  ["ODDS", "API", "KEY"].join("_"),
  ["AGENT", "DECISION", "SIGNING", "KEY"].join("_"),
  ["OPENAI", "API", "KEY"].join("_"),
  ["NEWS", "API", "KEY"].join("_"),
  ["SPORTSDATA", "API", "KEY"].join("_"),
  ["LINEUP", "API", "KEY"].join("_")
];

for (const file of scannedFiles) {
  const content = await readFile(path.join(root, file), "utf8");
  for (const secret of forbiddenSecrets) {
    check(!content.includes(secret), `${file} contains forbidden server-only key name ${secret}`);
  }
  check(!/https?:\/\/example\.com/i.test(content), `${file} contains an example.com placeholder`);
}

warn(Boolean(expo.extra?.eas?.projectId), "EAS project ID is not linked yet; run eas init with the correct Expo account before push registration or store builds");
warn(Boolean(expo.icon), "Final 1024x1024 store icon has not been committed");
warn(Boolean(expo.splash), "Final native splash asset has not been committed");
warn(releaseBlockers.externalBlockers.filter((item) => item.required !== false).every((item) => item.completed === true), "External mobile release blockers remain incomplete; repository readiness is not signed-build or physical-device proof");
warn((physicalMatrix.matrix || []).every((item) => item.status === "passed"), "Physical-device FI EN ES matrix is not complete yet");
warn(reviewerInstructions.reviewAccount?.configured === true, "Synthetic store reviewer account is not configured yet; credentials must stay outside GitHub");

if (failures.length) {
  console.error("\nMobile release audit failed:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  if (warnings.length) {
    console.error("\nExternal or asset warnings:\n");
    warnings.forEach((message) => console.error(`- ${message}`));
  }
  process.exitCode = 1;
} else {
  console.log("Mobile repository release checks passed.");
  if (warnings.length) {
    console.log("\nRemaining external or asset warnings:");
    warnings.forEach((message) => console.log(`- ${message}`));
  }
}
