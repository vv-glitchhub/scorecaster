export const BOOKMAKER_OPTIONS = [
  { id: "veikkaus", label: "Veikkaus" },
  { id: "unibet", label: "Unibet" },
  { id: "bet365", label: "Bet365" },
  { id: "paf", label: "Paf" },
  { id: "betsson", label: "Betsson" },
  { id: "nordicbet", label: "NordicBet" },
  { id: "pinnacle", label: "Pinnacle" },
  { id: "betfair", label: "Betfair" },
];

export const DEFAULT_USER_BOOKMAKERS = [
  "veikkaus",
  "unibet",
  "bet365",
  "paf",
  "betsson",
  "nordicbet",
];

export function normalizeBookmakerName(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

export function bookmakerMatches(bookmakerName, selectedBookmakers = []) {
  const normalized = normalizeBookmakerName(bookmakerName);
  return selectedBookmakers.some((item) => normalized.includes(normalizeBookmakerName(item)));
}
