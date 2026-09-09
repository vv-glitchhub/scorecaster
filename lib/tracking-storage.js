const STORAGE_KEY = "scorecaster_tracking";

export function getTrackedBets() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(bet => bet && typeof bet === "object" && !Array.isArray(bet) && typeof bet.id === "string") : [];
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
      closingOdds: "",
      ...bet
    },
    ...current
  ];

  saveTrackedBets(updated);
  return updated;
}

export function settleTrackedBet(id, result, options = {}) {
  const current = getTrackedBets();

  const updated = current.map((bet) =>
    bet.id === id
      ? {
          ...bet,
          status: result === "pending" ? "open" : "settled",
          result,
          ...(Object.hasOwn(options, "closingOdds") ? { closingOdds: options.closingOdds } : {})
        }
      : bet
  );

  saveTrackedBets(updated);
  return updated;
}

export function updateClosingOdds(id, closingOdds) {
  const current = getTrackedBets();

  const updated = current.map((bet) =>
    bet.id === id
      ? {
          ...bet,
          closingOdds
        }
      : bet
  );

  saveTrackedBets(updated);
  return updated;
}

export function deleteTrackedBet(id) {
  const current = getTrackedBets();
  const updated = current.filter((bet) => bet.id !== id);

  saveTrackedBets(updated);
  return updated;
}

export function clearTrackedBets() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
