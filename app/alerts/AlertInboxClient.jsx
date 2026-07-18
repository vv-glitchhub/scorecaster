"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";

const EMPTY = {
  available: false,
  v2Available: false,
  warning: null,
  summary: {},
  items: []
};

function severityClass(severity) {
  if (severity === "high") return "border-red-400/30 bg-red-400/10 text-red-100";
  if (severity === "medium") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return "border-sky-400/30 bg-sky-400/10 text-sky-100";
}

function odds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : "–";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
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
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.2),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-200">Alert Inbox V2</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Todennetut muutokset yhdessä inboxissa", en: "Verified changes in one inbox", es: "Cambios verificados en un solo buzón" })}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "Hälytykset syntyvät vain palvelimen todentamista seurantalistan muutoksista. Voit merkitä ne luetuiksi, piilottaa ne palautettavasti tai tarkastella ratkaistua historiaa.", en: "Alerts are created only from server-verified watchlist changes. Mark them read, dismiss them reversibly, or inspect resolved history.", es: "Las alertas solo se crean a partir de cambios verificados por el servidor. Márcalas como leídas, ocúltalas de forma reversible o consulta el historial resuelto." })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void load(status)} disabled={loading || Boolean(busy)} className="rounded-2xl bg-fuchsia-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä inbox", en: "Refresh inbox", es: "Actualizar buzón" })}</button>
          <Link href="/watchlist" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link>
          <Link href="/profile" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Ilmoitusasetukset", en: "Notification settings", es: "Configuración" })}</Link>
          <a href="/api/account/alert-inbox-export" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Vie JSON", en: "Export JSON", es: "Exportar JSON" })}</a>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}{error.toLowerCase().includes("auth") || error.toLowerCase().includes("session") ? <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link> : null}</div>}
      {state.warning && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{state.warning}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={tr({ fi: "Näkyviä", en: "Visible", es: "Visibles" })} value={summary.total || 0} />
        <Metric label={tr({ fi: "Lukemattomia", en: "Unread", es: "No leídas" })} value={summary.unread || 0} tone="text-fuchsia-300" />
        <Metric label={tr({ fi: "Aktiivisia", en: "Active", es: "Activas" })} value={summary.active || 0} />
        <Metric label={tr({ fi: "Ratkaistuja", en: "Resolved", es: "Resueltas" })} value={summary.resolved || 0} />
        <Metric label={tr({ fi: "Piilotettuja", en: "Dismissed", es: "Ocultas" })} value={summary.dismissed || 0} tone="text-slate-300" />
      </section>

      <Panel title={tr({ fi: "Hälytyshistoria", en: "Alert history", es: "Historial de alertas" })} subtitle={tr({ fi: "Käyttäjäkohtainen, deduplikoitu ja palautettava", en: "User-isolated, deduplicated and reversible", es: "Aislado por usuario, sin duplicados y reversible" })}>
        <div className="flex flex-wrap gap-2">
          {statuses.map(([key, label]) => <button type="button" key={key} onClick={() => setStatus(key)} disabled={loading || Boolean(busy)} className={`rounded-full border px-4 py-2 text-sm font-black disabled:opacity-50 ${status === key ? "border-fuchsia-300 bg-fuchsia-300 text-slate-950" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>{label}</button>)}
        </div>

        {status !== "dismissed" && Number(summary.unread || 0) > 0 && <button type="button" onClick={() => void mutate({ markAllRead: true }, "all")} disabled={Boolean(busy)} className="mt-4 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-200 disabled:opacity-50">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all as read", es: "Marcar todas como leídas" })}</button>}

        <div className="mt-5 space-y-4">
          {!loading && state.items.length === 0 && <Empty text={tr({ fi: "Tässä näkymässä ei ole hälytyksiä.", en: "There are no alerts in this view.", es: "No hay alertas en esta vista." })} />}
          {state.items.map((item) => {
            const unread = !item.read_at;
            const dismissed = Boolean(item.dismissed_at);
            const details = item.details || {};
            return (
              <article key={item.id || item.fingerprint} className={`rounded-2xl border p-5 ${severityClass(item.severity)} ${unread && !dismissed ? "ring-1 ring-fuchsia-300/40" : "opacity-90"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] opacity-75">{typeLabel(item.alert_type)} · {item.severity}</div>
                    <h2 className="mt-2 text-xl font-black">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 opacity-90">{item.message}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase">
                    <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1">{item.active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}</span>
                    {unread && !dismissed && <span className="rounded-full bg-fuchsia-300 px-3 py-1 text-slate-950">{tr({ fi: "uusi", en: "new", es: "nueva" })}</span>}
                    {dismissed && <span className="rounded-full border border-slate-300/20 bg-slate-300/10 px-3 py-1">{tr({ fi: "piilotettu", en: "dismissed", es: "oculta" })}</span>}
                  </div>
                </div>

                <div className="mt-4 text-sm opacity-80">{item.match || "–"} · {item.selection || "–"}</div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <Info label={tr({ fi: "Lisäyskerroin", en: "Added odds", es: "Cuota inicial" })} value={odds(details.addedOdds)} />
                  <Info label={tr({ fi: "Nykykerroin", en: "Current odds", es: "Cuota actual" })} value={odds(details.currentOdds)} />
                  <Info label={tr({ fi: "Muutos", en: "Move", es: "Cambio" })} value={percent(details.oddsMove)} />
                  <Info label={tr({ fi: "Viimeksi nähty", en: "Last seen", es: "Última vez" })} value={date(item.last_seen_at)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!dismissed && unread && <button type="button" disabled={Boolean(busy)} onClick={() => void mutate({ id: item.id, action: "read" }, `read-${item.id}`)} className="rounded-xl border border-white/15 bg-black/10 px-4 py-2 text-sm font-black disabled:opacity-50">{tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" })}</button>}
                  {!dismissed && <button type="button" disabled={Boolean(busy) || !state.v2Available} onClick={() => void mutate({ id: item.id, action: "dismiss" }, `dismiss-${item.id}`)} className="rounded-xl border border-slate-300/20 bg-slate-300/10 px-4 py-2 text-sm font-black disabled:opacity-40">{tr({ fi: "Piilota", en: "Dismiss", es: "Ocultar" })}</button>}
                  {dismissed && <button type="button" disabled={Boolean(busy) || !state.v2Available} onClick={() => void mutate({ id: item.id, action: "restore" }, `restore-${item.id}`)} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 disabled:opacity-40">{tr({ fi: "Palauta inboxiin", en: "Restore to inbox", es: "Restaurar" })}</button>}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">{tr({ fi: "Alert Inbox ei lähetä taustailmoituksia eikä aseta vetoja. Ilmoitusasetukset määräävät, mitkä palvelimen todentamat ehdot tallennetaan. Piilotus ei poista auditointitietoa.", en: "Alert Inbox does not deliver background notifications or place bets. Notification settings determine which server-verified conditions are stored. Dismissal does not delete audit history.", es: "El buzón no envía notificaciones en segundo plano ni realiza apuestas. La configuración determina qué condiciones verificadas se guardan. Ocultar no elimina el historial de auditoría." })} <Link href="/privacy/alert-inbox-v2" className="font-black text-white underline">{tr({ fi: "Tietosuojatiedot", en: "Privacy details", es: "Detalles de privacidad" })}</Link></div>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>;
}

function Info({ label, value }) {
  return <div className="rounded-xl bg-slate-950/50 p-3"><div className="text-xs opacity-60">{label}</div><div className="mt-1 font-black">{value}</div></div>;
}

function Empty({ text }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">{text}</div>;
}
