export function buildIntelligenceSummary(picks = []) {
  const summary = {
    totalPicks: picks.length,
    positiveSignals: [],
    negativeSignals: [],
    missingData: [],
    averageTrust: 0
  };

  let trustTotal = 0;

  for (const pick of picks) {
    trustTotal += Number(pick.sourceTrust || 0);

    (pick.intelligenceNotes || []).forEach((note) => {
      const lowered = note.toLowerCase();

      if (lowered.includes("positive") || lowered.includes("confirmed")) {
        summary.positiveSignals.push({
          match: pick.match,
          note
        });
      }

      if (
        lowered.includes("negative") ||
        lowered.includes("injury") ||
        lowered.includes("unavailable") ||
        lowered.includes("missing")
      ) {
        summary.negativeSignals.push({
          match: pick.match,
          note
        });
      }
    });

    (pick.readiness?.missing || []).forEach((item) => {
      summary.missingData.push({
        match: pick.match,
        item
      });
    });
  }

  summary.averageTrust =
    picks.length > 0 ? trustTotal / picks.length : 0;

  return summary;
}
