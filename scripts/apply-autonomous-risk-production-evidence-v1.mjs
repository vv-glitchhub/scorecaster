import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const riskPath = "/api/cloud/autonomous-agent/risk-profile";
const deploymentId = "dpl_3DvG3xjsuuBhXpmZpvvAGVD83XBs";
const commitSha = "1b0bee99f654bf4cbb8735872a7fc290d70106be";

const probes = [
  ["/api/operations", "2026-08-19T04:06:40.000Z"],
  ["/api/account", "2026-08-19T04:07:00.000Z"],
  ["/api/account/export", "2026-08-19T04:07:24.000Z"],
  ["/api/cloud/bets", "2026-08-19T04:07:49.000Z"],
  ["/api/cloud/watchlist", "2026-08-19T04:08:11.000Z"],
  ["/api/cloud/alerts", "2026-08-19T04:08:34.000Z"],
  ["/api/cloud/notifications", "2026-08-19T04:08:56.000Z"],
  ["/api/cloud/watchlist-monitor", "2026-08-19T04:09:18.000Z"],
  ["/api/cloud/settlement-monitor", "2026-08-19T04:09:41.000Z"],
  ["/api/cloud/autonomous-agent", "2026-08-19T04:10:00.000Z"],
  ["/api/cloud/autonomy-mission-control", "2026-08-19T04:10:23.000Z"],
  ["/api/cloud/polymarket-intelligence", "2026-08-19T04:10:43.000Z"],
  [riskPath, "2026-08-19T04:04:48.000Z"]
].map(([path, observedAt]) => ({
  path,
  method: "GET",
  observedAt,
  httpStatus: 401,
  cacheControl: "no-store, max-age=0",
  ageSeconds: 0,
  vercelCache: "MISS"
}));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}
async function writeJson(path, value) {
  await writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

const manifest = await readJson("config/release-readiness.json");
if (!manifest.protectedApis.some((item) => item.path === riskPath)) {
  const index = manifest.protectedApis.findIndex((item) => item.path === "/api/cloud/autonomous-agent");
  if (index < 0) throw new Error("Missing autonomous-agent protected API anchor");
  manifest.protectedApis.splice(index + 1, 0, {
    path: riskPath,
    method: "GET",
    allowedStatuses: [401, 403]
  });
}
await writeJson("config/release-readiness.json", manifest);

const artifactsDir = resolve(root, "artifacts");
await mkdir(artifactsDir, { recursive: true });
const reportPath = resolve(artifactsDir, "protected-api-contract-evidence-refresh.json");
const audit = spawnSync(process.execPath, ["scripts/protected-api-contract-audit.mjs"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, PROTECTED_API_CONTRACT_REPORT_PATH: reportPath }
});
if (audit.status !== 0) throw new Error(`${audit.stderr || ""}\n${audit.stdout || ""}`);
const report = JSON.parse(await readFile(reportPath, "utf8"));
if (!report.passed || report.apiCount !== 13) throw new Error(`Expected 13/13 protected APIs, got ${report.passedApis}/${report.apiCount}`);

await writeJson("config/protected-api-implementation.json", {
  schemaVersion: 1,
  contractVersion: report.version,
  apiCount: report.apiCount,
  implementationFingerprint: report.implementationFingerprint
});

await writeJson("config/production-protected-api-probe-evidence.json", {
  schemaVersion: 1,
  product: "Scorecaster",
  evidenceType: "vercel-production-unauthenticated-protected-api-probes-v1",
  implementationFingerprint: report.implementationFingerprint,
  verifiedDeployment: {
    deploymentId,
    commitSha,
    environment: "production",
    host: "scorecaster.vercel.app"
  },
  observedAt: "2026-08-19T04:10:43.000Z",
  evidenceRef: "github-pr-autonomous-risk-production-evidence-v1",
  probes,
  sessionCredentialSent: false,
  bearerTokenSent: false,
  rawResponseBodyIncluded: false,
  secretValuesIncluded: false,
  userDataIncluded: false,
  requestIdentifiersIncluded: false
});

const testUrl = resolve(root, "scripts/protected-api-production-evidence.test.mjs");
let test = await readFile(testUrl, "utf8");
test = replaceRequired(test,
  'test("reviewed 12-route production auth probe passes only for the exact current implementation", () => {',
  'test("reviewed 13-route production auth probe passes only for the exact current implementation", () => {',
  "13-route test title"
);
test = replaceRequired(test, "  assert.equal(result.apiCount, 12);", "  assert.equal(result.apiCount, 13);", "trusted api count");
test = replaceRequired(test, "  assert.equal(result.passedApiCount, 12);", "  assert.equal(result.passedApiCount, 13);", "trusted pass count");
test = replaceRequired(test,
  'test("canonical release artifact blocks declared protected APIs without evidence and clears only with trusted 12/12 evidence", () => {',
  'test("canonical release artifact blocks declared protected APIs without evidence and clears only with trusted 13/13 evidence", () => {',
  "release evidence title"
);
test = replaceRequired(test, "  assert.equal(passed.protectedApiProbes.length, 12);", "  assert.equal(passed.protectedApiProbes.length, 13);", "release probe count");
await writeFile(testUrl, test, "utf8");

await writeFile(resolve(root, "docs/PRODUCTION_PROTECTED_API_EVIDENCE_2026_08_19.md"), `# Production Protected API Evidence — 2026-08-19\n\n## Scope\n\nThe retained unauthenticated production probe set now covers 13 declared protected GET APIs, including \`${riskPath}\`.\n\n## Deployment\n\n- deployment: \`${deploymentId}\`\n- commit: \`${commitSha}\`\n- environment: production\n- host: \`scorecaster.vercel.app\`\n- implementation fingerprint: \`${report.implementationFingerprint}\`\n\n## Result\n\nAll 13 routes returned HTTP 401 without a session credential or bearer token. Every retained response had Age 0, a no-store cache policy and Vercel cache MISS. No response body, request identifier, user data, cookie, credential, bearer token or secret value is retained in the canonical evidence document.\n\nThe new autonomous risk endpoint was observed at 2026-08-19T04:04:48Z. The remaining protected routes were freshly reprobed on the same production deployment between 2026-08-19T04:06:40Z and 2026-08-19T04:10:43Z.\n\n## Boundary\n\nThese are unauthenticated GET probes only. They do not run protected workers, create paper picks, mutate user settings or execute any real-money action. The Scorecaster product boundary remains sports analysis, risk control and paper tracking only.\n`, "utf8");

await rm(artifactsDir, { recursive: true, force: true });
console.log(`Prepared 13-route production evidence with fingerprint ${report.implementationFingerprint}`);
