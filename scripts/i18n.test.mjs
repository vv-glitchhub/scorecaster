import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dictionaries, getLocale, normalizeLang, supportedLanguages, translate } from "../lib/i18n.js";
import { buildDeterministicAgentExplanation, sanitizeAgentExplanationInput } from "../lib/agent-v10-explanation.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Finnish English and Spanish dictionaries have identical non-empty keys", () => {
  assert.deepEqual(supportedLanguages, ["fi", "en", "es"]);
  const baseline = Object.keys(dictionaries.fi).sort();
  assert.ok(baseline.length > 100);

  for (const language of supportedLanguages) {
    const keys = Object.keys(dictionaries[language]).sort();
    assert.deepEqual(keys, baseline, `${language} dictionary keys differ`);
    for (const key of keys) assert.ok(String(dictionaries[language][key]).trim(), `${language}.${key} is empty`);
  }
});

test("language normalization, locales and translation fallback are stable", () => {
  assert.equal(normalizeLang("fi-FI"), "fi");
  assert.equal(normalizeLang("en_US"), "en");
  assert.equal(normalizeLang("es-ES"), "es");
  assert.equal(normalizeLang("de-DE"), "fi");
  assert.equal(getLocale("fi"), "fi-FI");
  assert.equal(getLocale("en"), "en-US");
  assert.equal(getLocale("es"), "es-ES");
  assert.equal(translate("fi", "nav.home"), "Etusivu");
  assert.equal(translate("en", "nav.home"), "Home");
  assert.equal(translate("es", "nav.home"), "Inicio");
});

test("web language provider persists language and updates document language", async () => {
  const provider = await read("app/components/LanguageProvider.jsx");
  const shell = await read("app/components/AppShell.jsx");
  assert.match(provider, /scorecaster_language_v3/);
  assert.match(provider, /localStorage\.setItem/);
  assert.match(provider, /document\.documentElement\.lang = language/);
  assert.match(shell, /LanguageSwitcher/);
  assert.match(shell, /useLanguage/);
});

test("native language provider uses protected device storage", async () => {
  const native = await read("mobile/src/i18n.tsx");
  const app = await read("mobile/src/App.tsx");
  const settings = await read("mobile/src/screens/SettingsScreen.tsx");
  assert.match(native, /expo-secure-store/);
  assert.match(native, /scorecaster_language_v3/);
  assert.match(native, /"fi" \| "en" \| "es"/);
  assert.match(native, /Español/);
  assert.match(app, /<LanguageProvider>/);
  assert.match(settings, /languageOptions/);
});

test("Agent explanation language changes presentation but not signed decision input", async () => {
  const route = await read("app/api/agent/explain/route.js");
  const webClient = await read("app/agent/AgentExplanation.jsx");
  const nativeClient = await read("mobile/src/screens/AgentScreen.tsx");

  assert.match(route, /SUPPORTED_LANGUAGES/);
  assert.match(route, /generateGroundedExplanation\(contract, language\)/);
  assert.match(route, /buildDeterministicAgentExplanation\(contract, language\)/);
  assert.doesNotMatch(route, /contract\.language|language:\s*verified\.contract/);
  assert.match(webClient, /ticket: authoritative\.explanationTicket \|\| null,\s*language/s);
  assert.match(nativeClient, /ticket: decision\.explanationTicket \|\| null, language/);
});

test("deterministic Agent fallback is available in all three languages", () => {
  const contract = sanitizeAgentExplanationInput({
    decision: "PLAY",
    match: "Alpha vs Beta",
    selection: "Alpha",
    odds: 2,
    evidence: ["Verified market evidence"],
    counterArguments: ["The market can move"],
    missingEvidence: ["latest market data"]
  });

  assert.ok(contract);
  const fi = buildDeterministicAgentExplanation(contract, "fi");
  const en = buildDeterministicAgentExplanation(contract, "en");
  const es = buildDeterministicAgentExplanation(contract, "es");
  assert.match(fi.limitation, /virtuaalisen paperiseurannan/);
  assert.match(en.limitation, /virtual paper tracking/);
  assert.match(es.limitation, /seguimiento simulado/);
  assert.notEqual(fi.summary, en.summary);
  assert.notEqual(en.summary, es.summary);
});
