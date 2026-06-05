const STORAGE_KEY = "scorecaster_bankroll";

export function getSavedBankroll(defaultValue = 1000) {
  if (typeof window === "undefined") return defaultValue;

  const raw = localStorage.getItem(STORAGE_KEY);
  const value = Number(raw);

  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

export function saveBankroll(value) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, String(Number(value || 0)));
}
