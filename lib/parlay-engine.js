export function analyzeParlay(picks = []) {
  const valid = picks.filter((p) => Number(p.odds) > 1 && Number(p.modelProb) > 0);

  if (valid.length < 2) {
    return {
      canAnalyze: false,
      verdict: "Lisää vähintään 2 kohdetta rekkaan.",
    };
  }

  const combinedOdds = valid.reduce((x, p) => x * Number(p.odds), 1);
  const combinedProb = valid.reduce((x, p) => x * Number(p.modelProb), 1);
  const ev = combinedOdds * combinedProb - 1;

  const allPositiveEv = valid.every((p) => Number(p.ev) > 0);
  const weakLegs = valid.filter((p) => Number(p.edge) < 0.025);
  const riskyLegs = valid.filter((p) => Number(p.odds) >= 5);

  let status = "bad";
  let verdict = "❌ Älä pelaa rekkana. Pelaa mieluummin parhaat singlenä.";

  if (allPositiveEv && ev > 0 && weakLegs.length === 0 && valid.length <= 3) {
    status = "good";
    verdict = "✅ Rekka voi olla järkevä, mutta panos pieneksi.";
  } else if (allPositiveEv && ev > 0) {
    status = "warning";
    verdict = "⚠️ Rekka on plussalla, mutta riski kasvaa. Harkitse singlejä.";
  }

  return {
    canAnalyze: true,
    count: valid.length,
    combinedOdds,
    combinedProb,
    ev,
    allPositiveEv,
    weakLegs,
    riskyLegs,
    status,
    verdict,
  };
}
