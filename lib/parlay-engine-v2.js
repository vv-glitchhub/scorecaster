import { detectCorrelation } from "@/lib/correlation-engine";

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function analyzeParlayV2(picks = [], bankroll = 1000) {
  const valid = picks.filter((p) => safeNumber(p.odds) > 1 && safeNumber(p.modelProb || p.modelProbability) > 0);

  if (valid.length < 2) {
    return {
      canAnalyze: false,
      verdict: "Lisää vähintään 2 kohdetta rekkaan.",
      status: "empty",
    };
  }

  const combinedOdds = valid.reduce((sum, p) => sum * safeNumber(p.odds, 1), 1);
  const combinedProb = valid.reduce(
    (sum, p) => sum * safeNumber(p.modelProb || p.modelProbability, 0),
    1
  );

  const ev = combinedOdds * combinedProb - 1;
  const correlation = detectCorrelation(valid);

  const weakLegs = valid.filter((p) => safeNumber(p.edge) < 0.025);
  const riskyLegs = valid.filter((p) => safeNumber(p.odds) >= 5);
  const allPositiveEv = valid.every((p) => safeNumber(p.ev) > 0);

  let status = "bad";
  let verdict = "❌ Älä pelaa tätä rekkana. Pelaa parhaat singlenä.";
  let confidence = 20;

  if (allPositiveEv && ev > 0 && weakLegs.length === 0 && !correlation.hasHighCorrelation) {
    status = valid.length <= 3 ? "good" : "warning";
    verdict =
      valid.length <= 3
        ? "✅ Rekka voi olla järkevä pienellä panoksella."
        : "⚠️ Rekka on +EV, mutta liian pitkä. Harkitse 2–3 kohteen versiota.";
    confidence = valid.length <= 3 ? 78 : 58;
  }

  if (correlation.hasHighCorrelation) {
    status = "bad";
    verdict = "❌ Liian vahva korrelaatio. Älä pelaa tätä rekkana.";
    confidence = 15;
  }

  if (riskyLegs.length >= 2) {
    status = status === "good" ? "warning" : status;
    confidence -= 12;
  }

  const suggestedStake = Math.max(1, Math.min(bankroll * 0.01, bankroll * 0.0025 * valid.length));
  const potentialReturn = suggestedStake * combinedOdds;

  return {
    canAnalyze: true,
    status,
    verdict,
    confidence: Math.max(0, Math.min(100, confidence)),
    count: valid.length,
    combinedOdds,
    combinedProb,
    ev,
    suggestedStake,
    potentialReturn,
    weakLegs,
    riskyLegs,
    correlation,
  };
}

export function buildParlaySuggestions(picks = [], bankroll = 1000) {
  const candidates = picks
    .filter((p) => p.shouldBet && Number(p.edge) > 0.025 && Number(p.ev) > 0)
    .sort((a, b) => Number(b.edge) - Number(a.edge));

  const combos = [];

  for (let size of [2, 3]) {
    for (let i = 0; i < candidates.length; i++) {
      const combo = candidates.slice(i, i + size);
      if (combo.length === size) {
        const analysis = analyzeParlayV2(combo, bankroll);
        if (analysis.canAnalyze) {
          combos.push({ picks: combo, analysis });
        }
      }
    }
  }

  return combos
    .filter((c) => c.analysis.status !== "bad")
    .sort((a, b) => b.analysis.ev - a.analysis.ev)
    .slice(0, 3);
}
