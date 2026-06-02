const STORAGE_KEY = "scorecaster_movement_history";

export function getMovementHistory() {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMovementSnapshot(matches = []) {
  if (typeof window === "undefined") return;

  const history = getMovementHistory();
  const timestamp = new Date().toISOString();

  matches.forEach((match) => {
    match.outcomes?.forEach((outcome) => {
      const key = `${match.id}-${match.market}-${outcome.name}-${outcome.point ?? ""}`;

      if (!history[key]) {
        history[key] = [];
      }

      history[key].push({
        timestamp,
        odds: Number(outcome.odds),
        bookmaker: outcome.bookmaker || "unknown"
      });

      history[key] = history[key].slice(-20);
    });
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getSelectionMovementHistory(match, outcome) {
  const history = getMovementHistory();
  const key = `${match.id}-${match.market}-${outcome.name}-${outcome.point ?? ""}`;

  return history[key] || [];
}

export function detectMovementSignal(history = []) {
  if (history.length < 2) {
    return {
      signal: "New",
      strength: "Low"
    };
  }

  const first = history[0];
  const last = history[history.length - 1];

  const diff = Number(last.odds) - Number(first.odds);

  if (diff >= 0.15) {
    return {
      signal: "Odds Drift Up",
      strength: "Medium"
    };
  }

  if (diff <= -0.15) {
    return {
      signal: "Steam Move Down",
      strength: "High"
    };
  }

  return {
    signal: "Stable",
    strength: "Low"
  };
}
