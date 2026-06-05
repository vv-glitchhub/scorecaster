export function buildIntelligenceSummary(picks = []) {
  const summary = {
    positiveSignals: [],
    negativeSignals: [],
    missingData: [],
    averageTrust: 0
  };

  let trustTotal = 0;

  for (const pick of picks) {
    trustTotal += Number(
      pick.sourceTrust || 0
    );

    (pick.intelligenceNotes || []).forEach(
      (note) => {
        if (
          note.toLowerCase().includes("positive")
        ) {
          summary.positiveSignals.push({
            match: pick.match,
            note
          });
        }

        if (
          note.toLowerCase().includes("negative")
        ) {
          summary.negativeSignals.push({
            match: pick.match,
            note
          });
        }
      }
    );

    (pick.readiness?.missing || []).forEach(
      (item) => {
        summary.missingData.push({
          match: pick.match,
          item
        });
      }
    );
  }

  summary.averageTrust =
    picks.length > 0
      ? trustTotal / picks.length
      : 0;

  return summary;
}
