"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

const EMPTY = {
  available: false,
  v2Available: false,
  warning: null,
  summary: {},
  items: []
};

function severityClass(severity) {
  if (severity === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (severity === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-sky-400/30 bg-sky-400/10 text-sky-200";
}

function odds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : "–";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

function teamsFromMatch(match = "") {
  const parts = String(match).split(/\s+(?:vs\.?|v|–|—|-)+\s+/i).map((value) => value.trim()).filter(Boolean);
  return { homeTeam: parts[0] || match || "Home", awayTeam: parts[1] || "Away" };
}

export default function AlertInboxClient() {
  const { tr, locale } = useLanguage();
  const [status, setStatus] = useState("all");
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const statuses = [
    ["all", tr({ fi: "Kaikki", en: "All", es: "Todas" })],
    ["unread", tr({ fi: "Lukemattomat", en: "Unread", es: "No leídas" })],
    ["active", tr({ fi: "Aktiiviset", en: "Active", es: "Activas" })],
    ["resolved", tr({ fi: "Ratkaistut", en: "Resolved", es: "Resueltas" })],
    ["dismissed", tr({ fi: "Piilotetut", en: "Dismissed", es: "Ocultas" })]
  ];

  async function load(nextStatus = status) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cloud/alerts?status=${encodeURIComponent(nextStatus)}&limit=100`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Alert Inbox unavailable");
      setState({ ...EMPTY, ...payload });
    } catch (loadError) {
      setState(EMPTY);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Alert Inboxia ei voitu ladata.", en: "Alert Inbox could not be loaded.", es: "No se pudo cargar el buzón." }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(status); }, [status]);

  async function mutate(body, key) {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/cloud/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Alert Inbox update failed");
      await load(status);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : tr({ fi: "Hälytystä ei voitu päivittää.", en: "The alert could not be updated.", es: "No se pudo actualizar la alerta." }));
    } finally {
      setBusy("");
    }
  }

  const summary = state.summary || {};
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime())
      ? "–"
      : parsed.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const typeLabel = (type) => {
    if (type === "kickoff_soon") return tr({ fi: "Ottelu alkaa", en: "Kickoff soon", es: "Inicio próximo" });
    if (type === "decision_changed") return tr({ fi: "Päätös muuttui", en: "Decision changed", es: "Decisión modificada" });
    if (type === "price_moved") return tr({ fi: "Kerroin muuttui", en: "Price moved", es: "Cuota modificada" });
    if (type === "below_play_price") return tr({ fi: "Alle PLAY-rajan", en: "Below PLAY floor", es: "Por debajo del límite PLAY" });
    return tr({ fi: "Seurantahälytys", en: "Watchlist alert", es: "Alerta de seguimiento" });
  };

  return (
    <div className="space-y-7">
      <PageHero
        tone="purple"
        eyebrow="Daily Flow V3 · Alert Inbox V2"
        title={tr({ fi: "Näe ensin hälytykset, jotka vaativat huomiota", en: "See the alerts that need attention first", es: "Consulta primero las alertas que requieren atención" })}
        description={tr({
          fi: "Inbox sisältää vain palvelimen todentamia seurantalistan muutoksia. Voit merkitä hälytyksen luetuksi, piilottaa sen palautettavasti tai tarkastella ratkaistua historiaa.",
          en: "The inbox contains only server-verified watchlist changes. Mark an alert read, dismiss it reversibly, or inspect resolved history.",
          es: "El buzón contiene solo cambios verificados por el servidor. Marca una alerta como leída, ocúltala de forma reversible o consulta el historial resuelto."
        })}
        actions={
          <>
            <button type="button" onClick={() => void load(status)} disabled={loading || Boolean(busy)} className="sc-button-primary disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä inbox", en: "Refresh inbox", es: "Actualizar buzón" })}</button>
            <Link href="/watchlist" className="sc-button-secondary">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link>
            <Link href="/profile" className="sc-button-ghost">{tr({ fi: "Ilmoitusasetukset", en: "Notification settings", es: "Configuración" })}</Link>
          </>
        }
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Lukemattomia", en: "Unread", es: "No leídas" })} value={loading ? "…" : summary.unread || 0} tone="purple" /><MetricTile compact label={tr({ fi: "Aktiivisia", en: "Active", es: "Activas" })} value={loading ? "…" : summary.active || 0} tone="blue" /><MetricTile compact label={tr({ fi: "Ratkaistuja", en: "Resolved", es: "Resueltas" })} value={loading ? "…" : summary.resolved || 0} tone="green" /><MetricTile compact label={tr({ fi: "Piilotettuja", en: "Dismissed", es: "Ocultas" })} value={loading ? "…" : summary.dismissed || 0} /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Näkyvä suodatin", en: "Visible filter", es: "Filtro visible" }), value: statuses.find(([key]) => key === status)?.[1] || status, tone: "info" },
        { label: tr({ fi: "Tallennus", en: "Storage", es: "Almacenamiento" }), value: state.v2Available ? "Alert Inbox V2" : "fallback", tone: state.v2Available ? "good" : "warning" },
        { label: tr({ fi: "Piilotus", en: "Dismissal", es: "Ocultación" }), value: tr({ fi: "palautettava", en: "reversible", es: "reversible" }), tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "ei taustailmoituksia tai vetoja", en: "no background delivery or bets", es: "sin avisos en segundo plano ni apuestas" }), tone: "warning" }
      ]} />

      {error && <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}{error.toLowerCase().includes("auth") || error.toLowerCase().includes("session") ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div>}
      {state.warning && <div className="rounded-[1.2rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">{state.warning}</div>}

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader
          eyebrow={tr({ fi: "Inbox", en: "Inbox", es: "Buzón" })}
          title={tr({ fi: "Hälytyshistoria", en: "Alert history", es: "Historial de alertas" })}
          description={tr({ fi: "Käyttäjäkohtainen, deduplikoitu ja palautettava. Uudet ja korkean vakavuuden muutokset erottuvat ensin.", en: "User-isolated, deduplicated and reversible. New and high-severity changes stand out first.", es: "Aislado por usuario, sin duplicados y reversible. Los cambios nuevos y graves destacan primero." })}
          action={<a href="/api/account/alert-inbox-export" className="sc-button-secondary">{tr({ fi: "Vie JSON", en: "Export JSON", es: "Exportar JSON" })}</a>}
        />

        <div className="flex flex-wrap gap-2">
          {statuses.map(([key, label]) => <button type="button" key={key} onClick={() => setStatus(key)} disabled={loading || Boolean(busy)} className={`min-h-11 rounded-full border px-4 text-sm font-black transition disabled:opacity-50 ${status === key ? "border-purple-300 bg-purple-300 text-slate-950 shadow-[0_12px_30px_rgba(192,132,252,0.18)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}>{label}</button>)}
        </div>

        {status !== "dismissed" && Number(summary.unread || 0) > 0 && <button type="button" onClick={() => void mutate({ markAllRead: true }, "all")} disabled={Boolean(busy)} className="mt-4 rounded-[0.9rem] border border-purple-400/30 bg-purple-400/10 px-4 py-3 text-sm font-black text-purple-300 disabled:opacity-50">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all as read", es: "Marcar todas como leídas" })}</button>}

        <div className="mt-5 space-y-4">
          {!loading && state.items.length === 0 && <EmptyState title={tr({ fi: "Tässä näkymässä ei ole hälytyksiä", en: "There are no alerts in this view", es: "No hay alertas en esta vista" })} description={tr({ fi: "Hälytys syntyy vasta, kun seurattu kohde muuttuu palvelimen todentamalla tavalla.", en: "An alert appears only after a watched selection changes in a server-verified way.", es: "Una alerta aparece solo cuando una selección seguida cambia de forma verificada." })} actionHref="/watchlist" actionLabel={tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })} />}

          {state.items.map((item) => {
            const unread = !item.read_at;
            const dismissed = Boolean(item.dismissed_at);
            const details = item.details || {};
            const teams = teamsFromMatch(item.match);
            return (
              <article key={item.id || item.fingerprint} className={`rounded-[1.45rem] border p-5 sm:p-6 ${severityClass(item.severity)} ${unread && !dismissed ? "ring-1 ring-purple-300/40" : "opacity-90"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{typeLabel(item.alert_type)} · {item.severity}</div>
                    <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{item.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">{item.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                    <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1.5">{item.active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}</span>
                    {unread && !dismissed && <span className="rounded-full bg-purple-300 px-3 py-1.5 text-slate-950">{tr({ fi: "uusi", en: "new", es: "nueva" })}</span>}
                    {dismissed && <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1.5">{tr({ fi: "piilotettu", en: "dismissed", es: "oculta" })}</span>}
                  </div>
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-current/15 bg-black/10 p-4">
                  <MatchIdentity homeTeam={teams.homeTeam} awayTeam={teams.awayTeam} meta={item.selection || tr({ fi: "Valinta puuttuu", en: "Selection unavailable", es: "Selección no disponible" })} compact />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricTile compact label={tr({ fi: "Lisäyskerroin", en: "Added odds", es: "Cuota inicial" })} value={odds(details.addedOdds)} />
                  <MetricTile compact label={tr({ fi: "Nykykerroin", en: "Current odds", es: "Cuota actual" })} value={odds(details.currentOdds)} tone="blue" />
                  <MetricTile compact label={tr({ fi: "Muutos", en: "Move", es: "Cambio" })} value={percent(details.oddsMove)} tone={Number(details.oddsMove || 0) < 0 ? "red" : "yellow"} />
                  <MetricTile compact label={tr({ fi: "Viimeksi nähty", en: "Last seen", es: "Última vez" })} value={date(item.last_seen_at)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!dismissed && unread && <button type="button" disabled={Boolean(busy)} onClick={() => void mutate({ id: item.id, action: "read" }, `read-${item.id}`)} className="min-h-11 rounded-[0.85rem] border border-current/20 bg-black/10 px-4 text-sm font-black disabled:opacity-50">{tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" })}</button>}
                  {!dismissed && <button type="button" disabled={Boolean(busy) || !state.v2Available} onClick={() => void mutate({ id: item.id, action: "dismiss" }, `dismiss-${item.id}`)} className="min-h-11 rounded-[0.85rem] border border-current/20 bg-black/10 px-4 text-sm font-black disabled:opacity-40">{tr({ fi: "Piilota", en: "Dismiss", es: "Ocultar" })}</button>}
                  {dismissed && <button type="button" disabled={Boolean(busy) || !state.v2Available} onClick={() => void mutate({ id: item.id, action: "restore" }, `restore-${item.id}`)} className="min-h-11 rounded-[0.85rem] border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-black text-emerald-200 disabled:opacity-40">{tr({ fi: "Palauta inboxiin", en: "Restore to inbox", es: "Restaurar" })}</button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">
        {tr({ fi: "Alert Inbox ei lähetä taustailmoituksia eikä aseta vetoja. Ilmoitusasetukset määräävät, mitkä palvelimen todentamat ehdot tallennetaan. Piilotus ei poista auditointitietoa.", en: "Alert Inbox does not deliver background notifications or place bets. Notification settings determine which server-verified conditions are stored. Dismissal does not delete audit history.", es: "El buzón no envía notificaciones en segundo plano ni realiza apuestas. La configuración determina qué condiciones verificadas se guardan. Ocultar no elimina el historial de auditoría." })} <Link href="/privacy/alert-inbox-v2" className="font-black text-[var(--sc-text)] underline">{tr({ fi: "Tietosuojatiedot", en: "Privacy details", es: "Detalles de privacidad" })}</Link>
      </div>
    </div>
  );
}
