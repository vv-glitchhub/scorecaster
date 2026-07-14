import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const allowedExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".sql",
  ".md"
]);
const bundledSourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json"]);
const ignoredDirectories = new Set([".git", ".next", "node_modules", "dist", "build", ".expo"]);
const ignoredFiles = new Set([
  "scripts/security-check.mjs",
  ".env.example",
  "mobile/.env.example"
]);

const forbiddenPublicNames = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "EXPO_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_ODDS_API_KEY",
  "EXPO_PUBLIC_ODDS_API_KEY"
];

const secretPatterns = [
  { name: "OpenAI-style secret", pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/g },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".env") && entry.name !== ".env.example") {
      files.push(join(directory, entry.name));
      continue;
    }

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collectFiles(join(directory, entry.name)));
      continue;
    }

    if (allowedExtensions.has(extname(entry.name)) || entry.name === ".gitignore") {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

const violations = [];
const files = await collectFiles(root);

for (const absolutePath of files) {
  const path = relative(root, absolutePath).replaceAll("\\", "/");

  if (path.startsWith(".env") && path !== ".env.example") {
    violations.push(`${path}: environment file must not be committed`);
    continue;
  }

  if (ignoredFiles.has(path)) continue;

  const content = await readFile(absolutePath, "utf8");

  for (const publicName of forbiddenPublicNames) {
    if (content.includes(publicName)) {
      violations.push(`${path}: forbidden public secret variable ${publicName}`);
    }
  }

  for (const { name, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) violations.push(`${path}: possible ${name}`);
  }

  if (
    path.startsWith("mobile/") &&
    bundledSourceExtensions.has(extname(path)) &&
    /\b(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ODDS_API_KEY)\b/.test(content)
  ) {
    violations.push(`${path}: server-only key name is not allowed in the mobile bundle`);
  }
}

if (violations.length) {
  console.error("Security check failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Security check passed for ${files.length} repository files.`);
