"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  professionalPreferenceSnapshot,
  subscribeSettings,
  updateSettings
} from "../../lib/settings-storage";

const DEFAULTS = Object.freeze({
  bookmakerKey: "all",
  bookmakerLabel: "Best available price",
  proMode: false,
  hydrated: false
});

const ProfessionalPreferencesContext = createContext({
  ...DEFAULTS,
  setBookmaker: () => {},
  setProMode: () => {},
  toggleProMode: () => {}
});

function normalize(value = {}) {
  return {
    bookmakerKey: String(value.bookmakerKey || "all").slice(0, 100),
    bookmakerLabel: String(value.bookmakerLabel || "Best available price").slice(0, 140),
    proMode: value.proMode === true
  };
}

export function ProfessionalPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    setPreferences({ ...normalize(professionalPreferenceSnapshot()), hydrated: true });
    return subscribeSettings((next) => setPreferences({ ...normalize(next), hydrated: true }));
  }, []);

  const setBookmaker = useCallback((bookmakerKey, bookmakerLabel) => {
    const next = updateSettings({
      bookmakerKey: String(bookmakerKey || "all").slice(0, 100),
      bookmakerLabel: String(bookmakerLabel || bookmakerKey || "Best available price").slice(0, 140)
    });
    setPreferences({ ...normalize(next), hydrated: true });
  }, []);

  const setProMode = useCallback((enabled) => {
    const next = updateSettings({ proMode: enabled === true });
    setPreferences({ ...normalize(next), hydrated: true });
  }, []);

  const toggleProMode = useCallback(() => setProMode(!preferences.proMode), [preferences.proMode, setProMode]);

  const value = useMemo(() => ({
    ...preferences,
    setBookmaker,
    setProMode,
    toggleProMode
  }), [preferences, setBookmaker, setProMode, toggleProMode]);

  return <ProfessionalPreferencesContext.Provider value={value}>{children}</ProfessionalPreferencesContext.Provider>;
}

export function useProfessionalPreferences() {
  return useContext(ProfessionalPreferencesContext);
}
