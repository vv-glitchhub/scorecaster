const STORAGE_KEY = "scorecaster_odds_snapshots";

export function getOddsSnapshots() {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function makeOddsSnapshotKey(match, outcome) {
  return `${match.id}-${match.market}-${outcome.name}-${outcome.point ?? ""}`;
}

export function saveOddsSnapshots(matches = []) {
  if (typeof window === "undefined") return;

  const current = getOddsSnapshots();
  const next = { ...current };

  matches.forEach((match) => {
    if (!Array.isArray(match.outcomes)) return;

    match.outcomes.forEach((outcome) => {
      const key = makeOddsSnapshotKey(match, outcome);
      next[key] = Number(outcome.odds);
    });
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getOddsMovement({ match, outcome }) {
  const snapshots = getOddsSnapshots();
  const key = makeOddsSnapshotKey(match, outcome);
  const previousOdds = snapshots[key];

  if (!previousOdds) {
    return {
      direction: "none",
      previousOdds: null,
      difference: 0
    };
  }

  const difference = Number(outcome.odds) - Number(previousOdds);

  if (difference > 0) {
    return {
      direction: "up",
      previousOdds,
      difference
    };
  }

  if (difference < 0) {
    return {
      direction: "down",
      previousOdds,
      difference
    };
  }

  return {
    direction: "same",
    previousOdds,
    difference: 0
  };
}
