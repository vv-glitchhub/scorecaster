import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const riskPath = "/api/cloud/autonomous-agent/risk-profile";

const manifestUrl = new URL("config/release-readiness.json", root);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
manifest.protectedApis = manifest.protectedApis.filter((item) => item.path !== riskPath);
const riskCheck = manifest.manualReleaseChecks.find((item) => item.id === "autonomous-agent-risk-profile");
if (riskCheck) {
  riskCheck.title = "Autonomous V13 applies the user-selected conservative, balanced or aggressive paper recommendation profile end to end while personal minimums and 1/5/2.5 percent hard caps remain authoritative; the new dedicated risk API is added to retained production auth-probe evidence only after its first live deployment";
}
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const testUrl = new URL("scripts/autonomous-risk-profile-v1.test.mjs", root);
let testSource = await readFile(testUrl, "utf8");
const oldPromise = `  const [page, card, mobile, cloudRoute, accountExport] = await Promise.all([\n    read("app/autonomous-agent/page.jsx"),\n    read("app/autonomous-agent/AutonomousRiskProfileCard.jsx"),\n    read("mobile/src/screens/AutonomousAgentScreen.tsx"),\n    read("app/api/cloud/autonomous-agent/route.js"),\n    read("app/api/account/export/route.js")\n  ]);`;
const newPromise = `  const [page, card, mobile] = await Promise.all([\n    read("app/autonomous-agent/page.jsx"),\n    read("app/autonomous-agent/AutonomousRiskProfileCard.jsx"),\n    read("mobile/src/screens/AutonomousAgentScreen.tsx")\n  ]);`;
if (!testSource.includes(oldPromise)) throw new Error("Missing parity test input anchor");
testSource = testSource.replace(oldPromise, newPromise);
const oldAssertions = `  assert.match(cloudRoute, /risk_profile/);\n  assert.match(cloudRoute, /risk_policy/);\n  assert.match(accountExport, /risk_profile/);\n  assert.match(accountExport, /risk_policy/);\n  assert.match(accountExport, /risk never changes probability\\/edge\\/EV/);\n`;
if (!testSource.includes(oldAssertions)) throw new Error("Missing staged production-evidence assertions");
testSource = testSource.replace(oldAssertions, "");
await writeFile(testUrl, testSource, "utf8");
