function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function impliedProbability(odds) {
  const n = toNumber(odds);
  if (!n || n <= 1) return null;
  return 1 / n;
}

export function assessDataQuality({
  oddsData,
  selectedMatch,
  snapshots = [],
  market = "h2h",
}) {
  let score = 100;
  const issues = [];
  const positives = [];

  // Source quality
  const source = String(oddsData?.source || "unknown").toLowerCase();

  if (source === "fallback") {
    score -= 35;
    issues.push("Fallback-data käytössä.");
  } else if (source === "unknown") {
    score -= 45;
    issues.push("Datalähde tuntematon.");
  } else {
    positives.push("API-lähde käytössä.");
  }

  // Freshness
  if (!Array.isArray(snapshots) || snapshots.length < 2) {
    score -= 15;
    issues.push("Vähän historiadataa markkinaliikkeeseen.");
  } else {
    positives.push("Snapshot-historia käytettävissä.");
  }

  // Match completeness
  if (!selectedMatch?.bestOdds) {
    score -= 35;
    issues.push("Kertoimet puutteelliset.");
  } else {
    const bo = selectedMatch.bestOdds;

    if (market === "h2h") {
      if (!bo.home || !bo.away) {
        score -= 30;
        issues.push("H2H-markkina puutteellinen.");
      } else {
        positives.push("H2H-markkina rakenteellisesti ehjä.");
      }

      if (!bo.draw) {
        score -= 8;
        issues.push("Tasapelikerroin puuttuu.");
      }
    }

    if (market === "totals") {
      if (!bo.over || !bo.under) {
        score -= 25;
        issues.push("Totals-markkina puutteellinen.");
      }

      if (!bo.point) {
        score -= 12;
        issues.push("Totals-linja puuttuu.");
      }
    }

    if (market === "spreads") {
      if (!bo.spreadHome || !bo.spreadAway) {
        score -= 25;
        issues.push("Spread-markkina puutteellinen.");
      }
    }
  }

  // Overround sanity
  if (market === "h2h" && selectedMatch?.bestOdds) {
    const p1 = impliedProbability(selectedMatch.bestOdds.home);
    const p2 = impliedProbability(selectedMatch.bestOdds.draw);
    const p3 = impliedProbability(selectedMatch.bestOdds.away);

    if (p1 && p2 && p3) {
      const total = p1 + p2 + p3;

      if (total > 1.18) {
        score -= 12;
        issues.push("Poikkeuksellisen korkea overround.");
      } else {
        positives.push("Markkinan marginaali normaali.");
      }
    }
  }

  score = Math.max(1, Math.min(99, Math.round(score)));

  let tier = "low";
  if (score >= 80) tier = "high";
  else if (score >= 60) tier = "medium";

  return {
    score,
    tier,
    issues,
    positives,
    allowStrongRecommendations: score >= 75,
  };
}
