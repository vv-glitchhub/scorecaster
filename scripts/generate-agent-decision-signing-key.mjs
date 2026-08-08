import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGENT_SIGNING_KEY_GENERATED_BYTES,
  assessAgentDecisionSigningKey,
  generateAgentDecisionSigningKey
} from "../lib/agent-signing-key-readiness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, ".scorecaster-secrets/agent-decision-signing-key.txt");
const rotate = process.argv.includes("--rotate");
const ci = /^(1|true|yes)$/i.test(String(process.env.CI || ""));

if (ci) {
  console.error("Refusing to generate an Agent decision signing key in CI.");
  process.exit(2);
}

let exists = false;
try {
  await access(outputPath);
  exists = true;
} catch {
  exists = false;
}

if (exists && !rotate) {
  console.error("Local Agent decision signing-key file already exists. Use --rotate only for an intentional rotation.");
  process.exit(2);
}

const key = generateAgentDecisionSigningKey(AGENT_SIGNING_KEY_GENERATED_BYTES);
const assessment = assessAgentDecisionSigningKey(key);
if (!assessment.configured || !assessment.roundTripPassed || !assessment.wrongKeyRejected) {
  console.error("Generated key failed the local signing verification contract.");
  process.exit(1);
}

await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
await writeFile(outputPath, `${key}\n`, { encoding: "utf8", mode: 0o600, flag: rotate ? "w" : "wx" });
try {
  await chmod(dirname(outputPath), 0o700);
  await chmod(outputPath, 0o600);
} catch {
  // Windows and some filesystems do not implement POSIX permission bits.
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  created: true,
  rotated: rotate,
  output: relative(root, outputPath).replaceAll("\\", "/"),
  generatedBytes: AGENT_SIGNING_KEY_GENERATED_BYTES,
  fingerprintPrefix: assessment.fingerprintPrefix,
  roundTripPassed: assessment.roundTripPassed,
  wrongKeyRejected: assessment.wrongKeyRejected,
  secretPrinted: false,
  productionConfigurationChanged: false
}, null, 2)}\n`);
