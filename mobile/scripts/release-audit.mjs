import { readFile, readdir, stat } from "node:fs/promises";
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

const [appConfig, eas, packageJson, appleStore, googleStore] = await Promise.all([
  json("app.json"),
  json("eas.json"),
  json("package.json"),
  json("store.config.json"),
  json("store/google-play-listing.json")
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

const authScreen = await readFile(path.join(root, "src/screens/AuthScreen.tsx"), "utf8");
const appSource = await readFile(path.join(root, "src/App.tsx"), "utf8");
const authHandler = await readFile(path.join(root, "src/lib/auth-deep-link.ts"), "utf8");
check(/emailRedirectTo:\s*authRedirectUrl/.test(authScreen), "Email signup must set the native redirect URL");
check(/Linking\.getInitialURL\(\)/.test(appSource), "App must process a cold-start auth link");
check(/Linking\.addEventListener\("url"/.test(appSource), "App must process auth links while running");
check(/exchangeCodeForSession\(code\)/.test(authHandler), "PKCE auth code exchange is missing");
check(/setSession\(/.test(authHandler), "Legacy token callback fallback is missing");

const scannedFiles = [
  "app.json",
  "eas.json",
  "store.config.json",
  "store/google-play-listing.json",
  ...await filesUnder("src")
].filter((file) => /\.(json|js|jsx|mjs|ts|tsx)$/.test(file));
const forbiddenSecrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ODDS_API_KEY",
  "AGENT_DECISION_SIGNING_KEY",
  "OPENAI_API_KEY",
  "NEWS_API_KEY",
  "SPORTSDATA_API_KEY",
  "LINEUP_API_KEY"
];

for (const file of scannedFiles) {
  const content = await readFile(path.join(root, file), "utf8");
  for (const secret of forbiddenSecrets) {
    check(!content.includes(secret), `${file} contains forbidden server-only key name ${secret}`);
  }
  check(!/https?:\/\/example\.com/i.test(content), `${file} contains an example.com placeholder`);
}

warn(Boolean(expo.extra?.eas?.projectId), "EAS project ID is not linked yet; run eas init with the correct Expo account");
warn(Boolean(expo.icon), "Final 1024x1024 store icon has not been committed");
warn(Boolean(expo.splash), "Final native splash asset has not been committed");

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
