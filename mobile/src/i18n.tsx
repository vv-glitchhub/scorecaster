import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

export type Language = "fi" | "en" | "es";

type Values = { fi: string; en: string; es: string };
type I18nContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  tr: (values: Values) => string;
};

const STORAGE_KEY = "scorecaster_language_v3";
const localeMap: Record<Language, string> = { fi: "fi-FI", en: "en-US", es: "es-ES" };
const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value?: string | null): Language {
  const short = String(value || "").toLowerCase().split(/[-_]/)[0];
  if (short === "en" || short === "es" || short === "fi") return short;
  return "fi";
}

function systemLanguage(): Language {
  try {
    return normalizeLanguage(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "fi";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fi");

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (mounted) setLanguageState(stored ? normalizeLanguage(stored) : systemLanguage());
      })
      .catch(() => {
        if (mounted) setLanguageState(systemLanguage());
      });
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    void SecureStore.setItemAsync(STORAGE_KEY, normalized);
  }, []);

  const tr = useCallback((values: Values) => values[language] || values.en, [language]);
  const value = useMemo(() => ({ language, locale: localeMap[language], setLanguage, tr }), [language, setLanguage, tr]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLanguage() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export const languageOptions: { code: Language; label: string }[] = [
  { code: "fi", label: "Suomi" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" }
];
