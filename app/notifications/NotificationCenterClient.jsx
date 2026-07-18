"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";

const EMPTY = {
  items: [],
  summary: { total: 0, unread: 0, high: 0, unreadHigh: 0 },
  settings: {
    in_app_enabled: true,
    minimum_severity: "info",
    kickoff_enabled: true,
    price_enabled: true,
    decision_enabled: true,
    availability_enabled: true
  }
};

function tone(severity, read) {
  if (read) return "border-white/10 bg-white/[0.03]";
  if (severity === "high") return "border-red-400/30 bg-red-400/10";
  if (severity === "medium") return "border-yellow-400/30 bg-yellow-400/10";
  return "border-sky-400/25 bg-sky-400/10";
}

function localizeNotification(item, tr) {
  const details = item.payload || {};
  const odds = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";
  const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";

  if (item.notification_type === "kickoff_soon") {
    return {
      title: tr({ fi: "Ottelu alkaa pian", en: "Kickoff is approaching", es: "El partido comienza pronto" }),
      message: tr({ fi: `Seurattu ottelu alkaa noin ${details.minutesToKickoff ?? "–"} minuutin kuluttua.`, en: `The watched fixture starts in about ${details.minutesToKickoff ?? "–"} minutes.`, es: `El partido seguido comienza en unos ${details.minutesToKickoff ?? "–"} minutos.` })
    };
  }
  if (item.notification_type === "decision_changed") {
    return {
      title: tr({ fi: "Scorecaster-päätös muuttui", en: "Scorecaster decision changed", es: "Cambió la decisión de Scorecaster" }),
      message: tr({ fi: `Päätös muuttui ${details.addedDecision || "–"} → ${details.currentDecision || "–"}.`, en: `The decision changed from ${details.addedDecision || "–"} to ${details.currentDecision || "–"}.`, es: `La decisión cambió de ${details.addedDecision || "–"} a ${details.currentDecision || "–"}.` })
    };
  }
  if (item.notification_type === "price_moved") {
    return {
      title: tr({ fi: "Seurattu kerroin muuttui", en: "Tracked price moved", es: "Cambió la cuota seguida" }),
      message: tr({ fi: `Kerroin muuttui ${odds(details.addedOdds)} → ${odds(details.currentOdds)} (${percent(details.oddsMove)}).`, en: `The price moved from ${odds(details.addedOdds)} to ${odds(details.currentOdds)} (${percent(details.oddsMove)}).`, es: `La cuota cambió de ${odds(details.addedOdds)} a ${odds(details.currentOdds)} (${percent(details.oddsMove)}).` })
    };
  }
  if (item.notification_type === "below_play_price") {
    return {
      title: tr({ fi: "Hinta ei enää täytä PLAY-rajaa", en: "Price no longer meets the PLAY floor", es: "La cuota ya no supera el límite PLAY" }),
      message: tr({ fi: `Nykykerroin ${odds(details.currentOdds)} alittaa lasketun rajan ${odds(details.minimumPlayOdds)}.`, en: `Current odds ${odds(details.currentOdds)} are below the calculated floor ${odds(details.minimumPlayOdds)}.`, es: `La cuota actual ${odds(details.currentOdds)} está por debajo del límite calculado ${odds(details.minimumPlayOdds)}.` })
    };
  }
  if (item.notification_type === "market_unavailable") {
    return {
      title: tr({ fi: "Nykyinen markkina ei ole saatavilla", en: "Current market is unavailable", es: "El mercado actual no está disponible" }),
      message: tr({ fi: "Live-palvelu ei palauttanut vastaavaa markkinaa. Korvaavaa tietoa ei keksitty.", en: "The live provider did not return a matching market. No replacement data was invented.", es: "El proveedor en vivo no devolvió un mercado equivalente. No se inventaron datos de reemplazo." })
    };
  }
  return {
    title: tr({ fi: "Ottelun seuranta-aika päättyi", en: "Fixture passed the watch window", es: "El partido salió de la ventana de seguimiento" }),
    message: tr({ fi: "Suunniteltu alkamisaika on ohitettu. Tulosseuranta pysyy erillisenä.", en: "The scheduled start time has passed. Result tracking remains separate.", es: "La hora prevista ya pasó. El seguimiento de resultados permanece separado." })
  };
}

export default function NotificationCenterClient() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function request(method = "GET", body) {
    const response = await fetch("/api/cloud/notifications", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Notification Center unavailable");
    setState({ ...EMPTY, ...payload, summary: { ...EMPTY.summary, ...(payload.summary || {}) }, settings: { ...EMPTY.settings, ...(payload.settings || {}) } });
    return payload;
  }

  async function load() {
    setLoading(true);
    setError("");
    try { await request(); }
    catch (loadError) { setState(EMPTY); setError(loadError instanceof Error ? loadError.message : tr({ fi: "Ilmoituksia ei voitu ladata.", en: "Notifications could not be loaded.", es: "No se pudieron cargar las notificaciones." })); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function act(key, method, body) {
    setBusy(key);
    setError("");
    try { await request(method, body); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : tr({ fi: "Toiminto epäonnistui.", en: "The action failed.", es: "La acción falló." })); }
    finally { setBusy(""); }
  }

  async function saveSettings(changes) {
    const current = state.settings || EMPTY.settings;
    await act("settings", "PUT", {
      inAppEnabled: changes.in_app_enabled ?? current.in_app_enabled,
      minimumSeverity: changes.minimum_severity ?? current.minimum_severity,
      kickoffEnabled: changes.kickoff_enabled ?? current.kickoff_enabled,
      priceEnabled: changes.price_enabled ?? current.price_enabled,
      decisionEnabled: changes.decision_enabled ?? current.decision_enabled,
      availabilityEnabled: changes.availability_enabled ?? current.availability_enabled
    });
  }

  const summary = state.summary || EMPTY.summary;
  const settings = state.settings || EMPTY.settings;
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">Notification Center V1</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Varmennetut ilmoitukset yhdessä paikassa", en: "Verified notifications in one place", es: "Notificaciones verificadas en un solo lugar" })}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">{tr({ fi: "Ilmoitus syntyy vain käyttäjän omasta Watchlistista ja palvelimen nykyisestä Top Picks -vertailusta. Ensimmäinen versio on sovelluksen sisäinen ja synkronoidaan käyttäjän pyynnöstä.", en: "Notifications are generated only from the user's own Watchlist and the server's current Top Picks comparison. This first version is in-app and synchronizes on user request.", es: "Las notificaciones se generan solo desde la lista del usuario y la comparación actual de Top Picks del servidor. Esta primera versión es interna y se sincroniza a petición del usuario." })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => void act("sync", "POST", { action: "sync" })} disabled={Boolean(busy) || loading} className="rounded-2xl bg-sky-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{busy === "sync" ? tr({ fi: "Synkronoidaan…", en: "Synchronizing…", es: "Sincronizando…" }) : tr({ fi: "Synkronoi Watchlist", en: "Sync Watchlist", es: "Sincronizar lista" })}</button>
          <button onClick={() => void act("all-read", "PATCH", { markAllRead: true })} disabled={Boolean(busy) || summary.unread === 0} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white disabled:opacity-50">{tr({ fi: "Merkitse kaikki luetuiksi", en: "Mark all read", es: "Marcar todo como leído" })}</button>
          <Link href="/watchlist" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Avaa seurantalista", en: "Open Watchlist", es: "Abrir lista" })}</Link>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={tr({ fi: "Ilmoituksia", en: "Notifications", es: "Notificaciones" })} value={summary.total || 0} />
        <Metric label={tr({ fi: "Lukematta", en: "Unread", es: "Sin leer" })} value={summary.unread || 0} tone="text-sky-300" />
        <Metric label={tr({ fi: "Korkea", en: "High", es: "Alta" })} value={summary.high || 0} tone="text-red-300" />
        <Metric label={tr({ fi: "Korkea lukematta", en: "Unread high", es: "Alta sin leer" })} value={summary.unreadHigh || 0} tone="text-red-300" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={tr({ fi: "Ilmoituslaatikko", en: "Notification inbox", es: "Bandeja de notificaciones" })} subtitle={tr({ fi: "Rakenteiset ilmoitukset lokalisoidaan valitulle kielelle", en: "Structured notifications are localized to the selected language", es: "Las notificaciones estructuradas se localizan al idioma elegido" })}>
          <div className="space-y-4">
            {loading && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-slate-400">{tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" })}</div>}
            {!loading && (state.items || []).length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-slate-400">{tr({ fi: "Ilmoituslaatikko on tyhjä. Synkronoi aktiivinen Watchlist.", en: "The inbox is empty. Synchronize an active Watchlist.", es: "La bandeja está vacía. Sincroniza una lista activa." })}</div>}
            {(state.items || []).map((item) => {
              const copy = localizeNotification(item, tr);
              const read = Boolean(item.read_at);
              return <article key={item.id} className={`rounded-2xl border p-5 ${tone(item.severity, read)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wider text-slate-400">{item.severity} · {read ? tr({ fi: "luettu", en: "read", es: "leída" }) : tr({ fi: "uusi", en: "new", es: "nueva" })}</div><h2 className="mt-1 text-xl font-black text-white">{copy.title}</h2></div><div className="text-xs text-slate-400">{date(item.last_seen_at)}</div></div>
                <p className="mt-3 text-sm leading-6 text-slate-200">{copy.message}</p>
                <p className="mt-2 text-sm text-slate-400">{item.match || tr({ fi: "Ottelu", en: "Fixture", es: "Partido" })} · {item.selection}</p>
                <div className="mt-4 flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={() => void act(`read-${item.id}`, "PATCH", { id: item.id, read: !read })} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{read ? tr({ fi: "Merkitse lukemattomaksi", en: "Mark unread", es: "Marcar sin leer" }) : tr({ fi: "Merkitse luetuksi", en: "Mark read", es: "Marcar como leída" })}</button><button disabled={Boolean(busy)} onClick={() => void act(`dismiss-${item.id}`, "DELETE", { id: item.id })} className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200 disabled:opacity-50">{tr({ fi: "Poista laatikosta", en: "Remove from inbox", es: "Eliminar de la bandeja" })}</button></div>
              </article>;
            })}
          </div>
        </Panel>

        <Panel title={tr({ fi: "Ilmoitusasetukset", en: "Notification settings", es: "Configuración" })} subtitle={tr({ fi: "Vain sovelluksen sisäiset ilmoitukset", en: "In-app notifications only", es: "Solo notificaciones internas" })}>
          <div className="space-y-4">
            <Toggle label={tr({ fi: "Ilmoituskeskus käytössä", en: "Notification Center enabled", es: "Centro de notificaciones activado" })} checked={settings.in_app_enabled} onChange={(checked) => saveSettings({ in_app_enabled: checked })} disabled={Boolean(busy)} />
            <label className="block text-sm text-slate-300">{tr({ fi: "Vähimmäistaso", en: "Minimum severity", es: "Severidad mínima" })}<select value={settings.minimum_severity} onChange={(event) => void saveSettings({ minimum_severity: event.target.value })} disabled={Boolean(busy)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white"><option value="info">INFO</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label>
            <Toggle label={tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" })} checked={settings.kickoff_enabled} onChange={(checked) => saveSettings({ kickoff_enabled: checked })} disabled={Boolean(busy)} />
            <Toggle label={tr({ fi: "Hintamuutokset", en: "Price changes", es: "Cambios de cuota" })} checked={settings.price_enabled} onChange={(checked) => saveSettings({ price_enabled: checked })} disabled={Boolean(busy)} />
            <Toggle label={tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios de decisión" })} checked={settings.decision_enabled} onChange={(checked) => saveSettings({ decision_enabled: checked })} disabled={Boolean(busy)} />
            <Toggle label={tr({ fi: "Saatavuus ja päättynyt seuranta", en: "Availability and expired watch", es: "Disponibilidad y seguimiento vencido" })} checked={settings.availability_enabled} onChange={(checked) => saveSettings({ availability_enabled: checked })} disabled={Boolean(busy)} />
            <p className="text-xs leading-5 text-slate-500">{tr({ fi: "Taustapush, laitteen push-tokenit ja automaattinen ajo eivät kuulu V1-versioon. Sovellus ei pyydä käyttöjärjestelmän ilmoituslupaa.", en: "Background push, device push tokens and scheduled delivery are not part of V1. The app does not request operating-system notification permission.", es: "Las notificaciones push, los tokens del dispositivo y la entrega programada no forman parte de V1. La app no solicita permiso de notificaciones del sistema." })}</p>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>; }
function Toggle({ label, checked, onChange, disabled }) { return <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200"><span>{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event) => void onChange(event.target.checked)} disabled={disabled} className="h-5 w-5 accent-sky-400" /></label>; }
