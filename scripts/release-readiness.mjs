import { access, readFile } from "node:fs/promises";
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

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function json(relativePath) {
  return JSON.parse(await text(relativePath));
}

async function anyExists(candidates) {
  for (const candidate of candidates) {
    if (await exists(candidate)) return true;
  }
  return false;
}

function pageCandidates(route) {
  const directory = route === "/" ? "app" : `app${route}`;
  return ["js", "jsx", "ts", "tsx"].map((extension) => `${directory}/page.${extension}`);
}

function apiCandidates(route) {
  const directory = `app${route}`;
  return ["js", "jsx", "ts", "tsx"].map((extension) => `${directory}/route.${extension}`);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const [manifest, nextConfig, mobileApp, mobilePackage, appleStore, googleStore] = await Promise.all([
  json("config/release-readiness.json"),
  text("next.config.js"),
  json("mobile/app.json"),
  json("mobile/package.json"),
  json("mobile/store.config.json"),
  json("mobile/store/google-play-listing.json")
]);

check(manifest.version === 1, "Release readiness manifest version must be 1");
check(manifest.product === "Scorecaster", "Release readiness manifest must target Scorecaster");
check(httpsUrl(manifest.productionBaseUrl), "Production base URL must use HTTPS");
check(manifest.productBoundary === "sports analysis, risk control and virtual paper tracking only", "Release manifest product boundary changed unexpectedly");

check(Array.isArray(manifest.publicPages) && manifest.publicPages.length >= 6, "Release manifest needs the required public pages");
check(unique(manifest.publicPages || []), "Release manifest contains duplicate public pages");
for (const route of manifest.publicPages || []) {
  check(await anyExists(pageCandidates(route)), `Public page ${route} is missing`);
}

const protectedApis = [...(manifest.protectedApis || []), ...(manifest.internalWorkers || [])];
check(protectedApis.length >= 10, "Release manifest needs protected API and worker probes");
check(unique(protectedApis.map((item) => `${item.method}:${item.path}`)), "Release manifest contains duplicate API probes");
for (const endpoint of protectedApis) {
  check(endpoint.path.startsWith("/api/"), `Protected endpoint ${endpoint.path} must be under /api`);
  check(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method), `Protected endpoint ${endpoint.path} uses an unsupported method`);
  check(Array.isArray(endpoint.allowedStatuses) && endpoint.allowedStatuses.every((status) => Number.isInteger(status) && status >= 400), `Protected endpoint ${endpoint.path} must fail closed without credentials`);
  check(await anyExists(apiCandidates(endpoint.path)), `API route ${endpoint.path} is missing`);
}

const migrations = manifest.supabaseMigrations || [];
check(migrations.length >= 16, "Release manifest must list the complete ordered Supabase rollout");
check(unique(migrations), "Release manifest contains duplicate migrations");
check(migrations[0] === "supabase/scorecaster_schema.sql", "Base schema must be the first migration");
check(migrations[1] === "supabase/scorecaster_auth_cloud.sql", "Cloud auth and RLS must follow the base schema");
const settlementIndex = migrations.indexOf("supabase/scorecaster_settlement_monitor.sql");
const autonomousV1Index = migrations.indexOf("supabase/scorecaster_autonomous_agent.sql");
const autonomousV2Index = migrations.indexOf("supabase/scorecaster_autonomous_agent_v2.sql");
const shadowLearningIndex = migrations.indexOf("supabase/scorecaster_shadow_learning_v1.sql");
check(settlementIndex >= 0, "Settlement Monitor migration must be listed");
check(autonomousV1Index === settlementIndex + 1, "Autonomous Agent V1 must run immediately after Settlement Monitor");
check(autonomousV2Index === autonomousV1Index + 1, "Autonomous Agent V2 must run immediately after V1");
check(shadowLearningIndex === autonomousV2Index + 1, "Shadow Learning must run immediately after Autonomous Agent V2");
check(shadowLearningIndex === migrations.length - 1, "Shadow Learning must be the final listed migration");
for (const migration of migrations) {
  check(/^supabase\/scorecaster_[a-z0-9_]+\.sql$/.test(migration), `Unexpected migration path ${migration}`);
  check(await exists(migration), `Migration ${migration} is missing`);
}

for (const [header, expected] of Object.entries(manifest.requiredSecurityHeaders || {})) {
  check(nextConfig.toLowerCase().includes(header.toLowerCase()), `Security header ${header} is missing from next.config.js`);
  check(nextConfig.includes(expected), `Security header ${header} no longer uses the reviewed value ${expected}`);
}
check(nextConfig.includes('source: "/api/:path*"'), "API no-store header scope is missing");
check(nextConfig.includes('value: "no-store, max-age=0"'), "API responses must remain no-store");

const expo = mobileApp.expo || {};
check(expo.extra?.realMoneyBetting === false, "Mobile product boundary must keep real-money betting disabled");
check(expo.version === mobilePackage.version, "Mobile app and package versions must match");
check(expo.ios?.bundleIdentifier === "com.vvglitchhub.scorecaster", "Unexpected iOS bundle identifier");
check(expo.android?.package === "com.vvglitchhub.scorecaster", "Unexpected Android package identifier");

const appleLocales = appleStore.apple?.info || {};
for (const locale of manifest.mobileLocales?.apple || []) {
  const entry = appleLocales[locale];
  check(Boolean(entry), `Apple metadata locale ${locale} is missing`);
  if (!entry) continue;
  check(String(entry.description || "").length >= 300, `Apple ${locale} description is too short`);
  for (const key of ["marketingUrl", "supportUrl", "privacyPolicyUrl"]) {
    check(httpsUrl(entry[key]), `Apple ${locale} ${key} must use HTTPS`);
    check(String(entry[key] || "").startsWith(manifest.productionBaseUrl), `Apple ${locale} ${key} must use the reviewed production origin`);
  }
}

const googleLocales = googleStore.localizations || {};
for (const locale of manifest.mobileLocales?.googlePlay || []) {
  const entry = googleLocales[locale];
  check(Boolean(entry), `Google Play metadata locale ${locale} is missing`);
  if (!entry) continue;
  check(String(entry.fullDescription || "").length >= 300, `Google Play ${locale} full description is too short`);
  check(String(entry.shortDescription || "").length > 0 && String(entry.shortDescription).length <= 80, `Google Play ${locale} short description is invalid`);
}
for (const key of ["supportUrl", "privacyPolicyUrl"]) {
  check(httpsUrl(googleStore[key]), `Google Play ${key} must use HTTPS`);
  check(String(googleStore[key] || "").startsWith(manifest.productionBaseUrl), `Google Play ${key} must use the reviewed production origin`);
}

for (const requiredFile of [
  "mobile/scripts/release-audit.mjs",
  "scripts/production-smoke.mjs",
  ".github/workflows/production-smoke.yml",
  "docs/RELEASE_READINESS_V1.md",
  "scripts/production-activation.mjs",
  "scripts/verify-production-schema.sql",
  ".github/workflows/production-activation.yml",
  "docs/PRODUCTION_ACTIVATION_V1.md",
  "docs/SHADOW_LEARNING_V1.md"
]) {
  check(await exists(requiredFile), `${requiredFile} is required for release verification`);
}

const serialized = JSON.stringify({ manifest, appleStore, googleStore });
check(!/example\.com/i.test(serialized), "Release metadata contains an example.com placeholder");
check(!/(SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET|OPENAI_API_KEY|expo_push_token)/.test(serialized), "Release metadata contains a server secret name or push token field");

for (const item of manifest.manualReleaseChecks || []) {
  check(Boolean(item.id && item.title), "Every manual release check needs an id and title");
  warn(item.blocking === false, `Manual release blocker remains: ${item.title}`);
}

if (failures.length) {
  console.error("\nScorecaster release readiness audit failed:\n");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Scorecaster repository release audit passed: ${migrations.length} migrations, ${manifest.publicPages.length} public pages and ${protectedApis.length} protected probes.`);
  if (warnings.length) {
    console.log("\nExternal verification still required:");
    warnings.forEach((message) => console.log(`- ${message}`));
  }
}
