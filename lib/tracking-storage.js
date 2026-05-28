const STORAGE_KEY = "scorecaster_tracking";

export function getTrackedBets() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrackedBets(bets) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export function addTrackedBet(bet) {
  const current = getTrackedBets();

  const updated = [
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "open",
      result: "pending",
      ...bet
    },
    ...current
  ];

  saveTrackedBets(updated);

  return updated;
}
