const NEGATIVE_SIGNALS = [
  { words: ["injury", "injured", "hurt", "sidelined"], impact: -0.045, label: "Injury concern" },
  { words: ["out", "ruled out", "will not play"], impact: -0.06, label: "Player ruled out" },
  { words: ["doubtful", "questionable", "game-time decision"], impact: -0.035, label: "Availability uncertainty" },
  { words: ["suspended", "ban", "banned"], impact: -0.055, label: "Suspension risk" },
  { words: ["rested", "rotation", "bench", "minutes limit"], impact: -0.03, label: "Lineup or minutes risk" },
  { words: ["goalie change", "backup goalie"], impact: -0.035, label: "Goalie uncertainty" }
];

const POSITIVE_SIGNALS = [
  { words: ["returns", "returned", "cleared", "available"], impact: 0.04, label: "Player availability boost" },
  { words: ["starting", "confirmed starter", "starts"], impact: 0.035, label: "Starting lineup confirmation" },
  { words: ["fit", "healthy", "full practice"], impact: 0.025, label: "Health boost" },
  { words: ["starting goalie", "confirmed goalie"], impact: 0.04, label: "Goalie confirmation" },
  { words: ["strong form", "winning streak", "hot streak"], impact: 0.025, label: "Positive form signal" }
];

export function analyzeNews(newsItems = []) {
  let newsScore = 0;
  const notes = [];
  const signals = [];

  for (const item of newsItems || []) {
    const title = String(item.title || item.headline || "").toLowerCase();
    const description = String(item.description || item.summary || "").toLowerCase();
    const text = `${title} ${description}`;
    const sourceTrust = Number(item.sourceTrust ?? 0.5);
    const recencyBoost = calculateRecencyBoost(item.publishedAt || item.updatedAt);
    const weight = sourceTrust * recencyBoost;

    for (const signal of NEGATIVE_SIGNALS) {
      if (signal.words.some((word) => text.includes(word))) {
        const impact = signal.impact * weight;
        newsScore += impact;
        notes.push(`${signal.label}: ${item.title}`);
        signals.push({ type: "negative", label: signal.label, impact, title: item.title });
      }
    }

    for (const signal of POSITIVE_SIGNALS) {
      if (signal.words.some((word) => text.includes(word))) {
        const impact = signal.impact * weight;
        newsScore += impact;
        notes.push(`${signal.label}: ${item.title}`);
        signals.push({ type: "positive", label: signal.label, impact, title: item.title });
      }
    }
  }

  const clamped = clamp(newsScore, -0.18, 0.18);

  return {
    newsScore: clamped,
    sentimentScore: clamped,
    signalCount: signals.length,
    signals,
    notes: notes.length ? notes.slice(0, 8) : ["No major news signal detected."]
  };
}

function calculateRecencyBoost(date) {
  if (!date) return 0.75;

  const ageHours = (Date.now() - new Date(date).getTime()) / 1000 / 60 / 60;

  if (!Number.isFinite(ageHours)) return 0.75;
  if (ageHours <= 6) return 1.25;
  if (ageHours <= 24) return 1.0;
  if (ageHours <= 72) return 0.75;
  return 0.45;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
