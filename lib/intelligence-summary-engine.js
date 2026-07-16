export function buildIntelligenceSummary(picks = []) {
  const summary = {
    totalPicks: picks.length,
    positiveSignals: [],
    negativeSignals: [],
    missingData: [],
    averageTrust: 0,
    averageConfidence: 0,
    averageEdge: 0,
    averageBookmakerCount: 0,
    stalePicks: 0,
    decisions: {
      PLAY: 0,
      CAUTION: 0,
      SKIP: 0
    }
  };

  let trustTotal = 0;
  let confidenceTotal = 0;
  let edgeTotal = 0;
  let bookmakerTotal = 0;

  for (const pick of picks) {
    const trust = Number(pick.trustScore ?? pick.sourceTrust ?? 0);
    trustTotal += trust > 1 ? trust / 100 : trust;
    confidenceTotal += Number(pick.confidence || 0);
    edgeTotal += Number(pick.edge || 0);
    bookmakerTotal += Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0);

    const decision = pick.productDecision || (pick.decision === "BET" ? "PLAY" : pick.decision === "PASS" ? "SKIP" : "CAUTION");
    if (decision in summary.decisions) summary.decisions[decision] += 1;

    const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
    if (freshness === "stale") summary.stalePicks += 1;

    const notes = [
      ...(pick.intelligenceNotes || []),
      ...(pick.qualityNotes || []),
      ...(pick.promotionNotes || [])
    ];

    [...new Set(notes)].forEach((note) => {
      const lowered = String(note).toLowerCase();

      if (
        lowered.includes("positive") ||
        lowered.includes("confirmed") ||
        lowered.includes("broad bookmaker") ||
        lowered.includes("agree closely") ||
        lowered.includes("high market-data")
      ) {
        summary.positiveSignals.push({ match: pick.match, note });
      }

      if (
        lowered.includes("negative") ||
        lowered.includes("injury") ||
        lowered.includes("unavailable") ||
        lowered.includes("missing") ||
        lowered.includes("stale") ||
        lowered.includes("insufficient") ||
        lowered.includes("low market-data") ||
        lowered.includes("disagree")
      ) {
        summary.negativeSignals.push({ match: pick.match, note });
      }
    });

    (pick.readiness?.missing || []).forEach((item) => {
      summary.missingData.push({ match: pick.match, item });
    });

    const bookmakerCount = Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0);
    if (bookmakerCount < 4) {
      summary.missingData.push({
        match: pick.match,
        item: `Only ${bookmakerCount} bookmakers in the consensus; PLAY requires at least 4.`
      });
    }
    if (freshness === "stale" || freshness === "unknown") {
      summary.missingData.push({
        match: pick.match,
        item: `Market-data freshness is ${freshness}.`
      });
    }
  }

  if (picks.length > 0) {
    summary.averageTrust = trustTotal / picks.length;
    summary.averageConfidence = confidenceTotal / picks.length;
    summary.averageEdge = edgeTotal / picks.length;
    summary.averageBookmakerCount = bookmakerTotal / picks.length;
  }

  return summary;
}
