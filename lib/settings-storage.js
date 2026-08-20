const SETTINGS_KEY = "scorecaster_settings";
export const SETTINGS_CHANGED_EVENT = "scorecaster:settings-changed";

const DEFAULT_SETTINGS = Object.freeze({
  bankroll: 1000,
  kellyMode: "quarter",
  bookmakerKey: "all",
  bookmakerLabel: "Best available price",
  proMode: false,
  proProfile: "standard",
  agentRiskProfile: "balanced"
});

function normalizedAgentRiskProfile(value) {
  const profile = String(value || DEFAULT_SETTINGS.agentRiskProfile).trim().toLowerCase();
  return ["conservative", "balanced", "aggressive"].includes(profile)
    ? profile
    : DEFAULT_SETTINGS.agentRiskProfile;
}

function normalizedProfessionalProfile(value) {
  const profile = String(value || DEFAULT_SETTINGS.proProfile).trim().toLowerCase();
  return ["standard", "selective", "volume"].includes(profile)
    ? profile
    : DEFAULT_SETTINGS.proProfile;
}

function normalizedSettings(value = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
    bookmakerKey: String(value?.bookmakerKey || DEFAULT_SETTINGS.bookmakerKey).slice(0, 100),
    bookmakerLabel: String(value?.bookmakerLabel || DEFAULT_SETTINGS.bookmakerLabel).slice(0, 140),
    proMode: value?.proMode === true,
    proProfile: normalizedProfessionalProfile(value?.proProfile),
    agentRiskProfile: normalizedAgentRiskProfile(value?.agentRiskProfile)
  };
}

export function getSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizedSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  if (typeof window === "undefined") return;
  const next = normalizedSettings(settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: next }));
}

export function updateSettings(changes = {}) {
  const next = normalizedSettings({ ...getSettings(), ...(changes || {}) });
  saveSettings(next);
  return next;
}

export function subscribeSettings(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") return () => {};
  const custom = (event) => listener(normalizedSettings(event?.detail || getSettings()));
  const storage = (event) => {
    if (event.key === SETTINGS_KEY) listener(getSettings());
  };
  window.addEventListener(SETTINGS_CHANGED_EVENT, custom);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, custom);
    window.removeEventListener("storage", storage);
  };
}

export function professionalPreferenceSnapshot() {
  const settings = getSettings();
  return {
    bookmakerKey: settings.bookmakerKey,
    bookmakerLabel: settings.bookmakerLabel,
    proMode: settings.proMode,
    proProfile: settings.proProfile
  };
}
