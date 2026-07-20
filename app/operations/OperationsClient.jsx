"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const EMPTY = {
  workers: {},
  accountActivity: {},
  configurations: {},
  checklist: {},
  warnings: []
};

const TONES = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  warning: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100",
  danger: "border-red-400/30 bg-red-400/10 text-red-100",
  neutral: "border-white/10 bg-white/[0.04] text-slate-200"
};

export default function OperationsClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Operations overview unavailable");
      setData({ ...EMPTY, ...payload });
    } catch (loadError) {
      setData(EMPTY);
      setError(loadError instanceof Error ? loadError.message : tr({
        fi: "Käyttötilannekonsolia ei voitu ladata.",
        en: "The operations dashboard could not be loaded.",
        es: "No se pudo cargar el panel de operaciones."
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const requiredChecklist = useMemo(() => [
    "watchlistMigration",
    "settlementMigration",
    "notificationRegistryMigration",
    "notificationDeliveryMigration",
    "watchlistWorkerConfigured",
    "settlementWorkerConfigured",
    "notificationDeliveryConfigured"
  ], []);
  const readyCount = requiredChecklist.filter((key) => data.checklist?.[key]).length;
  const launchReady = readyCount === requiredChecklist.length;

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const statusLabel = (status) => ({
    healthy: tr({ fi: "TERVE", en: "HEALTHY", es: "SALUDABLE" }),
    running: tr({ fi: "KÄYNNISSÄ", en: "RUNNING", es: "EJECUTANDO" }),
    working: tr({ fi: "TYÖSKENTELEE", en: "WORKING", es: "TRABAJANDO" }),
    waiting: tr({ fi: "ODOTTAA", en: "WAITING", es: "ESPERANDO" }),
    stale: tr({ fi: "VANHENTUNUT", en: "STALE", es: "DESACTUALIZADO" }),
    error: tr({ fi: "VIRHE", en: "ERROR", es: "ERROR" }),
    attention: tr({ fi: "VAATII HUOMIOTA", en: "NEEDS ATTENTION", es: "REQUIERE ATENCIÓN" }),
    migration_required: tr({ fi: "MIGRAATIO PUUTTUU", en: "MIGRATION REQUIRED", es: "FALTA MIGRACIÓN" }),
    disabled: tr({ fi: "POIS PÄÄLTÄ", en: "DISABLED", es: "DESACTIVADO" })
  }[status] || String(status || "unknown").toUpperCase());

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_36%),linear-gradient(135deg,#020617,#0f172a_58%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-black text-sky-200">
          Operations Dashboard V1
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          {tr({ fi: "Scorecasterin oikea käyttötilanne yhdessä paikassa", en: "The real Scorecaster operating state in one place", es: "El estado operativo real de Scorecaster en un solo lugar" })}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {tr({ fi: "Näe tämän tilin worker-ajot, jonot, migraatiot ja tuotantoasetusten turvalliset kyllä/ei-tilat. Salaisuuksia tai muiden käyttäjien tietoja ei näytetä.", en: "See this account's worker runs, queues, migrations and safe yes/no production configuration states. Secrets and other users' data are never shown.", es: "Consulta las ejecuciones, colas, migraciones y estados seguros de configuración de esta cuenta. Nunca se muestran secretos ni datos de otros usuarios." })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => void load()} disabled={loading} className="rounded-2xl bg-sky-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">
            {loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä tila", en: "Refresh status", es: "Actualizar estado" })}
          </button>
          <Link href="/production-status" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Production Status</Link>
          <Link href="/alerts" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Alert Inbox</Link>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">{error}<Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link></div>}
      {(data.warnings || []).map((warning) => <div key={warning} className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{warning}</div>)}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label={tr({ fi: "Launch-valmius", en: "Launch readiness", es: "Preparación" })} value={`${readyCount}/${requiredChecklist.length}`} tone={launchReady ? "text-emerald-300" : "text-yellow-200"} />
        <Metric label={tr({ fi: "Seurattavia", en: "Watched", es: "Seguidos" })} value={data.accountActivity?.activeWatchlistItems || 0} />
        <Metric label={tr({ fi: "Avoimia paperikohteita", en: "Open paper picks", es: "Pronósticos abiertos" })} value={data.accountActivity?.openPaperBets || 0} />
        <Metric label={tr({ fi: "Lukemattomia hälytyksiä", en: "Unread alerts", es: "Alertas no leídas" })} value={data.accountActivity?.unreadActiveAlerts || 0} />
        <Metric label={tr({ fi: "Push-laitteita", en: "Push devices", es: "Dispositivos push" })} value={data.accountActivity?.activeNotificationDevices || 0} />
        <Metric label={tr({ fi: "Hintapisteitä 24 h", en: "Timeline points 24h", es: "Puntos 24 h" })} value={data.accountActivity?.marketTimelineSnapshots24h || 0} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <WorkerCard
          title="Watchlist Monitor"
          worker={data.workers?.watchlist}
          statusLabel={statusLabel}
          date={date}
          details={[
            [tr({ fi: "Viimeksi käsitelty", en: "Last processed", es: "Último proceso" }), data.workers?.watchlist?.state?.last_completed_at],
            [tr({ fi: "Kohteet", en: "Items", es: "Elementos" }), data.workers?.watchlist?.state?.last_items_count],
            [tr({ fi: "Hälytykset", en: "Alerts", es: "Alertas" }), data.workers?.watchlist?.state?.last_alerts_count],
            [tr({ fi: "Tilannekuvat", en: "Snapshots", es: "Capturas" }), data.workers?.watchlist?.state?.last_snapshots_count]
          ]}
        />
        <WorkerCard
          title="Settlement Monitor"
          worker={data.workers?.settlement}
          statusLabel={statusLabel}
          date={date}
          details={[
            [tr({ fi: "Viimeksi käsitelty", en: "Last processed", es: "Último proceso" }), data.workers?.settlement?.state?.last_completed_at],
            [tr({ fi: "Avoimia", en: "Open", es: "Abiertos" }), data.workers?.settlement?.state?.last_open_count],
            [tr({ fi: "Ratkaistu", en: "Settled", es: "Resueltos" }), data.workers?.settlement?.state?.last_settled_count],
            [tr({ fi: "Varoituksia", en: "Warnings", es: "Avisos" }), data.workers?.settlement?.state?.last_provider_warnings_count]
          ]}
        />
        <WorkerCard
          title="Notification Delivery"
          worker={data.workers?.notificationDelivery}
          statusLabel={statusLabel}
          date={date}
          details={[
            [tr({ fi: "Jonossa", en: "Queued", es: "En cola" }), data.workers?.notificationDelivery?.counts?.queued],
            [tr({ fi: "Uusintayrityksiä", en: "Retries", es: "Reintentos" }), data.workers?.notificationDelivery?.counts?.retry],
            [tr({ fi: "Palvelu hyväksyi", en: "Provider accepted", es: "Aceptadas" }), data.workers?.notificationDelivery?.counts?.providerAccepted],
            [tr({ fi: "Epäonnistui", en: "Failed", es: "Fallidas" }), data.workers?.notificationDelivery?.counts?.failed]
          ]}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">{tr({ fi: "Tuotannon käyttöönottolista", en: "Production launch checklist", es: "Lista de lanzamiento" })}</h2>
          <p className="mt-2 text-slate-400">{tr({ fi: "Workerin aktiivisuus vaatii sekä palvelinasetuksen että yhden suojatun ajastimen.", en: "Worker activity requires both server configuration and exactly one protected scheduler.", es: "La actividad requiere configuración del servidor y un único programador protegido." })}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Object.entries(data.checklist || {}).map(([key, value]) => <ChecklistRow key={key} label={checklistLabel(key, tr)} ready={Boolean(value)} />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>{tr({ fi: "Konsoli käyttää kirjautuneen käyttäjän RLS-suojattuja rivejä.", en: "The console uses the signed-in user's RLS-protected rows.", es: "El panel utiliza filas protegidas por RLS del usuario autenticado." })}</p>
            <p>{tr({ fi: "Push-tokenit, salaisuudet ja service-role-avaimet eivät kuulu vastaukseen.", en: "Push tokens, secrets and service-role keys are excluded from the response.", es: "Los tokens push, secretos y claves service-role no forman parte de la respuesta." })}</p>
            <p>{tr({ fi: "Provider accepted ei tarkoita, että käyttäjä varmasti näki ilmoituksen.", en: "Provider accepted does not prove that the user saw the notification.", es: "Aceptada por el proveedor no demuestra que el usuario viera la notificación." })}</p>
          </div>
          <div className="mt-5 text-xs text-slate-500">{data.generatedAt ? `${tr({ fi: "Luotu", en: "Generated", es: "Generado" })}: ${date(data.generatedAt)}` : ""}</div>
        </div>
      </section>
    </div>
  );
}

function WorkerCard({ title, worker = {}, statusLabel, date, details }) {
  const tone = TONES[worker?.tone] || TONES.neutral;
  return <article className={`rounded-[2rem] border p-6 ${tone}`}>
    <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-black">{title}</h2><span className="rounded-full border border-current/20 px-3 py-1 text-xs font-black">{statusLabel(worker?.status)}</span></div>
    <div className="mt-5 grid grid-cols-2 gap-3">{details.map(([label, value]) => <div key={label} className="rounded-xl bg-black/15 p-3"><div className="text-xs opacity-65">{label}</div><div className="mt-1 break-words font-black">{String(value || "").includes("T") ? date(value) : value ?? "–"}</div></div>)}</div>
    {worker?.state?.last_error && <div className="mt-4 rounded-xl border border-red-300/20 bg-red-950/30 p-3 text-sm">{worker.state.last_error}</div>}
  </article>;
}

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div></div>;
}

function ChecklistRow({ label, ready }) {
  return <div className={`rounded-xl border p-4 ${ready ? "border-emerald-400/25 bg-emerald-400/10" : "border-yellow-400/25 bg-yellow-400/10"}`}><div className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${ready ? "bg-emerald-300 text-slate-950" : "bg-yellow-300 text-slate-950"}`}>{ready ? "✓" : "!"}</span><span className="font-bold">{label}</span></div></div>;
}

function checklistLabel(key, tr) {
  const labels = {
    watchlistMigration: tr({ fi: "Watchlist Monitor -migraatio", en: "Watchlist Monitor migration", es: "Migración Watchlist Monitor" }),
    settlementMigration: tr({ fi: "Settlement Monitor -migraatio", en: "Settlement Monitor migration", es: "Migración Settlement Monitor" }),
    notificationRegistryMigration: tr({ fi: "Notification Registry -migraatio", en: "Notification Registry migration", es: "Migración Notification Registry" }),
    notificationDeliveryMigration: tr({ fi: "Notification Delivery -migraatio", en: "Notification Delivery migration", es: "Migración Notification Delivery" }),
    watchlistWorkerConfigured: tr({ fi: "Watchlist-worker määritetty", en: "Watchlist worker configured", es: "Worker Watchlist configurado" }),
    watchlistWorkerEnabled: tr({ fi: "Watchlist-worker aktiivinen", en: "Watchlist worker enabled", es: "Worker Watchlist activo" }),
    settlementWorkerConfigured: tr({ fi: "Settlement-worker määritetty", en: "Settlement worker configured", es: "Worker Settlement configurado" }),
    settlementWorkerEnabled: tr({ fi: "Settlement-worker aktiivinen", en: "Settlement worker enabled", es: "Worker Settlement activo" }),
    notificationDeliveryConfigured: tr({ fi: "Push-toimitus määritetty", en: "Push delivery configured", es: "Entrega push configurada" }),
    notificationDeliveryEnabled: tr({ fi: "Push-toimitus aktiivinen", en: "Push delivery enabled", es: "Entrega push activa" }),
    physicalPushDeviceRegistered: tr({ fi: "Oikea push-laite rekisteröity", en: "Physical push device registered", es: "Dispositivo push real registrado" })
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1");
}
