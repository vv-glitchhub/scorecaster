import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const project = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expoPackagePath = require.resolve("expo/package.json");
const expoPackage = require(expoPackagePath);
const bundled = require("expo/bundledNativeModules.json");
const dependencies = { ...project.dependencies, ...project.devDependencies };

function parseVersion(value) {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function satisfies(version, range) {
  const actual = parseVersion(version);
  const minimum = parseVersion(String(range).replace(/^[~^]/, ""));
  if (!actual || !minimum) return version === range;

  if (String(range).startsWith("~")) {
    return actual[0] === minimum[0] && actual[1] === minimum[1] && compare(actual, minimum) >= 0;
  }

  if (String(range).startsWith("^")) {
    return actual[0] === minimum[0] && compare(actual, minimum) >= 0;
  }

  return compare(actual, minimum) === 0;
}

const checked = [];
const failures = [];

for (const [name] of Object.entries(dependencies)) {
  const expected = bundled[name];
  if (!expected) continue;

  let installed;
  try {
    installed = require(`${name}/package.json`).version;
  } catch {
    failures.push(`${name}: package is declared but not installed`);
    continue;
  }

  checked.push({ name, installed, expected });
  if (!satisfies(installed, expected)) {
    failures.push(`${name}: installed ${installed}, Expo ${expoPackage.version} expects ${expected}`);
  }
}

if (!checked.length) {
  failures.push("No Expo-managed dependencies were checked");
}

if (failures.length) {
  console.error("Expo compatibility check failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Expo ${expoPackage.version} compatibility passed for ${checked.length} installed packages.`);
for (const item of checked) {
  console.log(`- ${item.name}: ${item.installed} (${item.expected})`);
}
