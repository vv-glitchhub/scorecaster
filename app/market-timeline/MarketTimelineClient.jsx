"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import TimelinePanel from "./TimelinePanel";

function decimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "–";
}

export default function MarketTimelineClient() {
  const { tr, locale } = useLanguage();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0] || null, [items, selectedId]);

  const readTimeline = useCallback(async (item) => {
    if (!item) { setTimeline(null); return; }
    const query = new URLSearchParams({ eventId: item.event_id, selection: item.selection });
    const response = await fetch(`/api/cloud/market-timeline?${query}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Timeline unavailable");
    setAvailable(data.available !== false);
    setTimeline(data.timeline || null);
    if (data.warning) setMessage(data.warning);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Watchlist unavailable");
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(next);
      const current = next.find((item) => item.id === selectedId) || next[0] || null;
      if (current) {
        setSelectedId(current.id);
        await readTimeline(current);
      } else setTimeline(null);
    } catch (loadError) {
      setItems([]);
      setTimeline(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Aikajanaa ei voitu ladata.", en: "The timeline could not be loaded.", es: "No se pudo cargar la línea temporal." }));
    } finally { setLoading(false); }
  }, [readTimeline, selectedId, tr]);

  useEffect(() => { void load(); }, []);

  async function choose(item) {
    setSelectedId(item.id);
    setError("");
    setMessage("");
    try { await readTimeline(item); } catch (chooseError) { setError(chooseError instanceof Error ? chooseError.message : "Timeline unavailable"); }
  }

  async function capture() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/market-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selected.event_id, selection: selected.selection, sport: selected.sport })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Snapshot could not be captured");
      setAvailable(data.available !== false);
      setTimeline(data.timeline || null);
      setMessage(data.duplicateSuppressed
        ? tr({ fi: "Päällekkäinen hintapiste jätettiin tallentamatta.", en: "A duplicate price point was suppressed.", es: "Se omitió un punto de cuota duplicado." })
        : tr({ fi: `${data.captured || 0} varmennettua hintapistettä tallennettiin.`, en: `${data.captured || 0} verified price point(s) were stored.`, es: `Se guardaron ${data.captured || 0} puntos verificados.` }));
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Snapshot could not be captured");
    } finally { setBusy(false); }
  }

  const labels = {
    initial: tr({ fi: "Avaushinta", en: "Initial price", es: "Cuota inicial" }),
    current: tr({ fi: "Nykyhinta", en: "Current price", es: "Cuota actual" }),
    change: tr({ fi: "Muutos", en: "Change", es: "Cambio" }),
    decisions: tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" }),
    points: tr({ fi: "Hintapisteet", en: "Price points", es: "Puntos de cuota" }),
    limitation: tr({ fi: "Hintaliike on kuvailevaa markkinahistoriaa, ei todiste lopputuloksesta.", en: "Price movement is descriptive market history, not outcome evidence.", es: "El movimiento es historial descriptivo, no evidencia del resultado." })
  };

  return <div className="space-y-7">
    <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.2),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
      <div className="inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-200">Market Timeline V1</div>
      <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Varmennettu hintahistoria", en: "Verified price history", es: "Historial de cuotas verificado" })}</h1>
      <p className="mt-4 max-w-4xl text-slate-300">{tr({ fi: "Tallenna nykyinen palvelimen vahvistama hinta seuratulle kohteelle. Aikajana kuvaa hintaa ja päätöstä, mutta ei ennusta lopputulosta.", en: "Capture the current server-verified price for a watched selection. The timeline describes price and decision changes but does not predict the outcome.", es: "Guarda la cuota actual verificada. La línea describe cambios de cuota y decisión, pero no predice el resultado." })}</p>
      <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void load()} disabled={loading} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white disabled:opacity-50">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä lista", en: "Refresh list", es: "Actualizar lista" })}</button><Link href="/events" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Varmennetut ottelut", en: "Verified events", es: "Eventos verificados" })}</Link></div>
    </section>

    {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}
    {message && <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-100">{message}</div>}
    {!loading && items.length === 0 && <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">{tr({ fi: "Seurantalista on tyhjä. Lisää ensin kohde varmennetuista otteluista.", en: "Your watchlist is empty. Add a selection from Verified Events first.", es: "Tu lista está vacía. Añade primero una selección desde Eventos verificados." })}</div>}

    {items.length > 0 && <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-3">{items.map((item) => <button key={item.id} onClick={() => void choose(item)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id === item.id ? "border-purple-400 bg-purple-400/10" : "border-white/10 bg-white/[0.04]"}`}><div className="text-xs font-bold text-purple-300">{item.commence_time ? new Date(item.commence_time).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div><div className="mt-1 font-black text-white">{item.match}</div><div className="mt-1 text-sm text-slate-300">{item.selection} · {decimal(item.added_odds)}</div></button>)}</aside>
      <div className="space-y-5">{selected && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-bold text-purple-300">{selected.league || selected.sport}</div><h2 className="mt-1 text-2xl font-black">{selected.match}</h2><div className="mt-1 text-slate-300">{selected.selection}</div></div><button onClick={() => void capture()} disabled={busy || !available} className="rounded-xl bg-purple-400 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy ? tr({ fi: "Varmennetaan…", en: "Verifying…", es: "Verificando…" }) : tr({ fi: "Tallenna nykyinen hinta", en: "Capture current price", es: "Guardar cuota actual" })}</button></div>{!available && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-sm text-yellow-100">{tr({ fi: "Tietokantamigraatio ei ole vielä aktiivinen. Alkuperäinen seurantalistahinta näkyy, mutta uusia pisteitä ei voi tallentaa.", en: "The database migration is not active yet. The original watchlist price is visible, but new points cannot be stored.", es: "La migración aún no está activa. Se ve la cuota inicial, pero no se pueden guardar puntos nuevos." })}</div>}</div>}<TimelinePanel timeline={timeline} locale={locale} labels={labels} /></div>
    </section>}
  </div>;
}
