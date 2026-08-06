import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateProfessionalSelection,
  normalizedProfessionalDecision,
  PROFESSIONAL_SELECTION_EVIDENCE_VERSION,
  professionalOffers
} from "../lib/professional-selection-evidence.mjs";

const selection = Object.freeze({
  eventId: "event-1",
  selection: "Home",
  modelMode: "independent-model-v2",
  independentModelProbability: 0.55,
  marketProbability: 0.5,
  productDecision: "PLAY",
  offers: [
    { bookmakerKey: "book-a", bookmaker: "Book A", odds: 2.0, observedAt: "2026-08-06T10:00:00.000Z" },
    { bookmakerKey: "book-b", bookmaker: "Book B", odds: 2.1, observedAt: "2026-08-06T10:00:00.000Z" }
  ]
});

test("provider preference changes offered price and EV but not model or market probability", () => {
  const best = evaluateProfessionalSelection(selection, { bookmakerKey: "all", bookmakerLabel: "Best available price" });
  const bookA = evaluateProfessionalSelection(selection, { bookmakerKey: "book-a", bookmakerLabel: "Book A" });
  const bookB = evaluateProfessionalSelection(selection, { bookmakerKey: "book-b", bookmakerLabel: "Book B" });

  assert.equal(best.version, PROFESSIONAL_SELECTION_EVIDENCE_VERSION);
  assert.equal(best.selectedOffer.bookmaker, "Book B");
  assert.equal(best.selectedOffer.odds, 2.1);
  assert.equal(bookA.selectedOffer.odds, 2.0);
  assert.equal(bookB.selectedOffer.odds, 2.1);
  assert.equal(bookA.modelProbability, 0.55);
  assert.equal(bookB.modelProbability, 0.55);
  assert.equal(bookA.marketProbability, 0.5);
  assert.equal(bookB.marketProbability, 0.5);
  assert.equal(bookA.ev, 0.1);
  assert.equal(bookB.ev, 0.155);
  assert.equal(bookA.invariants.providerChangesOnlyOfferedPrice, true);
  assert.equal(bookA.invariants.modelProbabilityIndependentOfProvider, true);
  assert.equal(bookA.invariants.marketBenchmarkIndependentOfProvider, true);
  assert.equal(bookA.invariants.realMoneyExecution, false);
});

test("market consensus is never mislabeled as an independent model", () => {
  const result = evaluateProfessionalSelection({
    ...selection,
    independentModelProbability: undefined,
    modelMode: "market-consensus",
    modelProbability: 0.51,
    consensusProbability: 0.51
  }, { bookmakerKey: "all" });
  assert.equal(result.modelProbability, null);
  assert.equal(result.marketProbability, 0.51);
  assert.equal(result.modelEvidenceAvailable, false);
  assert.equal(result.marketOnly, true);
  assert.equal(result.invariants.marketConsensusNeverMislabelledAsIndependentModel, true);
});

test("preferred provider unavailability is explicit and does not silently rename another provider", () => {
  const result = evaluateProfessionalSelection(selection, { bookmakerKey: "missing-book", bookmakerLabel: "Missing Book" });
  assert.equal(result.selectedOffer.preferredProviderUnavailable, true);
  assert.notEqual(result.selectedOffer.bookmaker, "Book A");
  assert.notEqual(result.selectedOffer.bookmaker, "Book B");
  assert.equal(result.bookmakerPreference.bookmakerLabel, "Missing Book");
});

test("offers are deterministic, deduplicated by provider and sorted by price", () => {
  const rows = professionalOffers({
    offers: [
      { bookmakerKey: "a", bookmaker: "A", odds: 2.0, observedAt: "2026-08-06T09:00:00Z" },
      { bookmakerKey: "a", bookmaker: "A", odds: 2.05, observedAt: "2026-08-06T10:00:00Z" },
      { bookmakerKey: "b", bookmaker: "B", odds: 1.95, observedAt: "2026-08-06T10:00:00Z" }
    ]
  });
  assert.deepEqual(rows.map((row) => [row.bookmakerKey, row.odds]), [["a", 2.05], ["b", 1.95]]);
});

test("decision language is consistent across legacy values", () => {
  assert.equal(normalizedProfessionalDecision("BET"), "PLAY");
  assert.equal(normalizedProfessionalDecision("PLAY"), "PLAY");
  assert.equal(normalizedProfessionalDecision("WAIT"), "WATCH");
  assert.equal(normalizedProfessionalDecision("CAUTION"), "CAUTION");
  assert.equal(normalizedProfessionalDecision("PASS"), "SKIP");
});

test("shared preferences persist through the existing settings key and cross-surface events", async () => {
  const settings = await readFile(new URL("../lib/settings-storage.js", import.meta.url), "utf8");
  const provider = await readFile(new URL("../app/components/ProfessionalPreferencesProvider.jsx", import.meta.url), "utf8");
  assert.match(settings, /const SETTINGS_KEY = "scorecaster_settings"/);
  assert.match(settings, /bookmakerKey: "all"/);
  assert.match(settings, /bookmakerLabel: "Best available price"/);
  assert.match(settings, /proMode: false/);
  assert.match(settings, /scorecaster:settings-changed/);
  assert.match(settings, /window\.addEventListener\("storage"/);
  assert.match(provider, /updateSettings/);
  assert.match(provider, /subscribeSettings/);
  assert.match(provider, /toggleProMode/);
});

test("Today, AI Feed and Matches render the exact same canonical selection component", async () => {
  const today = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");
  const feed = await readFile(new URL("../app/feed/page.jsx", import.meta.url), "utf8");
  const events = await readFile(new URL("../app/events/page.jsx", import.meta.url), "utf8");
  const rail = await readFile(new URL("../app/components/ProfessionalSurfaceRail.jsx", import.meta.url), "utf8");
  assert.match(today, /ProfessionalSurfaceRail surface="today"/);
  assert.match(feed, /ProfessionalSurfaceRail surface="feed"/);
  assert.match(events, /ProfessionalSurfaceRail surface="events"/);
  assert.match(rail, /import ProfessionalSelectionCard/);
  assert.match(rail, /<ProfessionalSelectionCard/);
  assert.doesNotMatch(today, /evaluateProfessionalSelection/);
  assert.doesNotMatch(feed, /evaluateProfessionalSelection/);
  assert.doesNotMatch(events, /evaluateProfessionalSelection/);
});

test("Paper Portfolio and Profile use the same preference provider and professional paths", async () => {
  const tracking = await readFile(new URL("../app/tracking/layout.jsx", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/profile/layout.jsx", import.meta.url), "utf8");
  const rail = await readFile(new URL("../app/components/ProfessionalSurfaceRail.jsx", import.meta.url), "utf8");
  assert.match(tracking, /ProfessionalPortfolioRail/);
  assert.match(profile, /ProfessionalProfileRail/);
  assert.match(rail, /href="\/calibration"/);
  assert.match(rail, /href="\/risk-lab"/);
  assert.match(rail, /href="\/coach"/);
  assert.match(rail, /ProfessionalPreferenceControls/);
});

test("Pro Mode reveals deeper audit without a separate calculation path", async () => {
  const card = await readFile(new URL("../app/components/ProfessionalSelectionCard.jsx", import.meta.url), "utf8");
  assert.match(card, /evaluateProfessionalSelection\(selection, \{ bookmakerKey, bookmakerLabel \}\)/);
  assert.match(card, /proMode && <details open/);
  assert.match(card, /same calculations, deeper audit/);
  assert.equal((card.match(/evaluateProfessionalSelection/g) || []).length, 2, "One import and one evaluation call are expected");
  assert.doesNotMatch(card, /fetch\(/);
  assert.doesNotMatch(card, /\/api\/ai/);
});

test("paper-only explanation appears before and describes every canonical save control", async () => {
  const card = await readFile(new URL("../app/components/ProfessionalSelectionCard.jsx", import.meta.url), "utf8");
  const boundaryIndex = card.indexOf("data-paper-boundary");
  const saveIndex = card.indexOf("Save to paper portfolio");
  assert.ok(boundaryIndex >= 0);
  assert.ok(saveIndex > boundaryIndex);
  assert.match(card, /aria-describedby=\{boundaryId\}/);
  assert.match(card, /does not place a real bet, move money or sign in to a bookmaker/i);
  assert.doesNotMatch(card, /bookmaker.*password/i);
  assert.doesNotMatch(card, /realMoneyExecution:\s*true/i);
});

test("critical state is text-labelled and controls are accessible on mobile and keyboard", async () => {
  const controls = await readFile(new URL("../app/components/ProfessionalPreferenceControls.jsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../app/components/ProfessionalSelectionCard.jsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.jsx", import.meta.url), "utf8");
  assert.match(controls, /htmlFor=\{selectId\}/);
  assert.match(controls, /htmlFor=\{toggleId\}/);
  assert.match(controls, /min-h-11/);
  assert.match(controls, /focus:ring-2/);
  assert.match(card, /aria-label=\{`Decision \$\{decision\}`\}/);
  assert.match(card, /Largest risk/);
  assert.match(card, /grid-cols-2 sm:grid-cols-4/);
  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /aria-controls="scorecaster-more-menu"/);
  assert.match(shell, /max-h-\[min\(78vh,760px\)\]/);
  assert.match(shell, /grid-cols-5/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
});

test("the primary product remains exactly five tabs and advanced routes stay secondary", async () => {
  const shell = await readFile(new URL("../app/components/AppShell.jsx", import.meta.url), "utf8");
  const docs = await readFile(new URL("../docs/PROFESSIONAL_UX_CONSOLIDATION_V1.md", import.meta.url), "utf8");
  const primaryBlock = shell.slice(shell.indexOf("const primaryItems"), shell.indexOf("const groups"));
  assert.equal((primaryBlock.match(/href:/g) || []).length, 5);
  for (const href of ["/", "/feed", "/events", "/tracking", "/profile"]) assert.match(primaryBlock, new RegExp(`href: "${href.replace("/", "\\/")}"`));
  assert.match(docs, /exactly five primary destinations/i);
  assert.match(docs, /advanced evidence or model laboratories/i);
  assert.match(shell, /Developer and operator tools/);
});
