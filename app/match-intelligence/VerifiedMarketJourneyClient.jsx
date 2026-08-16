"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import VerifiedMarketJourneyV1 from "./VerifiedMarketJourneyV1";

export default function VerifiedMarketJourneyClient({ eventId, sport }) {
  const { tr, locale } = useLanguage();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled) {
          setHistory(response.ok && payload?.detail?.marketHistory
            ? payload.detail.marketHistory
            : { status: "unavailable" });
        }
      } catch {
        if (!cancelled) setHistory({ status: "unavailable" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, sport]);

  if (!history) {
    return (
      <section className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4" data-verified-market-history-loading="true">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">
          {tr({ fi: "Varmennettu markkinapolku", en: "Verified market path", es: "Ruta de mercado verificada" })}
        </div>
        <div className="mt-2 text-sm text-[var(--sc-muted)]">
          {tr({ fi: "Tarkistetaan first-party pregame-historiaa…", en: "Checking first-party pregame history…", es: "Comprobando historial previo propio…" })}
        </div>
      </section>
    );
  }

  return <VerifiedMarketJourneyV1 history={history} tr={tr} locale={locale} />;
}
