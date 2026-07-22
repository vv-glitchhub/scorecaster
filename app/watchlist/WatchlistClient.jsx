"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

function percent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
  return `${(Number(value) * 100).toFixed(1)} %`;
}

function teamsFromMatch(match = "") {
  const parts = String(match).split(/\s+(?:vs\.?|v|–|—|-)+\s+/i).map((value) => value.trim()).filter(Boolean);
  return { homeTeam: parts[0] || match || "Home", awayTeam: parts[1] || "Away" };
}

function severityClass(severity) {
  if (severity === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (severity === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-sky-400/30 bg-sky-400/10 text-sky-200";
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
      <PageHero
        eyebrow="Daily Flow V3 · Watchlist V2"
        title={tr({ fi: "Seuraa hinnan ja päätöksen muutoksia ilman jatkuvaa selaamista", en: "Track price and decision changes without constantly checking", es: "Sigue cambios de cuota y decisión sin revisar constantemente" })}
        description={tr({
          fi: "Palvelin vertaa nykytilaa lisäyshetkeen. Suojattu monitori voi tarkistaa kohteet 15 minuutin välein, mutta sovellus ei keksi puuttuvaa dataa eikä aseta vetoja.",
          en: "The server compares the current state with the added state. A protected monitor may check selections every 15 minutes, but the app does not invent missing data or place bets.",
          es: "El servidor compara el estado actual con el momento de alta. Un monitor protegido puede comprobar cada 15 minutos, pero la app no inventa datos ni realiza apuestas."
        })}
        actions={
          <>
            <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-primary disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä seuranta", en: "Refresh watchlist", es: "Actualizar lista" })}</button>
            <Link href="/events" className="sc-button-secondary">{tr({ fi: "Etsi ottelu", en: "Find an event", es: "Buscar evento" })}</Link>
            <Link href="/alerts" className="sc-button-ghost">{tr({ fi: "Avaa kaikki hälytykset", en: "Open all alerts", es: "Abrir todas las alertas" })}</Link>
          </>
        }
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Seurattuja", en: "Watched", es: "Seguidos" })} value={loading ? "…" : summary.watched || 0} tone="green" /><MetricTile compact label={tr({ fi: "Aktiivisia", en: "Active", es: "Activos" })} value={loading ? "…" : summary.active || 0} tone="blue" /><MetricTile compact label={tr({ fi: "Lukemattomia", en: "Unread", es: "No leídas" })} value={loading ? "…" : inboxSummary.unread ?? summary.alerts ?? 0} tone="purple" /><MetricTile compact label={tr({ fi: "Korkea", en: "High", es: "Alta" })} value={loading ? "…" : inboxSummary.high ?? summary.high ?? 0} tone="red" /></div>}
      />

      <TrustBar items={[
        { label: "Watchlist Monitor V1", value: monitorLabel, tone: monitor.monitorActive ? "good" : "warning" },
        { label: tr({ fi: "Tarkistusväli", en: "Check interval", es: "Intervalo" }), value: `${monitor.intervalMinutes || 15} min`, tone: "info" },
        { label: tr({ fi: "Viimeisin ajo", en: "Last run", es: "Última ejecución" }), value: date(monitorState.last_completed_at), tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain varmennettu seuranta", en: "verified tracking only", es: "solo seguimiento verificado" }), tone: "warning" }
      ]} />

      {error && <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}{error.toLowerCase().includes("auth") || error.toLowerCase().includes("session") ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div>}
      {state.inbox?.warning && <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">{state.inbox.warning}</div>}
      {monitor.warning && <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">{monitor.warning}</div>}

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Nykytila", en: "Current state", es: "Estado actual" })}
          title={tr({ fi: "Seurattavat kohteet", en: "Watched selections", es: "Selecciones seguidas" })}
          description={tr({ fi: "Näe lisäys- ja nykykerroin, päätöksen muutos sekä PLAY-raja yhdellä silmäyksellä.", en: "See added and current odds, decision change and PLAY floor at a glance.", es: "Consulta cuota inicial y actual, cambio de decisión y límite PLAY de un vistazo." })}
        />

        {!loading && state.items?.length === 0 ? (
          <EmptyState title={tr({ fi: "Seurantalista on tyhjä", en: "Watchlist is empty", es: "La lista está vacía" })} description={tr({ fi: "Lisää oikea live-API-kohde alla olevasta ehdokaslistasta tai Ottelut-sivulta.", en: "Add a verified live-API selection from the candidates below or the Events page.", es: "Añade una selección verificada desde los candidatos o la página Eventos." })} actionHref="/events" actionLabel={tr({ fi: "Avaa ottelut", en: "Open events", es: "Abrir eventos" })} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {(state.items || []).map((item) => {
              const teams = teamsFromMatch(item.match);
              return (
                <article key={item.id} className="sc-surface rounded-[1.55rem] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <MatchIdentity homeTeam={teams.homeTeam} awayTeam={teams.awayTeam} meta={`${date(item.commence_time)} · ${item.sport || item.league || "Watchlist"}`} />
                    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[0.14em] ${item.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"}`}>{item.active ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "TAUKO", en: "PAUSED", es: "PAUSADO" })}</span>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-faint)]">{tr({ fi: "Seurattava valinta", en: "Watched selection", es: "Selección seguida" })}</div>
                      <div className="mt-1 text-lg font-black text-[var(--sc-text)]">{item.selection}</div>
                    </div>
                    <div className="text-left sm:text-right"><div className="text-xs text-[var(--sc-muted)]">{tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })}</div><div className="mt-1 text-xl font-black text-[var(--sc-brand)]">{Number(item.added_odds || 0).toFixed(2)} → {item.current?.odds ? Number(item.current.odds).toFixed(2) : "–"}</div></div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetricTile compact label={tr({ fi: "Hintamuutos", en: "Price move", es: "Cambio" })} value={percent(item.oddsMove)} tone={Number(item.oddsMove || 0) < 0 ? "red" : "blue"} />
                    <MetricTile compact label={tr({ fi: "PLAY-raja", en: "PLAY floor", es: "Límite PLAY" })} value={item.current?.minimumPlayOdds ? Number(item.current.minimumPlayOdds).toFixed(2) : "–"} tone="yellow" />
                    <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3.5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}</div><div className="mt-2 flex flex-wrap items-center gap-2"><DecisionBadge decision={item.added_decision || "CAUTION"} /><span className="text-[var(--sc-faint)]">→</span><DecisionBadge decision={item.current?.decision || "CAUTION"} /></div></div>
                  </div>

                  <details className="mt-4 rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                    <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Muokkaa hälytysrajoja", en: "Edit alert thresholds", es: "Editar límites de alerta" })}</summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Hälytä hintaliikkeestä (%)", en: "Alert price move (%)", es: "Alertar cambio de cuota (%)" })}<input type="number" min="0.5" max="50" step="0.5" defaultValue={(Number(item.alert_move_percent || 0.05) * 100).toFixed(1)} onBlur={(event) => void updateItem(item, { alertMovePercent: Math.max(0.005, Math.min(0.5, Number(event.target.value || 5) / 100)) })} className="sc-input mt-2" /></label>
                      <label className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Hälytä ennen alkua (min)", en: "Alert before kickoff (min)", es: "Alertar antes del inicio (min)" })}<input type="number" min="15" max="10080" step="15" defaultValue={item.alert_before_minutes || 120} onBlur={(event) => void updateItem(item, { alertBeforeMinutes: Number(event.target.value || 120) })} className="sc-input mt-2" /></label>
                    </div>
                  </details>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busyId === item.id} onClick={() => void updateItem(item, { active: !item.active })} className="sc-button-secondary disabled:opacity-40">{item.active ? tr({ fi: "Keskeytä", en: "Pause", es: "Pausar" }) : tr({ fi: "Aktivoi", en: "Activate", es: "Activar" })}</button>
                    <button type="button" disabled={busyId === item.id} onClick={() => void removeItem(item)} className="min-h-12 rounded-[0.9rem] border border-rose-400/25 bg-rose-400/10 px-4 text-sm font-black text-rose-300 disabled:opacity-40">{tr({ fi: "Poista", en: "Remove", es: "Eliminar" })}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="sc-surface rounded-[1.55rem] p-5 sm:p-6">
          <SectionHeader title={tr({ fi: "Watchlist Monitor V1", en: "Watchlist Monitor V1", es: "Watchlist Monitor V1" })} description={tr({ fi: "Tekninen tila on näkyvissä auditointia varten, mutta käyttäjän ei tarvitse käynnistää suojattua workeria selaimesta.", en: "Technical state remains visible for audit, but users do not invoke the protected worker from the browser.", es: "El estado técnico queda visible para auditoría, pero el usuario no inicia el worker protegido desde el navegador." })} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricTile label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={monitorState.last_status || "–"} tone={monitor.monitorActive ? "green" : "yellow"} />
            <MetricTile label={tr({ fi: "Kohteita", en: "Items", es: "Elementos" })} value={String(monitorState.last_items_count ?? "–")} />
            <MetricTile label={tr({ fi: "Hälytyksiä", en: "Alerts", es: "Alertas" })} value={String(monitorState.last_alerts_count ?? "–")} tone="purple" />
            <MetricTile label={tr({ fi: "Tilannekuvia", en: "Snapshots", es: "Instantáneas" })} value={String(monitorState.last_snapshots_count ?? "–")} tone="blue" />
            <MetricTile label={tr({ fi: "Viimeisin valmistuminen", en: "Last completion", es: "Última finalización" })} value={date(monitorState.last_completed_at)} />
            <MetricTile label={tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Próxima comprobación" })} value={date(monitorState.next_check_at)} />
          </div>
          {monitorState.last_error && <div className="mt-4 rounded-[1.1rem] border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{monitorState.last_error}</div>}
        </div>

        <div className="sc-surface rounded-[1.55rem] p-5 sm:p-6">
          <SectionHeader title={tr({ fi: "Uusimmat hälytykset", en: "Latest alerts", es: "Alertas recientes" })} description={tr({ fi: "Täysi suodatus ja palautettava piilotus löytyvät Alert Inboxista.", en: "Full filtering and reversible dismissal are available in Alert Inbox.", es: "El filtrado completo y la ocultación reversible están en Alert Inbox." })} action={<Link href="/alerts" className="sc-button-secondary">{tr({ fi: "Avaa inbox", en: "Open inbox", es: "Abrir buzón" })}</Link>} />
          <div className="space-y-3">
            {state.inbox?.available && Number(inboxSummary.unread || 0) > 0 && <button type="button" disabled={busyId !== null} onClick={() => void markRead()} className="w-full rounded-[0.9rem] border border-purple-400/30 bg-purple-400/10 px-4 py-3 text-sm font-black text-purple-300 disabled:opacity-50">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all as read", es: "Marcar todas como leídas" })}</button>}
            {inboxItems.slice(0, 4).map((item) => {
              const unread = state.inbox?.available ? !item.read_at : false;
              const active = state.inbox?.available ? item.active : true;
              return <article key={item.id || item.fingerprint} className={`rounded-[1.2rem] border p-4 ${severityClass(item.severity)} ${unread ? "ring-1 ring-purple-300/40" : "opacity-85"}`}><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-[0.16em]">{item.severity} · {active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}</div>{unread && <span className="rounded-full bg-purple-300 px-2 py-1 text-[10px] font-black text-slate-950">{tr({ fi: "UUSI", en: "NEW", es: "NUEVA" })}</span>}</div><div className="mt-2 font-black">{item.title}</div><div className="mt-1 text-sm opacity-85">{item.message}</div><div className="mt-2 text-xs opacity-70">{item.match} · {item.selection}</div>{state.inbox?.available && unread && <button type="button" disabled={busyId !== null} onClick={() => void markRead(item.id)} className="mt-3 rounded-lg border border-current/20 bg-black/10 px-3 py-2 text-xs font-black">{tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" })}</button>}</article>;
            })}
            {!loading && inboxItems.length === 0 && <EmptyState title={tr({ fi: "Ei uusia varmennettuja muutoksia", en: "No new verified changes", es: "No hay nuevos cambios verificados" })} />}
          </div>
        </div>
      </section>
    </div>
  );
}
