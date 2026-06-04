export function analyzeNews(newsItems = []) {
  let score = 0;

  const notes = [];

  for (const item of newsItems) {
    const title = String(item.title || "").toLowerCase();

    if (
      title.includes("injury") ||
      title.includes("out") ||
      title.includes("sidelined")
    ) {
      score -= 0.04;
      notes.push(`Negative news: ${item.title}`);
    }

    if (
      title.includes("returns") ||
      title.includes("available") ||
      title.includes("starting")
    ) {
      score += 0.03;
      notes.push(`Positive news: ${item.title}`);
    }

    if (
      title.includes("suspended")
    ) {
      score -= 0.05;
      notes.push(`Suspension risk: ${item.title}`);
    }
  }

  return {
    newsScore: Math.max(-0.15, Math.min(0.15, score)),
    notes
  };
}
