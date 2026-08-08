import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessAgentDecisionSigningKey } from "../lib/agent-signing-key-readiness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fileArg = args.find((value) => value.startsWith("--file="));
const requirePresent = args.includes("--require-present");
let key = "";
let source = "environment";

if (fileArg) {
  const requested = fileArg.slice("--file=".length);
  const path = resolve(root, requested);
  try {
    key = (await readFile(path, "utf8")).trim();
    source = "local-file";
  } catch {
    key = "";
    source = "local-file-missing";
  }
} else {
  key = String(process.env.AGENT_DECISION_SIGNING_KEY || "").trim();
}

const assessment = assessAgentDecisionSigningKey(key);
const passed = assessment.configured && assessment.roundTripPassed && assessment.wrongKeyRejected;
const report = {
  version: assessment.version,
  passed,
  source,
  configured: assessment.configured,
  minimumLengthMet: assessment.minimumLengthMet,
  fingerprintPrefix: assessment.fingerprintPrefix,
  roundTripPassed: assessment.roundTripPassed,
  wrongKeyRejected: assessment.wrongKeyRejected,
  secretValueIncluded: false,
  productionConfigurationChanged: false,
  paperOnly: true
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (requirePresent && !passed) process.exitCode = 1;
