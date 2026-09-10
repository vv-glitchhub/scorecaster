import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");

test("homepage renders the mobile-first V3 surface through the stable Today entrypoint", async () => {
  const [page, entry, home] = await Promise.all([
    file("app/page.jsx"),
    file("app/components/TodayPageClient.jsx"),
    file("app/components/TodayPageV3.jsx")
  ]);

  assert.match(page, /TodayPageClient from "\.\/components\/TodayPageClient"/);
  assert.match(page, /<TodayPageClient \/>/);
  assert.match(entry, /TodayPageV3 from "\.\/TodayPageV3"/);
  assert.match(entry, /<TodayPageV3 \/>/);
  assert.match(home, /data-homepage-v3="mobile-first"/);
  assert.match(home, /REAL DATA · PAPER ONLY/);
  assert.match(home, /Dataa\. /);
  assert.match(home, /Parempia päätöksiä/);
  assert.match(home, /\/api\/recommendations\?limit=20/);
});

test("homepage V3 is compact and responsive instead of reproducing the oversized V2 layout", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  assert.match(home, /max-width: 639px/);
  assert.match(home, /min-height: 58px/);
  assert.match(home, /text-\[clamp\(2rem,8vw,4\.25rem\)\]/);
  assert.match(home, /grid grid-cols-3 gap-2/);
  assert.match(home, /overflow-x-auto/);
  assert.match(home, /lg:grid-cols-\[minmax\(240px,.78fr\)_minmax\(390px,1.32fr\)_minmax\(250px,.82fr\)\]/);
  assert.doesNotMatch(home, /VisualPulse/);
  assert.doesNotMatch(home, /h-\[360px\]/);
});

test("homepage V3 keeps short league labels and truthful paper-only metrics", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  for (const label of ["Kaikki", "NBA", "NHL", "EPL", "NFL", "UFC"]) assert.match(home, new RegExp(`label: "${label}"`));
  assert.match(home, /Top AI Picks/);
  assert.match(home, /Match Hub/);
  assert.match(home, /Paper Slip/);
  assert.match(home, /Intelligence Edge/);
  assert.match(home, /independentModelProbability/);
  assert.match(home, /marketProbability/);
  assert.match(home, /Ei vedonvälittäjä\. Ei lähetä vetoa eikä siirrä rahaa\./);
  assert.match(home, /eivät toteutunutta ROI:ta tai luvattua voittoprosenttia/);
  assert.doesNotMatch(home, /\bPlace Bet\b|Potential Return|Avg\. ROI|guaranteed win rate|guaranteed profit/i);
});
