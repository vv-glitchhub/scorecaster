"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getLocale, languageOptions, normalizeLang, translate } from "../../lib/i18n";

const STORAGE_KEY = "scorecaster_language_v3";
const LanguageContext = createContext(null);

function detectInitialLanguage() {
  if (typeof window === "undefined") return "fi";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeLang(stored);

  return normalizeLang(window.navigator.language || "fi");
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("fi");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLanguageState(detectInitialLanguage());
    setReady(true);
  }, []);

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = normalizeLang(nextLanguage);
    setLanguageState(normalized);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, normalized);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  const t = useCallback((key, variables) => translate(language, key, variables), [language]);
  const tr = useCallback((values) => values?.[language] ?? values?.en ?? values?.fi ?? values?.es ?? "", [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    tr,
    locale: getLocale(language),
    languages: languageOptions,
    ready
  }), [language, ready, setLanguage, t, tr]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage, languages, t } = useLanguage();

  return (
    <label className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {!compact && <span className="font-bold text-slate-400">{t("language.label")}</span>}
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 font-black text-slate-100 outline-none focus:border-emerald-400/50"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>{compact ? item.short : item.label}</option>
        ))}
      </select>
    </label>
  );
}
