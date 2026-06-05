export function analyzeNews(newsItems = []) {
  let newsScore = 0;
  const notes = [];

  for (const item of newsItems) {
    const title = String(item.title || "").toLowerCase();
    const sourceTrust = Number(item.sourceTrust ?? 0.5);

    if (
      title.includes("injury") ||
      title.includes("out") ||
      title.includes("sidelined") ||
      title.includes("doubtful")
    ) {
      const impact = -0.04 * sourceTrust;
      newsScore += impact;
      notes.push(`Negative news: ${item.title}`);
    }

    if (
      title.includes("returns") ||
      title.includes("available") ||
      title.includes("starting") ||
      title.includes("fit")
    ) {
      const impact = 0.03 * sourceTrust;
      newsScore += impact;
      notes.push(`Positive news: ${item.title}`);
    }

    if (title.includes("suspended") || title.includes("ban")) {
      const impact = -0.05 * sourceTrust;
      newsScore += impact;
      notes.push(`Suspension risk: ${item.title}`);
    }

    if (
      title.includes("rested") ||
      title.includes("rotation") ||
      title.includes("bench")
    ) {
      const impact = -0.025 * sourceTrust;
      newsScore += impact;
      notes.push(`Lineup uncertainty: ${item.title}`);
    }
  }

  return {
    newsScore: Math.max(-0.15, Math.min(0.15, newsScore)),
    notes: notes.length ? notes : ["No major news signal detected."]
  };
}
