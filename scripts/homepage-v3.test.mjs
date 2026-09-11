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

test("homepage V3 fails visibly and recoverably when recommendations cannot be loaded", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  assert.match(home, /error: loadError/);
  assert.match(home, /requestErrorText\(loadError, tr\)/);
  assert.match(home, /role="alert"/);
  assert.match(home, /onClick=\{refresh\}/);
  assert.match(home, /Yritä uudelleen/);
  assert.match(home, /value=\{loading \? "…" : error \? "–" : analyzed\.toLocaleString\("fi-FI"\)\}/);
});

test("homepage V3 surfaces partial upstream failures without presenting unverified data as complete", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  assert.match(home, /data\?\.partialUpstream/);
  assert.match(home, /role="status"/);
  assert.match(home, /Osa markkinoista ei vastannut\. Näytetään vain varmennettu data\./);
  assert.match(home, /Some markets did not respond\. Only verified data is shown\./);
  assert.doesNotMatch(home, /fallback odds|synthetic odds|estimated bookmaker/i);
});

test("homepage V3 preserves safe navigation from a recommendation to the event detail route", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  assert.match(home, /if \(!item\?\.eventId && !item\?\.id\) return "\/events"/);
  assert.match(home, /query\.set\("sport", item\.sportKey\)/);
  assert.match(home, /query\.set\("selection", item\.selection\)/);
  assert.match(home, /encodeURIComponent\(item\.eventId \|\| item\.id\)/);
  assert.match(home, /href=\{eventHref\(item\)\}/);
});

test("homepage V3 keeps empty recommendation states explicit instead of fabricating picks", async () => {
  const home = await file("app/components/TodayPageV3.jsx");

  assert.match(home, /Ei varmennettuja nostoja juuri nyt\./);
  assert.match(home, /No verified picks right now\./);
  assert.match(home, /No hay selecciones verificadas ahora\./);
  assert.doesNotMatch(home, /dummy pick|demo pick|placeholder odds|fake pick/i);
});

test("homepage remote-data hook aborts stale requests and avoids hidden-tab polling", async () => {
  const remote = await file("app/components/useRemoteJson.js");

  assert.match(remote, /const controller = new AbortController\(\)/);
  assert.match(remote, /let active = true/);
  assert.match(remote, /if \(active\) setState/);
  assert.match(remote, /active = false; controller\.abort\(\)/);
  assert.match(remote, /document\.visibilityState === "visible"/);
  assert.match(remote, /window\.clearInterval\(timer\)/);
  assert.match(remote, /state\.key === key/);
});

test("homepage remote-data hook clears stale values across refresh, query changes and request failures", async () => {
  const remote = await file("app/components/useRemoteJson.js");

  assert.match(remote, /setState\(\{ key, data: null, error: null, loading: true \}\)/);
  assert.match(remote, /fetchJson\(url, \{ timeoutMs, signal: controller\.signal \}\)/);
  assert.match(remote, /setState\(\{ key, data, error: null, loading: false \}\)/);
  assert.match(remote, /setState\(\{ key, data: null, error, loading: false \}\)/);
  assert.match(remote, /state\.key === key \? state : \{ data: null, error: null, loading: true \}/);
  assert.match(remote, /setRevision\(value => value \+ 1\)/);
});
