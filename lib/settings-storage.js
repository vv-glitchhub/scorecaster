const SETTINGS_KEY = "scorecaster_settings";

export function getSettings() {
  if (typeof window === "undefined") {
    return {
      bankroll: 1000,
      kellyMode: "quarter"
    };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        bankroll: 1000,
        kellyMode: "quarter"
      };
    }

    return JSON.parse(raw);
  } catch {
    return {
      bankroll: 1000,
      kellyMode: "quarter"
    };
  }
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
