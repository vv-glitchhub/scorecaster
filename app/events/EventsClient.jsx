"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const FILTERS = [
  { key: "all", sport: "", label: { fi: "Kaikki", en: "All", es: "Todos" } },
  { key: "nhl", sport: "icehockey_nhl", label: { fi: "NHL", en: "NHL", es: "NHL" } },
  { key: "nba", sport: "basketball_nba", label: { fi: "NBA", en: "NBA", es: "NBA" } },
  { key: "epl", sport: "soccer_epl", label: { fi: "EPL", en: "EPL", es: "EPL" } },
  { key: "laliga", sport: "soccer_spain_la_liga", label: { fi: "La Liga", en: "La Liga", es: "La Liga" } },
  { key: "liiga", sport: "icehockey_finland_liiga", label: { fi: "Liiga", en: "Liiga", es: "Liiga" } },
  { key: "shl", sport: "icehockey_sweden_hockey_league", label: { fi: "SHL", en: "SHL", es: "SHL" } }
];

function eventId(pick = {}) {
  return String(pick.gameId || pick.eventId || pick.id || "");
}

function decision(pick = {}) {
  const value = String(pick.productDecision || pick.decision || "CAUTION").toUpperCase();
  if (value === "BET") return "PLAY";
  if (value === "PASS") return "SKIP";
  return value === "PLAY" || value === "SKIP" ? value : "CAUTION";
}

function tone(value) {
  if (value === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (value === "SKIP") return "border-red-400/30 bg-red-400/10 text-red-200";
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

export default function EventsClient() {
  const { tr, locale } = useLanguage();
  const [filter, setFilter] = useState(FILTERS[0]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  const load = useCallback(async (selected = filter) => {
    setLoading(true);
    setError("");
    try {
      const query = selected.sport ? `?sports=${encodeURIComponent(selected.sport)}` : "";
      const response = await fetch(`/api/top-picks${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Events unavailable");
      setPicks(Array.isArray(data.data) ? data.data : []);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
    } catch (loadError) {
      setPicks([]);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Otteluita ei voitu ladata.", en: "Events could not be loaded.", es: "No se pudieron cargar los eventos." }));
    } finally {
      setLoading(false);
    }
  }, [filter, tr]);

  useEffect(() => { void load(filter); }, [filter]);

  const events = useMemo(() => {
    const map = new Map();
    for (const pick of picks) {
      const id = eventId(pick);
      if (!id) continue;
      if (!map.has(id)) map.set(id, { id, match: pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`, homeTeam: pick.homeTeam, awayTeam: pick.awayTeam, commenceTime: pick.commenceTime, league: pick.leagueTitle || pick.league, sportKey: pick.sportKey || pick.league, selections: [] });
      map.get(id).selections.push(pick);
    }
    return [...map.values()].sort((left, right) => Date.parse(left.commenceTime || "") - Date.parse(right.commenceTime || ""));
  }, [picks]);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">Event Detail V1</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Varmennetut ottelut", en: "Verified events", es: "Eventos verificados" })}</h1>
        <p className="mt-4 max-w-4xl text-slate-300">{tr({ fi: "Avaa yksi nykyisestä live-analyysistä löytyvä ottelu. Yksityiskohtanäkymä yhdistää markkinan, Sports Intelligencen, vireen ja levon sekä paperitoiminnot.", en: "Open an event found in the current live analysis. Event Detail combines market data, Sports Intelligence, form and rest, and paper-only actions.", es: "Abre un evento del análisis en vivo actual. El detalle combina mercado, Sports Intelligence, forma y descanso y acciones simuladas." })}</p>
        <div className="mt-5 text-xs text-slate-500">{generatedAt ? `${tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })} ${new Date(generatedAt).toLocaleString(locale)}` : ""}</div>
      </section>

      <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.key} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-black ${filter.key === item.key ? "border-sky-400 bg-sky-400/15 text-sky-200" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>{tr(item.label)}</button>)}<button onClick={() => void load()} disabled={loading} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 disabled:opacity-50">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button></div>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}</div>}
      {!loading && events.length === 0 && !error && <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">{tr({ fi: "Nykyisestä varmennetusta analyysistä ei löytynyt otteluita tällä suodattimella.", en: "No events were found in the current verified analysis for this filter.", es: "No se encontraron eventos en el análisis verificado actual con este filtro." })}</div>}

      <section className="grid gap-4 lg:grid-cols-2">{events.map((event) => {
        const best = event.selections.slice().sort((a, b) => Number(b.edge || 0) - Number(a.edge || 0))[0];
        const eventDecision = decision(best);
        const href = `/event/${encodeURIComponent(event.id)}?sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(best?.selection || best?.label || "")}`;
        return <Link key={event.id} href={href} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-sky-400/40 hover:bg-white/[0.07]"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-sky-300">{event.commenceTime ? new Date(event.commenceTime).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" })}</div><h2 className="mt-2 text-2xl font-black group-hover:text-sky-200">{event.match}</h2><div className="mt-1 text-sm text-slate-500">{event.league} · {event.selections.length} {tr({ fi: "valintaa", en: "selections", es: "selecciones" })}</div></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${tone(eventDecision)}`}>{eventDecision}</span></div>{best && <div className="mt-4 rounded-xl bg-slate-950/60 p-4"><div className="font-black">{best.selection || best.label} · {Number(best.odds || 0).toFixed(2)}</div><div className="mt-2 text-sm text-slate-300">Edge {percent(best.edge)} · EV {percent(best.ev)} · confidence {percent(best.confidence)}</div></div>}<div className="mt-4 text-sm font-black text-sky-300">{tr({ fi: "Avaa kaikki tiedot", en: "Open event detail", es: "Abrir detalle" })} →</div></Link>;
      })}</section>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-400">{tr({ fi: "Lista sisältää vain nykyisessä Top Picks -analyysissä olevat tapahtumat. Puuttuvaa tapahtumaa ei voi avata keksityillä asiakastiedoilla.", en: "The directory contains only events in the current Top Picks analysis. A missing event cannot be opened with invented client data.", es: "La lista contiene solo eventos del análisis Top Picks actual. No se puede abrir un evento ausente con datos inventados por el cliente." })}</div>
    </div>
  );
}
