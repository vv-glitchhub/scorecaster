import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const client = fs.readFileSync(new URL("../app/production-evidence/ProductionEvidenceClient.jsx", import.meta.url), "utf8");

test("Production Evidence surfaces aggregate Verified Market Journey readiness", () => {
  assert.match(client, /data-market-journey-production-evidence="true"/);
  assert.match(client, /data\?\.verifiedMarketJourney/);
  assert.match(client, /marketJourney\.readyRatePct/);
  assert.match(client, /marketJourney\.journeyReady/);
  assert.match(client, /marketJourney\.futureEventSelections/);
  assert.match(client, /marketJourney\.thinHistory/);
  assert.match(client, /marketJourney\.shortSpan/);
  assert.match(client, /marketJourney\.maxSnapshots/);
  assert.match(client, /marketJourney\.maxSpanMinutes/);
});

test("UI explains the shared admission gate and observational boundary", () => {
  assert.match(client, /3 snapshotin \/ 30 minuutin portti/);
  assert.match(client, /3-snapshot \/ 30-minute gate/);
  assert.match(client, /never changes probability, edge, EV, decision or stake/);
  assert.match(client, /Aggregaatti ei paljasta event-ID:tä, valintaa tai raw-provider-dataa/);
  assert.match(client, /The aggregate exposes no event IDs, selections or raw provider data/);
});

test("market journey evidence UI keeps FI EN ES language coverage", () => {
  for (const language of ["fi:", "en:", "es:"]) assert.match(client, new RegExp(language));
  assert.match(client, /Pregame-historian todellinen peitto/);
  assert.match(client, /Real pregame history coverage/);
  assert.match(client, /Cobertura real del historial previo/);
});
