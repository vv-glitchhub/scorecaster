const STORAGE_KEY = "scorecaster_clv_history";

export function getCLVHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCLVRecord(record) {
  if (typeof window === "undefined") return null;

  const history = getCLVHistory();

  const next = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...record
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...history].slice(0, 300))
  );

  return next;
}

export function clearCLVHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
