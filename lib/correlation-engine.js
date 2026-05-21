export function detectCorrelation(picks = []) {
  const warnings = [];

  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i];
      const b = picks[j];

      const sameMatch = a.match?.id && a.match?.id === b.match?.id;
      const sameMarket = a.market === b.market;

      if (sameMatch && sameMarket) {
        warnings.push({
          level: "high",
          message: `${a.label} ja ${b.label} ovat samasta ottelusta ja samasta markkinasta.`,
        });
      }

      if (sameMatch && a.market !== b.market) {
        warnings.push({
          level: "medium",
          message: `${a.label} ja ${b.label} ovat samasta ottelusta. Tarkista korrelaatio.`,
        });
      }

      if (a.bookmaker === b.bookmaker && Number(a.odds) >= 5 && Number(b.odds) >= 5) {
        warnings.push({
          level: "medium",
          message: `Kaksi korkean kertoimen kohdetta samalta bookkerilta: ${a.bookmaker}.`,
        });
      }
    }
  }

  return {
    hasHighCorrelation: warnings.some((w) => w.level === "high"),
    warnings,
  };
}
