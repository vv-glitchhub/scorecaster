"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localizedAlertCopy } from "../../lib/alert-inbox-copy.mjs";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";

const DEFAULT_SETTINGS = {
  enabled: true,
  minimum_severity: "info",
  kickoff_enabled: true,
  price_enabled: true,
  decision_enabled: true,
  availability_enabled: true
};
const EMPTY = {
  available: false,
  v2Available: false,
  settingsAvailable: false,
  items: [],
  summary: {},
  settings: DEFAULT_SETTINGS,
  warning: null
};
const FILTERS = ["all", "unread", "active", "resolved"];

function severityClass(severity) {
  if (severity === "high") return "border-red-400/30 bg-red-400/10 text-red-100";
  if (severity === "medium") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-100";
  return "border-sky-400/30 bg-sky-400/10 text-sky-100";
}

export default function AlertInboxClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState(EMPTY);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function fetchInbox(status = filter) {
    const response = await fetch(`/api/cloud/alerts?status=${encodeURIComponent(status)}&limit=100`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Alert Inbox unavailable");
    setState({ ...EMPTY, ...payload, settings: { ...DEFAULT_SETTINGS, ...(payload.settings || {}) } });
    return payload;
  }

  async function refresh(status = filter) {
    setLoading(true);
    setError("");
    try {
      const watchlist = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      const watchPayload = await watchlist.json();
      if (!watchlist.ok) throw new Error(watchPayload?.error || "Watchlist synchronization failed");
      await fetchInbox(status);
    } catch (loadError) {
      setState(EMPTY);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Inboxia ei voitu ladata.", en: "The inbox could not be loaded.", es: "No se pudo cargar el buzón." }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh("all"); }, []);

  async function action(key, method, body) {
    setBusy(key);
    setError("");
    try {
      const response = await fetch("/api/cloud/alerts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Alert Inbox update failed");
      await fetchInbox(filter);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : tr({ fi: "Inboxia ei voitu päivittää.", en: "The inbox could not be updated.", es: "No se pudo actualizar el buzón." }));
    } finally {
      setBusy("");
    }
  }

  async function saveSettings(changes) {
    const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}), ...changes };
    await action("settings", "PUT", {
      enabled: settings.enabled,
      minimumSeverity: settings.minimum_severity,
      kickoffEnabled: settings.kickoff_enabled,
      priceEnabled: settings.price_enabled,
      decisionEnabled: settings.decision_enabled,
      availabilityEnabled: settings.availability_enabled
    });
    await refresh(filter);
  }

  async function chooseFilter(value) {
    setFilter(value);
    setLoading(true);
    try { await fetchInbox(value); }
    catch (filterError) { setError(filterError instanceof Error ? filterError.message : "Alert Inbox unavailable"); }
    finally { setLoading(false); }
  }

  const settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  const summary = state.summary || {};
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const label = (value) => ({
    all: tr({ fi: "Kaikki", en: "All", es: "Todas" }),
    unread: tr({ fi: "Lukemattomat", en: "Unread", es: "No leídas" }),
    active: tr({ fi: "Aktiiviset", en: "Active", es: "Activas" }),
    resolved: tr({ fi: "Ratkaistut", en: "Resolved", es: "Resueltas" })
  }[value]);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.16),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-200">Alert Inbox V2</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Varmennetut muutokset omilla asetuksillasi", en: "Verified changes with your own settings", es: "Cambios verificados con tu configuración" })}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "Inbox käyttää vain palvelimen muodostamia Watchlist-hälytyksiä. Tapahtumat lokalisoidaan valitulle kielelle, eikä käyttäjä voi lähettää omaa hälytystekstiä.", en: "The inbox uses only server-generated Watchlist alerts. Events are localized to the selected language, and users cannot submit custom alert text.", es: "El buzón usa solo alertas de la lista generadas por el servidor. Los eventos se localizan al idioma elegido y el usuario no puede enviar texto de alerta." })}</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void refresh(filter)} disabled={loading || Boolean(busy)} className="rounded-2xl bg-fuchsia-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Synkronoi ja päivitä", en: "Synchronize and refresh", es: "Sincronizar y actualizar" })}</button><Link href="/watchlist" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Avaa seurantalista", en: "Open Watchlist", es: "Abrir lista" })}</Link></div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}</div>}
      {state.warning && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{state.warning}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label={tr({ fi: "Näkyviä", en: "Visible", es: "Visibles" })} value={summary.total || 0} />
        <Metric label={tr({ fi: "Lukemattomia", en: "Unread", es: "No leídas" })} value={summary.unread || 0} tone="text-fuchsia-300" />
        <Metric label={tr({ fi: "Aktiivisia", en: "Active", es: "Activas" })} value={summary.active || 0} />
        <Metric label={tr({ fi: "Korkeita", en: "High", es: "Altas" })} value={summary.high || 0} tone="text-red-300" />
        <Metric label={tr({ fi: "Ratkaistuja", en: "Resolved", es: "Resueltas" })} value={summary.resolved || 0} />
        <Metric label={tr({ fi: "Poistettuja", en: "Dismissed", es: "Eliminadas" })} value={summary.dismissed || 0} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={tr({ fi: "Inbox", en: "Inbox", es: "Buzón" })} subtitle={tr({ fi: "Aktiivinen ja ratkaistu historia ilman kaksoiskappaleita", en: "Active and resolved history without duplicates", es: "Historial activo y resuelto sin duplicados" })}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{FILTERS.map((value) => <button key={value} onClick={() => void chooseFilter(value)} disabled={loading || Boolean(busy)} className={`rounded-full border px-3 py-2 text-xs font-black ${filter === value ? "border-fuchsia-300 bg-fuchsia-300 text-slate-950" : "border-white/10 bg-white/5 text-slate-300"}`}>{label(value)}</button>)}</div>
            {Number(summary.unread || 0) > 0 && <button onClick={() => void action("all-read", "PATCH", { markAllRead: true })} disabled={Boolean(busy)} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-black text-fuchsia-200">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all read", es: "Marcar todas leídas" })}</button>}
            {(state.items || []).map((item) => {
              const copy = localizedAlertCopy(item, tr);
              const unread = !item.read_at;
              return <article key={item.id} className={`rounded-2xl border p-5 ${severityClass(item.severity)} ${unread ? "ring-1 ring-fuchsia-300/40" : "opacity-85"}`}><div className="flex items-start justify-between gap-3"><div className="text-xs font-black uppercase tracking-wider">{item.severity} · {item.active ? tr({ fi: "aktiivinen", en: "active", es: "activa" }) : tr({ fi: "ratkaistu", en: "resolved", es: "resuelta" })}</div><div className="text-xs opacity-70">{date(item.last_seen_at)}</div></div><h2 className="mt-2 text-lg font-black">{copy.title}</h2><p className="mt-2 text-sm leading-6 opacity-90">{copy.message}</p><p className="mt-2 text-xs opacity-70">{item.match} · {item.selection}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void action(`read-${item.id}`, "PATCH", { id: item.id, read: unread })} disabled={Boolean(busy)} className="rounded-lg border border-white/15 bg-black/10 px-3 py-2 text-xs font-black">{unread ? tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar leída" }) : tr({ fi: "Merkitse lukemattomaksi", en: "Mark unread", es: "Marcar no leída" })}</button>{state.v2Available && <button onClick={() => void action(`dismiss-${item.id}`, "DELETE", { id: item.id })} disabled={Boolean(busy)} className="rounded-lg border border-red-300/20 bg-red-950/20 px-3 py-2 text-xs font-black">{tr({ fi: "Poista inboxista", en: "Remove from inbox", es: "Eliminar del buzón" })}</button>}</div></article>;
            })}
            {!loading && (state.items || []).length === 0 && <Empty text={tr({ fi: "Tällä suodattimella ei ole todennettuja muutoksia.", en: "There are no verified changes for this filter.", es: "No hay cambios verificados para este filtro." })} />}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Asetukset", en: "Settings", es: "Configuración" })} subtitle={tr({ fi: "Vaikuttaa seuraavaan synkronointiin", en: "Applies to the next synchronization", es: "Se aplica a la próxima sincronización" })}>
          <div className="space-y-3">
            <Toggle label={tr({ fi: "Alert Inbox käytössä", en: "Alert Inbox enabled", es: "Buzón activado" })} checked={settings.enabled} disabled={!state.settingsAvailable || Boolean(busy)} onChange={(checked) => saveSettings({ enabled: checked })} />
            <label className="block text-sm text-slate-300">{tr({ fi: "Vähimmäistaso", en: "Minimum severity", es: "Severidad mínima" })}<select value={settings.minimum_severity} onChange={(event) => void saveSettings({ minimum_severity: event.target.value })} disabled={!state.settingsAvailable || Boolean(busy)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white"><option value="info">INFO</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label>
            <Toggle label={tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" })} checked={settings.kickoff_enabled} disabled={!state.settingsAvailable || Boolean(busy)} onChange={(checked) => saveSettings({ kickoff_enabled: checked })} />
            <Toggle label={tr({ fi: "Hintamuutokset", en: "Price changes", es: "Cambios de cuota" })} checked={settings.price_enabled} disabled={!state.settingsAvailable || Boolean(busy)} onChange={(checked) => saveSettings({ price_enabled: checked })} />
            <Toggle label={tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" })} checked={settings.decision_enabled} disabled={!state.settingsAvailable || Boolean(busy)} onChange={(checked) => saveSettings({ decision_enabled: checked })} />
            <Toggle label={tr({ fi: "Saatavuus ja seuranta-ajan päättyminen", en: "Availability and expired watch", es: "Disponibilidad y seguimiento vencido" })} checked={settings.availability_enabled} disabled={!state.settingsAvailable || Boolean(busy)} onChange={(checked) => saveSettings({ availability_enabled: checked })} />
            <p className="text-xs leading-5 text-slate-500">{tr({ fi: "Alert Inbox V2 on sovelluksen sisäinen ja käyttäjän synkronoima. Se ei pyydä laitteen ilmoituslupaa eikä väitä taustatoimitusta.", en: "Alert Inbox V2 is in-app and user-synchronized. It does not request device notification permission or claim background delivery.", es: "Alert Inbox V2 es interno y se sincroniza por el usuario. No solicita permiso de notificaciones ni afirma entrega en segundo plano." })}</p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>; }
function Empty({ text }) { return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">{text}</div>; }
function Toggle({ label, checked, disabled, onChange }) { return <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200"><span>{label}</span><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => void onChange(event.target.checked)} className="h-5 w-5 accent-fuchsia-300" /></label>; }
