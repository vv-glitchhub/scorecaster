"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import TimelinePanel from "./TimelinePanel";

function decimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "–";
}

export default function EventActivityClient({ eventId }) {
  const { tr, locale } = useLanguage();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0] || null,
    [items, selectedId]
  );

  const readTimeline = useCallback(async (item) => {
    if (!item) {
      setTimeline(null);
      return;
    }
    const query = new URLSearchParams({ eventId: item.event_id, selection: item.selection });
    const response = await fetch(`/api/cloud/market-timeline?${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Timeline unavailable");
    setTimeline(data.timeline || null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Watchlist unavailable");

      const all = Array.isArray(data.items) ? data.items : [];
      const matching = all.filter((item) => item.event_id === eventId);
      setItems(matching);

      const current = matching.find((item) => item.id === selectedId) || matching[0] || null;
      if (current) {
        setSelectedId(current.id);
        await readTimeline(current);
      } else {
        setSelectedId("");
        setTimeline(null);
      }
    } catch (loadError) {
      setItems([]);
      setTimeline(null);
      setError(loadError instanceof Error ? loadError.message : "Activity unavailable");
    } finally {
      setLoading(false);
    }
  }, [eventId, readTimeline, selectedId]);

  useEffect(() => { void load(); }, []);

  async function choose(item) {
    setSelectedId(item.id);
    setError("");
    try {
      await readTimeline(item);
    } catch (chooseError) {
      setError(chooseError instanceof Error ? chooseError.message : "Activity unavailable");
    }
  }

  const labels = {
    initial: tr({ fi: "Avaushinta", en: "Initial price", es: "Cuota inicial" }),
    current: tr({ fi: "Nykyhinta", en: "Current price", es: "Cuota actual" }),
    change: tr({ fi: "Muutos", en: "Change", es: "Cambio" }),
    decisions: tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" }),
    points: tr({ fi: "Hintapisteet", en: "Price points", es: "Puntos de cuota" }),
    limitation: tr({ fi: "Hintaliike on kuvailevaa markkinahistoriaa, ei todiste lopputuloksesta.", en: "Price movement is descriptive market history, not outcome evidence.", es: "El movimiento es historial descriptivo, no evidencia del resultado." })
  };

  return (
    <div className="space-y-6" data-event-activity-read-only="true">
      <section className="sc-surface rounded-[2rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Activity / History</div>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({ fi: "Ottelun varmennettu muutoshistoria", en: "Verified event activity", es: "Actividad verificada del evento" })}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">
          {tr({ fi: "Tämä näkymä lukee vain jo tallennettua watchlist- ja timeline-dataa. Se ei tallenna uutta hintaa eikä vaihda pyydettyä ottelua toiseen.", en: "This view reads already stored watchlist and timeline data only. It does not capture a new price or silently switch to another event.", es: "Esta vista solo lee datos ya guardados de watchlist y timeline. No captura una cuota nueva ni cambia silenciosamente a otro evento." })}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/events" className="sc-button-secondary inline-flex">{tr({ fi: "Ottelut", en: "Events", es: "Eventos" })}</Link>
          <Link href="/market-timeline" className="sc-button-secondary inline-flex">{tr({ fi: "Kaikki Activityt", en: "All activity", es: "Toda la actividad" })}</Link>
        </div>
      </section>

      {loading ? <section className="sc-surface rounded-[1.65rem] p-6 text-[var(--sc-muted)]">{tr({ fi: "Ladataan tallennettua historiaa…", en: "Loading stored history…", es: "Cargando historial guardado…" })}</section> : null}

      {error ? <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error} {/auth|sign|session/i.test(error) ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div> : null}

      {!loading && !error && items.length === 0 ? (
        <section className="sc-surface rounded-[1.65rem] p-6" data-event-activity-empty="true">
          <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Tätä ottelua ei ole vielä watchlistilla", en: "This event is not on your watchlist yet", es: "Este evento aún no está en tu watchlist" })}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Activity ei näytä toisen ottelun historiaa varatuloksena. Lisää kohde ensin seurantalistalle, jos haluat kerätä sille varmennettua historiaa.", en: "Activity will not show another event as a fallback. Add a selection to your watchlist first if you want verified history for this event.", es: "Activity no mostrará otro evento como alternativa. Añade primero una selección a tu watchlist si quieres historial verificado para este evento." })}</p>
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => void choose(item)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id === item.id ? "border-purple-400 bg-purple-400/10" : "border-white/10 bg-white/[0.04]"}`}>
                <div className="font-black text-white">{item.selection}</div>
                <div className="mt-1 text-sm text-slate-300">{decimal(item.added_odds)}</div>
                <div className="mt-2 text-xs text-slate-400">{item.commence_time ? new Date(item.commence_time).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div>
              </button>
            ))}
          </aside>
          <div className="space-y-4">
            {selected ? <div className="sc-surface rounded-[1.5rem] p-5"><div className="text-sm font-bold text-[var(--sc-brand)]">{selected.league || selected.sport}</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{selected.match}</h2><div className="mt-1 text-sm text-[var(--sc-muted)]">{selected.selection}</div></div> : null}
            <TimelinePanel timeline={timeline} locale={locale} labels={labels} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
