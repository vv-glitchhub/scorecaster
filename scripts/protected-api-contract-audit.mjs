import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "config/release-readiness.json"), "utf8"));
const reportPath = process.env.PROTECTED_API_CONTRACT_REPORT_PATH
  ? path.resolve(root, process.env.PROTECTED_API_CONTRACT_REPORT_PATH)
  : null;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
const fingerprint = (value) => sha256(JSON.stringify(stable(value)));

function routeFile(apiPath) {
  return path.join(root, "app", ...apiPath.split("/").filter(Boolean), "route.js");
}

function relativeRouteFile(apiPath) {
  return path.relative(root, routeFile(apiPath)).replaceAll("\\", "/");
}

function firstIndex(text, patterns) {
  const indexes = patterns.map((pattern) => text.search(pattern)).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

function localRequireAuthContract(source) {
  const start = source.search(/async\s+function\s+requireAuth\s*\(/);
  if (start < 0) return { present: false, failClosed: false };
  const remainder = source.slice(start + 1);
  const nextFunction = remainder.search(/\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/);
  const end = nextFunction >= 0 ? start + 1 + nextFunction : Math.min(source.length, start + 1800);
  const helper = source.slice(start, end);
  const authenticatedContext = /getAuthenticatedContext\s*\(\s*request\s*\)/.test(helper);
  const failClosed = /if\s*\(\s*!auth\.ok\s*\)/.test(helper)
    && /jsonResponse\s*\(/.test(helper)
    && /auth\.status/.test(helper);
  return { present: authenticatedContext, failClosed };
}

const protectedApis = Array.isArray(manifest.protectedApis) ? manifest.protectedApis : [];
const apis = [];
const failures = [];
const implementationEntries = [];

for (const api of protectedApis) {
  const file = routeFile(api.path);
  const relativeFile = relativeRouteFile(api.path);
  let source = "";
  try {
    source = await readFile(file, "utf8");
  } catch {
    const failure = `${api.path}: route file is missing (${relativeFile})`;
    failures.push(failure);
    apis.push({ path: api.path, method: api.method, file: relativeFile, passed: false, failures: [failure] });
    implementationEntries.push({ path: api.path, method: api.method, allowedStatuses: api.allowedStatuses, file: relativeFile, sourceSha256: null });
    continue;
  }

  const sourceSha256 = sha256(source);
  implementationEntries.push({
    path: api.path,
    method: api.method,
    allowedStatuses: api.allowedStatuses,
    file: relativeFile,
    sourceSha256
  });

  const handlerIndex = source.indexOf(`export async function ${api.method}`);
  const handler = handlerIndex >= 0 ? source.slice(handlerIndex) : "";
  const apiFailures = [];
  const localWrapper = localRequireAuthContract(source);
  const directAuthIndex = firstIndex(handler, [
    /getAuthenticatedContext\s*\(\s*request\s*\)/,
    /getAuthenticatedUser\s*\(\s*request\s*\)/
  ]);
  const wrapperCallIndex = localWrapper.present && localWrapper.failClosed
    ? handler.search(/await\s+requireAuth\s*\(\s*request\s*,/)
    : -1;
  const authContextIndex = directAuthIndex >= 0 ? directAuthIndex : wrapperCallIndex;
  const directFailureIndex = firstIndex(handler, [
    /if\s*\(\s*!auth\.ok\s*\)\s*return/,
    /if\s*\(\s*!authentication\.ok\s*\)\s*return/,
    /if\s*\(\s*!user\s*\)\s*return/
  ]);
  const wrapperFailureIndex = wrapperCallIndex >= 0 ? firstIndex(handler, [
    /if\s*\(\s*auth\.error\s*\)\s*return\s+auth\.error/,
    /if\s*\(\s*guarded\.response\s*\)\s*return\s+guarded\.response/
  ]) : -1;
  const authFailureIndex = directFailureIndex >= 0 ? directFailureIndex : wrapperFailureIndex;
  const protectedActionIndex = firstIndex(handler, [
    /\.from\s*\(/,
    /getSupabaseAdmin(?:Client)?\s*\(/,
    /await\s+run[A-Z][A-Za-z0-9_]*\s*\(/,
    /await\s+fetch\s*\(/
  ]);
  const usesNoStoreResponse = /jsonResponse\s*\(/.test(handler)
    || /["']Cache-Control["']\s*:\s*["'][^"']*no-store/i.test(source);
  const authBeforeProtectedAction = authContextIndex >= 0
    && authFailureIndex >= authContextIndex
    && (protectedActionIndex < 0 || authFailureIndex < protectedActionIndex);

  if (handlerIndex < 0) apiFailures.push(`missing exported ${api.method} handler`);
  if (authContextIndex < 0) apiFailures.push("missing authenticated-context guard");
  if (wrapperCallIndex >= 0 && (!localWrapper.present || !localWrapper.failClosed)) apiFailures.push("local requireAuth wrapper is not fail-closed through getAuthenticatedContext");
  if (authFailureIndex < 0) apiFailures.push("missing fail-closed unauthenticated return");
  if (!authBeforeProtectedAction) apiFailures.push("authentication guard is not visibly before protected data/action access");
  if (!usesNoStoreResponse) apiFailures.push("protected API does not visibly use the no-store response path");
  if (!Array.isArray(api.allowedStatuses) || !api.allowedStatuses.every((status) => [401, 403].includes(Number(status)))) {
    apiFailures.push("manifest unauthenticated status set is outside 401/403");
  }

  failures.push(...apiFailures.map((failure) => `${api.path}: ${failure}`));
  apis.push({
    path: api.path,
    method: api.method,
    file: relativeFile,
    sourceSha256,
    expectedUnauthenticatedStatuses: api.allowedStatuses,
    authMode: directAuthIndex >= 0 ? "direct-context" : wrapperCallIndex >= 0 ? "local-require-auth-wrapper" : "missing",
    authenticatedContextGuard: authContextIndex >= 0,
    failClosedUnauthenticatedReturn: authFailureIndex >= 0,
    authBeforeProtectedAction,
    noStoreResponsePath: usesNoStoreResponse,
    passed: apiFailures.length === 0,
    failures: apiFailures
  });
}

const implementationIdentity = { version: 1, protectedApis: implementationEntries };
const implementationFingerprint = fingerprint(implementationIdentity);
const report = {
  version: "scorecaster-protected-api-contract-v1",
  generatedAt: new Date().toISOString(),
  implementationFingerprint,
  implementationIdentity,
  apiCount: apis.length,
  passedApis: apis.filter((api) => api.passed).length,
  failedApis: apis.filter((api) => !api.passed).length,
  passed: failures.length === 0,
  apis,
  safety: {
    staticOnly: true,
    sessionCredentialRead: false,
    bearerTokenRead: false,
    protectedApiInvoked: false,
    userDataRead: false,
    realMoneyExecution: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (failures.length) {
  console.error("Scorecaster protected-API contract audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Protected API implementation fingerprint: ${implementationFingerprint}`);
  process.exitCode = 1;
} else {
  console.log(`Scorecaster protected-API contract audit passed: ${apis.length}/${apis.length} declared APIs fail closed before visible protected data/actions.`);
  console.log(`Protected API implementation fingerprint: ${implementationFingerprint}`);
}
