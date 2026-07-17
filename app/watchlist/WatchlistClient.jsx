"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";

function percent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
  return `${(Number(value) * 100).toFixed(1)} %`;
}

function severityClass(severity) {
  if (severity === "high") return "border-red-400/30 bg-red-400/10 text-red-100";
  if (severity === "medium") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return "border-sky-400/30 bg-sky-400/10 text-sky-100";
}

export default function WatchlistClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState({ items: [], alerts: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist unavailable");
      setState(payload);
    } catch (loadError) {
      setState({ items: [], alerts: [], summary: {} });
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Seurantalistaa ei voitu ladata.", en: "Watchlist could not be loaded.", es: "No se pudo cargar la lista de seguimiento." }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateItem(item, changes) {
    setBusyId(item.id);
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...changes })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Update failed");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : tr({ fi: "Päivitys epäonnistui.", en: "Update failed.", es: "La actualización falló." }));
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item) {
    if (!window.confirm(tr({ fi: "Poistetaanko kohde seurannasta?", en: "Remove this item from the watchlist?", es: "¿Eliminar este elemento de la lista?" }))) return;
    setBusyId(item.id);
    try {
      const response = await fetch("/api/cloud/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Removal failed");
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : tr({ fi: "Poistaminen epäonnistui.", en: "Removal failed.", es: "No se pudo eliminar." }));
    } finally {
      setBusyId(null);
    }
  }

  const summary = state.summary || {};
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">Watchlist & Alerts V2</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Seuraa oikeita otteluita ja hintamuutoksia", en: "Track verified fixtures and price changes", es: "Sigue partidos verificados y cambios de cuota" })}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "Seuranta vertaa palvelimen vahvistamaa nykytilaa siihen hetkeen, jolloin lisäsit kohteen. Se ei keksi puuttuvaa markkinadataa eikä aseta vetoja.", en: "The watchlist compares the server-verified current state with the moment you added the selection. It does not invent missing market data or place bets.", es: "La lista compara el estado actual verificado por el servidor con el momento en que añadiste la selección. No inventa datos ni realiza apuestas." })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => void load()} disabled={loading} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä seuranta", en: "Refresh watchlist", es: "Actualizar lista" })}</button>
          <Link href="/betting" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Etsi seurattava kohde", en: "Find a selection to watch", es: "Buscar una selección" })}</Link>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}{error.toLowerCase().includes("auth") || error.toLowerCase().includes("session") ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={tr({ fi: "Seurattuja", en: "Watched", es: "Seguidos" })} value={summary.watched || 0} />
        <Metric label={tr({ fi: "Aktiivisia", en: "Active", es: "Activos" })} value={summary.active || 0} />
        <Metric label={tr({ fi: "Hälytyksiä", en: "Alerts", es: "Alertas" })} value={summary.alerts || 0} />
        <Metric label={tr({ fi: "Korkea", en: "High", es: "Alta" })} value={summary.high || 0} tone="text-red-300" />
        <Metric label={tr({ fi: "Keskitaso", en: "Medium", es: "Media" })} value={summary.medium || 0} tone="text-yellow-300" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={tr({ fi: "Seurattavat kohteet", en: "Watched selections", es: "Selecciones seguidas" })} subtitle={tr({ fi: "Nykytila verrattuna lisäyshetkeen", en: "Current state versus added state", es: "Estado actual frente al momento de alta" })}>
          <div className="space-y-4">
            {!loading && state.items?.length === 0 && <Empty text={tr({ fi: "Seurantalista on tyhjä. Lisää oikea live-API-kohde Kohteista tai AI-sivulta.", en: "The watchlist is empty. Add a verified live-API selection from Picks or AI.", es: "La lista está vacía. Añade una selección verificada desde Pronósticos o IA." })} />}
            {(state.items || []).map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-emerald-300">{date(item.commence_time)}</div>
                    <h2 className="mt-1 text-xl font-black">{item.match}</h2>
                    <p className="mt-1 text-slate-300">{item.selection} · {Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</p>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-black ${item.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-400/20 bg-slate-400/10 text-slate-300"}`}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <Info label={tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} value={`${item.added_decision} → ${item.current?.decision || "–"}`} />
                  <Info label={tr({ fi: "Hintamuutos", en: "Price move", es: "Cambio de cuota" })} value={percent(item.oddsMove)} />
                  <Info label={tr({ fi: "PLAY-raja", en: "PLAY floor", es: "Límite PLAY" })} value={item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-400">{tr({ fi: "Hälytä hintaliikkeestä (%)", en: "Alert price move (%)", es: "Alertar cambio de cuota (%)" })}<input type="number" min="0.5" max="50" step="0.5" defaultValue={(Number(item.alert_move_percent || 0.05) * 100).toFixed(1)} onBlur={(event) => void updateItem(item, { alertMovePercent: Math.max(0.005, Math.min(0.5, Number(event.target.value || 5) / 100)) })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label>
                  <label className="text-sm text-slate-400">{tr({ fi: "Hälytä ennen alkua (min)", en: "Alert before kickoff (min)", es: "Alertar antes del inicio (min)" })}<input type="number" min="15" max="10080" step="15" defaultValue={item.alert_before_minutes || 120} onBlur={(event) => void updateItem(item, { alertBeforeMinutes: Number(event.target.value || 120) })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={busyId === item.id} onClick={() => void updateItem(item, { active: !item.active })} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">{item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })}</button>
                  <button disabled={busyId === item.id} onClick={() => void removeItem(item)} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200">{tr({ fi: "Poista", en: "Remove", es: "Eliminar" })}</button>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Todennetut hälytykset", en: "Verified alerts", es: "Alertas verificadas" })} subtitle={tr({ fi: "Ei sharp- tai uutisväitteitä ilman lähdedataa", en: "No sharp or news claims without source data", es: "Sin afirmaciones sharp o de noticias sin datos" })}>
          <div className="space-y-3">
            {(state.alerts || []).map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${severityClass(item.severity)}`}><div className="text-xs font-black uppercase tracking-wider">{item.severity}</div><div className="mt-1 font-black">{item.title}</div><div className="mt-1 text-sm opacity-85">{item.message}</div><div className="mt-2 text-xs opacity-70">{item.match} · {item.selection}</div></div>)}
            {!loading && state.alerts?.length === 0 && <Empty text={tr({ fi: "Ei todennettuja muutoksia juuri nyt.", en: "No verified changes right now.", es: "No hay cambios verificados ahora." })} />}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>; }
function Info({ label, value }) { return <div className="rounded-xl bg-slate-950/60 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black">{value}</div></div>; }
function Empty({ text }) { return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{text}</div>; }
