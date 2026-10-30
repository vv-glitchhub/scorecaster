import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recommendations = fs.readFileSync(new URL('../app/api/recommendations/route.js', import.meta.url), 'utf8');
const topPicks = fs.readFileSync(new URL('../app/api/top-picks/route.js', import.meta.url), 'utf8');
const odds = fs.readFileSync(new URL('../app/api/odds/route.js', import.meta.url), 'utf8');

test('recommendations reuse the validated Top Picks route without nested same-origin HTTP', () => {
  assert.match(recommendations, /import \{ GET as getTopPicksRoute \} from/);
  assert.match(recommendations, /getTopPicksRoute\(new Request\(/);
  assert.doesNotMatch(recommendations, /await fetch\(target/);
  assert.match(recommendations, /if \(!response\.ok \|\| payload\?\.ok !== true\)/);
  assert.match(recommendations, /if \(!successful\.length\)/);
  assert.match(recommendations, /partialUpstream:/);
  assert.match(recommendations, /Paper-only decision support/);
});

test('Top Picks reuse the protected odds parser and preserve verified fixture gates', () => {
  assert.match(topPicks, /import \{ GET as getOddsRoute \} from/);
  assert.match(topPicks, /getOddsRoute\(new Request\(/);
  assert.doesNotMatch(topPicks, /await fetch\(\s*`\$\{origin\}\/api\/odds/);
  assert.match(topPicks, /data\?\.source !== "live" \|\| data\?\.ok !== true/);
  assert.match(topPicks, /isUsableLiveFixture\(/);
  assert.match(topPicks, /fixtureVerifiedByProvider: true/);
  assert.match(odds, /export async function GET\(/);
});
