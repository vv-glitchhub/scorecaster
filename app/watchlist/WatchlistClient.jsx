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

const EMPTY_STATE = {
  items: [],
  alerts: [],
  summary: {},
  inbox: { available: false, items: [], summary: {}, warning: null }
};

const EMPTY_MONITOR = {
  available: false,
  monitorActive: false,
  configured: false,
  intervalMinutes: 15,
  warning: null,
  state: null
};

export default function WatchlistClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState(EMPTY_STATE);
  const [monitor, setMonitor] = useState(EMPTY_MONITOR);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function loadMonitor() {
    try {
      const response = await fetch("/api/cloud/watchlist-monitor", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist Monitor unavailable");
      setMonitor({ ...EMPTY_MONITOR, ...payload });
    } catch {
      setMonitor(EMPTY_MONITOR);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist unavailable");
      setState({ ...EMPTY_STATE, ...payload, inbox: { ...EMPTY_STATE.inbox, ...(payload.inbox || {}) } });
      await loadMonitor();
    } catch (loadError) {
      setState(EMPTY_STATE);
      setMonitor(EMPTY_MONITOR);
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

  async function markRead(id = null) {
    const busyKey = id || "all-alerts";
    setBusyId(busyKey);
    setError("");
    try {
      const response = await fetch("/api/cloud/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAllRead: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Alert update failed");
      setState((current) => ({
        ...current,
        inbox: {
          ...current.inbox,
          available: true,
          items: payload.items || [],
          summary: payload.summary || {}
        }
      }));
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : tr({ fi: "Hälytystä ei voitu kuitata.", en: "The alert could not be marked read.", es: "No se pudo marcar la alerta como leída." }));
    } finally {
      setBusyId(null);
    }
  }

  const summary = state.summary || {};
  const inboxSummary = state.inbox?.summary || {};
  const inboxItems = state.inbox?.available ? state.inbox.items || [] : state.alerts || [];
  const monitorState = monitor.state || {};
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const monitorLabel = monitor.monitorActive
    ? tr({ fi: "Aktiivinen", en: "Active", es: "Activo" })
    : monitor.configured
      ? tr({ fi: "Määritetty, ei aktivoitu", en: "Configured, not enabled", es: "Configurado, no activado" })
      : tr({ fi: "Ei määritetty", en: "Not configured", es: "No configurado" });

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">Watchlist V2 · Alert Inbox V2 · Monitor V1</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Seuraa oikeita otteluita ja säilytä muutokset", en: "Track verified fixtures and keep the changes", es: "Sigue partidos verificados y conserva los cambios" })}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "Palvelin vertaa nykytilaa lisäyshetkeen. Kun taustaseuranta on tuotannossa aktivoitu, tarkistus voidaan tehdä myös suojatulla 15 minuutin ajolla. Sovellus ei keksi puuttuvaa dataa eikä aseta vetoja.", en: "The server compares the current state with the added state. When production background monitoring is enabled, a protected 15-minute worker can also perform the check. The app does not invent missing data or place bets.", es: "El servidor compara el estado actual con el momento de alta. Cuando el seguimiento en segundo plano está activado, un proceso protegido de 15 minutos también puede hacer la comprobación. La app no inventa datos ni realiza apuestas." })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => void load()} disabled={loading} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä seuranta", en: "Refresh watchlist", es: "Actualizar lista" })}</button>
          <Link href="/betting" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Etsi seurattava kohde", en: "Find a selection to watch", es: "Buscar una selección" })}</Link>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}{error.toLowerCase().includes("auth") || error.toLowerCase().includes("session") ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div>}
      {state.inbox?.warning && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{state.inbox.warning}</div>}
      {monitor.warning && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{monitor.warning}</div>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-black text-emerald-300">Watchlist Monitor V1</div>
            <h2 className="mt-1 text-2xl font-black">{monitorLabel}</h2>
            <p className="mt-2 text-sm text-slate-400">{tr({ fi: "Tausta-ajo käyttää samaa todennettua analyysiä kuin käsin tehtävä päivitys. Käyttäjä ei voi käynnistää suojattua workeria selaimesta.", en: "The background worker uses the same verified analysis as manual refresh. A user cannot invoke the protected worker from the browser.", es: "El proceso en segundo plano usa el mismo análisis verificado que la actualización manual. El usuario no puede invocar el proceso protegido desde el navegador." })}</p>
          </div>
          <div className={`rounded-full border px-3 py-2 text-xs font-black ${monitor.monitorActive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-400/20 bg-slate-400/10 text-slate-300"}`}>{monitor.monitorActive ? "ON" : "OFF"}</div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Info label={tr({ fi: "Viimeisin ajo", en: "Last run", es: "Última ejecución" })} value={date(monitorState.last_completed_at)} />
          <Info label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={monitorState.last_status || "–"} />
          <Info label={tr({ fi: "Kohteita", en: "Items", es: "Elementos" })} value={String(monitorState.last_items_count ?? "–")} />
          <Info label={tr({ fi: "Hälytyksiä", en: "Alerts", es: "Alertas" })} value={String(monitorState.last_alerts_count ?? "–")} />
          <Info label={tr({ fi: "Tilannekuvia", en: "Snapshots", es: "Instantáneas" })} value={String(monitorState.last_snapshots_count ?? "–")} />
        </div>
        {monitorState.last_error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{monitorState.last_error}</div>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={tr({ fi: "Seurattuja", en: "Watched", es: "Seguidos" })} value={summary.watched || 0} />
        <Metric label={tr({ fi: "Aktiivisia kohteita", en: "Active picks", es: "Pronósticos activos" })} value={summary.active || 0} />
        <Metric label={tr({ fi: "Lukemattomia", en: "Unread", es: "No leídas" })} value={inboxSummary.unread ?? summary.alerts ?? 0} tone="text-fuchsia-300" />
        <Metric label={tr({ fi: "Aktiivisia hälytyksiä", en: "Active alerts", es: "Alertas activas" })} value={inboxSummary.active ?? summary.alerts ?? 0} />
        <Metric label={tr({ fi: "Korkea", en: "High", es: "Alta" })} value={inboxSummary.high ?? summary.high ?? 0} tone="text-red-300" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={tr({ fi: "Seurattavat kohteet", en: "Watched selections", es: "Selecciones seguidas" })} subtitle={tr({ fi: "Nykytila verrattuna lisäyshetkeen", en: "Current state versus added state", es: "Estado actual frente al momento de alta" })}>
          <div className="space-y-4">
            {!loading && state.items?.length === 0 && <Empty text={tr({ fi: "Seurantalista on tyhjä. Lisää oikea live-API-kohde Kohteista tai AI-sivulta.", en: "The watchlist is empty. Add a verified live-API selection from Picks or AI.", es: "La lista está vacía. Añade una selección verificada desde Pronósticos o IA." })} />}
            {(state.items || []).map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="text-sm font-bold text-emerald-300">{date(item.commence_time)}</div><h2 className="mt-1 text-xl font-black">{item.match}</h2><p className="mt-1 text-slate-300">{item.selection} · {Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</p></div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-black ${item.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-400/20 bg-slate-400/10 text-slate-300"}`}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><Info label={tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} value={`${item.added_decision} → ${item.current?.decision || "–"}`} /><Info label={tr({ fi: "Hintamuutos", en: "Price move", es: "Cambio de cuota" })} value={percent(item.oddsMove)} /><Info label={tr({ fi: "PLAY-raja", en: "PLAY floor", es: "Límite PLAY" })} value={item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"} /></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-400">{tr({ fi: "Hälytä hintaliikkeestä (%)", en: "Alert price move (%)", es: "Alertar cambio de cuota (%)" })}<input type="number" min="0.5" max="50" step="0.5" defaultValue={(Number(item.alert_move_percent || 0.05) * 100).toFixed(1)} onBlur={(event) => void updateItem(item, { alertMovePercent: Math.max(0.005, Math.min(0.5, Number(event.target.value || 5) / 100)) })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label><label className="text-sm text-slate-400">{tr({ fi: "Hälytä ennen alkua (min)", en: "Alert before kickoff (min)", es: "Alertar antes del inicio (min)" })}<input type="number" min="15" max="10080" step="15" defaultValue={item.alert_before_minutes || 120} onBlur={(event) => void updateItem(item, { alertBeforeMinutes: Number(event.target.value || 120) })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label></div>
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={busyId === item.id} onClick={() => void updateItem(item, { active: !item.active })} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">{item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })}</button><button disabled={busyId === item.id} onClick={() => void removeItem(item)} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200">{tr({ fi: "Poista", en: "Remove", es: "Eliminar" })}</button></div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Alert Inbox", en: "Alert Inbox", es: "Buzón de alertas" })} subtitle={tr({ fi: "Deduplikoitu aktiivinen ja ratkaistu historia", en: "Deduplicated active and resolved history", es: "Historial activo y resuelto sin duplicados" })}>
          <div className="space-y-3">
            {state.inbox?.available && Number(inboxSummary.unread || 0) > 0 && <button disabled={busyId !== null} onClick={() => void markRead()} className="w-full rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-200">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all as read", es: "Marcar todas como leídas" })}</button>}
            {inboxItems.map((item) => {
              const unread = state.inbox?.available ? !item.read_at : false;
              const active = state.inbox?.available ? item.active : true;
              return <div key={item.id || item.fingerprint} className={`rounded-2xl border p-4 ${severityClass(item.severity)} ${unread ? "ring-1 ring-fuchsia-300/40" : "opacity-85"}`}><div className="flex items-center justify-between gap-2"><div className="text-xs font-black uppercase tracking-wider">{item.severity} · {active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}</div>{unread && <span className="rounded-full bg-fuchsia-300 px-2 py-1 text-[10px] font-black text-slate-950">{tr({ fi: "UUSI", en: "NEW", es: "NUEVA" })}</span>}</div><div className="mt-1 font-black">{item.title}</div><div className="mt-1 text-sm opacity-85">{item.message}</div><div className="mt-2 text-xs opacity-70">{item.match} · {item.selection}</div>{state.inbox?.available && unread && <button disabled={busyId !== null} onClick={() => void markRead(item.id)} className="mt-3 rounded-lg border border-white/15 bg-black/10 px-3 py-2 text-xs font-black">{tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" })}</button>}</div>;
            })}
            {!loading && inboxItems.length === 0 && <Empty text={tr({ fi: "Inboxissa ei ole todennettuja muutoksia.", en: "There are no verified changes in the inbox.", es: "No hay cambios verificados en el buzón." })} />}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>; }
function Info({ label, value }) { return <div className="rounded-xl bg-slate-950/60 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black">{value}</div></div>; }
function Empty({ text }) { return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{text}</div>; }