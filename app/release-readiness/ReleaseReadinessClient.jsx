"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const EMPTY = { health: null, operations: null };

export default function ReleaseReadinessClient({ profile }) {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [healthResponse, operationsResponse] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/operations", { cache: "no-store" })
      ]);
      const [health, operations] = await Promise.all([
        healthResponse.json(),
        operationsResponse.json()
      ]);
      if (!health?.app) throw new Error("Health response is invalid");
      setData({ health, operations: operationsResponse.ok ? operations : null });
      if (!operationsResponse.ok) setError(operations?.error || "Operations overview unavailable");
    } catch (loadError) {
      setData(EMPTY);
      setError(loadError instanceof Error ? loadError.message : tr({
        fi: "Julkaisuvalmiutta ei voitu ladata.",
        en: "Release readiness could not be loaded.",
        es: "No se pudo cargar la preparación de lanzamiento."
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const checks = useMemo(() => {
    const services = data.health?.services || {};
    const checklist = data.operations?.checklist || {};
    return [
      {
        id: "live-deployment",
        label: tr({ fi: "Live-deploy vastaa", en: "Live deployment responds", es: "El despliegue responde" }),
        ready: data.health?.app === "Scorecaster"
      },
      {
        id: "supabase",
        label: tr({ fi: "Supabase public config", en: "Supabase public configuration", es: "Configuración pública de Supabase" }),
        ready: Boolean(services.supabaseConfigured)
      },
      {
        id: "account-deletion",
        label: tr({ fi: "Tilin palvelinpoisto", en: "Server-side account deletion", es: "Eliminación de cuenta en servidor" }),
        ready: Boolean(services.accountDeletionConfigured)
      },
      {
        id: "odds-provider",
        label: tr({ fi: "Odds API ja tulospalvelu", en: "Odds API and score provider", es: "Odds API y proveedor de resultados" }),
        ready: Boolean(services.oddsApiConfigured)
      },
      {
        id: "agent-signing",
        label: tr({ fi: "Agent-päätösten allekirjoitus", en: "Agent decision signing", es: "Firma de decisiones Agent" }),
        ready: Boolean(services.agentV10DecisionSigningConfigured)
      },
      {
        id: "watchlist-migrations",
        label: tr({ fi: "Watchlist- ja hälytysmigraatiot", en: "Watchlist and alert migrations", es: "Migraciones de seguimiento y alertas" }),
        ready: data.operations ? Boolean(checklist.watchlistMigration && checklist.notificationRegistryMigration && checklist.notificationDeliveryMigration) : null
      },
      {
        id: "settlement-migration",
        label: tr({ fi: "Settlement Monitor -migraatio", en: "Settlement Monitor migration", es: "Migración de Settlement Monitor" }),
        ready: data.operations ? Boolean(checklist.settlementMigration) : null
      },
      {
        id: "watchlist-worker",
        label: tr({ fi: "Watchlist Monitor aktiivinen", en: "Watchlist Monitor active", es: "Watchlist Monitor activo" }),
        ready: data.operations ? Boolean(checklist.watchlistWorkerEnabled) : null
      },
      {
        id: "settlement-worker",
        label: tr({ fi: "Settlement Monitor aktiivinen", en: "Settlement Monitor active", es: "Settlement Monitor activo" }),
        ready: data.operations ? Boolean(checklist.settlementWorkerEnabled) : null
      },
      {
        id: "notification-delivery",
        label: tr({ fi: "Push-toimitus aktiivinen", en: "Push delivery active", es: "Entrega push activa" }),
        ready: data.operations ? Boolean(checklist.notificationDeliveryEnabled) : null
      },
      {
        id: "physical-device",
        label: tr({ fi: "Fyysinen push-laite rekisteröity", en: "Physical push device registered", es: "Dispositivo push físico registrado" }),
        ready: data.operations ? Boolean(checklist.physicalPushDeviceRegistered) : null
      }
    ];
  }, [data, tr]);

  const readyCount = checks.filter((item) => item.ready).length;
  const automatedReady = checks.length > 0 && readyCount === checks.length;
  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale);
  };

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a_60%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">Release Readiness V1</div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          {tr({ fi: "Julkaisun viimeinen tarkistus ilman arvailua", en: "The final release check without guesswork", es: "La verificación final sin suposiciones" })}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {tr({ fi: "Näkymä yhdistää live-healthin, käyttäjäkohtaisen Operations-tilan, migraatiopaketin, mobiililokalisaatiot ja vielä käsin todistettavat julkaisublokkerit.", en: "This view combines live health, the account-scoped Operations state, the migration package, mobile localizations and the release blockers that still require human evidence.", es: "Esta vista combina el estado en vivo, Operaciones de la cuenta, el paquete de migraciones, las localizaciones móviles y los bloqueos que aún requieren evidencia humana." })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">
            {loading ? tr({ fi: "Tarkistetaan…", en: "Checking…", es: "Comprobando…" }) : tr({ fi: "Tarkista uudelleen", en: "Check again", es: "Comprobar de nuevo" })}
          </button>
          <Link href="/operations" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Operations</Link>
          <Link href="/production-status" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Production Status</Link>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">{error}<Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link></div>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={tr({ fi: "Automaattiset tarkistukset", en: "Automated checks", es: "Comprobaciones automáticas" })} value={`${readyCount}/${checks.length}`} tone={automatedReady ? "text-emerald-300" : "text-yellow-200"} />
        <Metric label={tr({ fi: "SQL-migraatiot", en: "SQL migrations", es: "Migraciones SQL" })} value={profile.migrationCount} />
        <Metric label={tr({ fi: "Julkiset smoke-sivut", en: "Public smoke pages", es: "Páginas públicas" })} value={profile.publicPageCount} />
        <Metric label={tr({ fi: "Suojatut API-probet", en: "Protected API probes", es: "Pruebas API protegidas" })} value={profile.protectedProbeCount} />
        <Metric label={tr({ fi: "Mobiililokaalit", en: "Mobile locales", es: "Idiomas móviles" })} value={new Set([...(profile.mobileLocales?.apple || []), ...(profile.mobileLocales?.googlePlay || [])]).size} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">{tr({ fi: "Automaattinen tuotantovalmius", en: "Automated production readiness", es: "Preparación automática" })}</h2>
              <p className="mt-2 text-slate-400">{tr({ fi: "Nämä tilat tulevat oikeasta health- ja Operations-datasta.", en: "These states come from live health and Operations data.", es: "Estos estados proceden de datos reales de Health y Operations." })}</p>
            </div>
            <span className={`rounded-full border px-4 py-2 text-sm font-black ${automatedReady ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"}`}>
              {automatedReady ? tr({ fi: "AUTOMAATIO VALMIS", en: "AUTOMATION READY", es: "AUTOMATIZACIÓN LISTA" }) : tr({ fi: "AKTIVOINTI KESKEN", en: "ACTIVATION INCOMPLETE", es: "ACTIVACIÓN INCOMPLETA" })}
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {checks.map((item) => <CheckRow key={item.id} label={item.label} ready={item.ready} tr={tr} />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">{tr({ fi: "Koneellinen julkaisupaketti", en: "Machine-verified release package", es: "Paquete verificado" })}</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>{tr({ fi: "Yksi manifesti määrää SQL-järjestyksen, reitit, headerit ja kauppalokaalit.", en: "One manifest defines SQL order, routes, headers and store locales.", es: "Un manifiesto define el orden SQL, rutas, cabeceras e idiomas de tienda." })}</p>
            <p>{tr({ fi: "GitHub Actions ajaa tuotanto-smoken päivittäin ja tallentaa JSON-raportin 30 päiväksi.", en: "GitHub Actions runs the production smoke daily and retains its JSON report for 30 days.", es: "GitHub Actions ejecuta la prueba diaria y conserva el informe JSON durante 30 días." })}</p>
            <p>{tr({ fi: "Kirjautumattomat API- ja worker-kutsut eivät saa onnistua.", en: "Unauthenticated API and worker calls are not allowed to succeed.", es: "Las llamadas API y worker sin autenticar no pueden tener éxito." })}</p>
          </div>
          <div className="mt-5 rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-400">
            <div>{profile.productionBaseUrl}</div>
            <div className="mt-2">{tr({ fi: "Manifesti", en: "Manifest", es: "Manifiesto" })} v{profile.version}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-yellow-400/20 bg-yellow-400/[0.07] p-6">
        <h2 className="text-2xl font-black text-yellow-100">{tr({ fi: "Käsin todistettavat julkaisublokkerit", en: "Release blockers requiring human evidence", es: "Bloqueos que requieren evidencia humana" })}</h2>
        <p className="mt-2 max-w-4xl text-yellow-100/75">{tr({ fi: "Näitä ei merkitä automaattisesti valmiiksi, koska koodi ei voi todistaa fyysistä laitetta, kahden käyttäjän eristystä tai juridisia tietoja.", en: "These are never auto-completed because code cannot prove a physical device test, two-user isolation or final legal details.", es: "Nunca se completan automáticamente porque el código no puede demostrar pruebas físicas, aislamiento entre usuarios ni datos legales finales." })}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(profile.manualReleaseChecks || []).map((item) => <div key={item.id} className="rounded-2xl border border-yellow-400/20 bg-slate-950/60 p-4"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-1 text-[10px] font-black text-yellow-200">MANUAL</span><div className="font-bold text-slate-100">{item.title}</div></div></div>)}
        </div>
      </section>

      <div className="text-xs text-slate-500">
        {data.health?.timestamp ? `${tr({ fi: "Health tarkistettu", en: "Health checked", es: "Health comprobado" })}: ${date(data.health.timestamp)}` : ""}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className={`mt-2 break-words text-3xl font-black ${tone}`}>{value}</div></div>;
}

function CheckRow({ label, ready, tr }) {
  const unknown = ready === null;
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4"><div className="font-bold text-slate-200">{label}</div><span className={`rounded-full px-3 py-1 text-xs font-black ${ready ? "bg-emerald-400/10 text-emerald-300" : unknown ? "bg-slate-400/10 text-slate-300" : "bg-yellow-400/10 text-yellow-200"}`}>{ready ? tr({ fi: "VALMIS", en: "READY", es: "LISTO" }) : unknown ? tr({ fi: "KIRJAUDU", en: "SIGN IN", es: "INICIAR SESIÓN" }) : tr({ fi: "KESKEN", en: "PENDING", es: "PENDIENTE" })}</span></div>;
}
