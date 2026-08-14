"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

export default function ProductionStatusClient() {
  const { tr } = useLanguage();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = await response.json();
        setHealth(data);
        if (!response.ok) setError(tr({
          fi: "Health-pääte ilmoitti heikentyneen tuotantotilan.",
          en: "The health endpoint reported a degraded production state.",
          es: "El endpoint de salud informó un estado de producción degradado."
        }));
      } catch {
        setError(tr({
          fi: "Tuotannon health-päätettä ei voitu tavoittaa.",
          en: "The production health endpoint could not be reached.",
          es: "No se pudo acceder al endpoint de salud de producción."
        }));
      }
    }

    void loadHealth();
  }, [tr]);

  const services = health?.services || {};
  const serviceEntries = Object.entries(services);

  const launchChecks = useMemo(() => [
    {
      key: "database",
      title: tr({ fi: "Pilvidata", en: "Cloud data", es: "Datos cloud" }),
      description: tr({ fi: "Supabase ja käyttäjäkohtainen paperidata ovat käytettävissä.", en: "Supabase and user-scoped paper data are available.", es: "Supabase y los datos simulados por usuario están disponibles." }),
      ready: services.supabaseConfigured === true,
      href: "/cloud-sync"
    },
    {
      key: "pricing",
      title: tr({ fi: "Markkinahinta", en: "Market pricing", es: "Precio de mercado" }),
      description: tr({ fi: "Live-kertoimien lähde on konfiguroitu päätöksentekoa varten.", en: "The live-odds source is configured for decision support.", es: "La fuente de cuotas en vivo está configurada para las decisiones." }),
      ready: services.oddsApiConfigured === true,
      href: "/provider-health"
    },
    {
      key: "settlement",
      title: tr({ fi: "Tulosten selvitys", en: "Settlement", es: "Liquidación" }),
      description: tr({ fi: "Settlement-worker ratkaisee paperivedot ennen seuraavaa agenttisykliä.", en: "The settlement worker resolves paper bets before the next agent cycle.", es: "El worker de liquidación resuelve apuestas simuladas antes del siguiente ciclo." }),
      ready: services.settlementMonitorWorkerActive === true,
      href: "/operations"
    },
    {
      key: "autonomous",
      title: tr({ fi: "Autonominen worker", en: "Autonomous worker", es: "Worker autónomo" }),
      description: tr({ fi: "Suojattu paperiagentti on ajastettu ja aktiivinen tuotannossa.", en: "The governed paper agent is scheduled and active in production.", es: "El agente simulado controlado está programado y activo en producción." }),
      ready: services.autonomousAgentWorkerActive === true,
      href: "/autonomous-agent"
    },
    {
      key: "boundary",
      title: tr({ fi: "Paper-only-raja", en: "Paper-only boundary", es: "Límite simulado" }),
      description: tr({ fi: "Oikean rahan toteutus on estetty järjestelmätasolla.", en: "Real-money execution is disabled at the system boundary.", es: "La ejecución con dinero real está desactivada a nivel del sistema." }),
      ready: services.realMoneyBetting === false && services.autonomousAgentPaperOnly === true,
      href: "/responsible-use"
    }
  ], [services, tr]);

  const readyCount = launchChecks.filter((item) => item.ready).length;
  const coreReady = Boolean(health && readyCount === launchChecks.length);
  const signingReady = services.agentV10DecisionSigningConfigured === true;
  const firstBlocked = launchChecks.find((item) => !item.ready) || null;
  const nextAction = firstBlocked
    ? { href: firstBlocked.href, label: tr({ fi: `Korjaa: ${firstBlocked.title}`, en: `Fix: ${firstBlocked.title}`, es: `Corregir: ${firstBlocked.title}` }) }
    : { href: "/autonomous-agent", label: tr({ fi: "Käynnistä 1 000 € paperiautomatiikka", en: "Start €1,000 paper automation", es: "Iniciar automatización simulada de 1.000 €" }) };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Production Launch Board
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          {tr({ fi: "Onko Scorecaster oikeasti valmis pelaamaan?", en: "Is Scorecaster actually ready to run?", es: "¿Scorecaster está realmente listo para funcionar?" })}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {tr({
            fi: "Tämä näkymä erottaa pakollisen tuotantopolun lisäominaisuuksista. Kun viisi ydinkohtaa ovat vihreitä, alusta on valmis käyttäjän nimenomaiseen paperiautomaatio-opt-iniin.",
            en: "This view separates the mandatory production path from optional features. When all five core checks are green, the platform is ready for an explicit user paper-automation opt-in.",
            es: "Esta vista separa la ruta obligatoria de producción de las funciones opcionales. Con cinco controles verdes, la plataforma está lista para la activación simulada del usuario."
          })}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={nextAction.href} className="rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950">{nextAction.label}</Link>
          <Link href="/operations" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Operations</Link>
          <Link href="/release-readiness" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Release Readiness</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatusCard label={tr({ fi: "Core readiness", en: "Core readiness", es: "Preparación core" })} value={health ? `${readyCount}/${launchChecks.length}` : "…"} tone={coreReady ? "green" : "yellow"} />
        <StatusCard label="Health" value={health?.status || "loading"} tone={health?.status === "ok" ? "green" : "yellow"} />
        <StatusCard label="Deployment" value={health?.deployment || "loading"} tone={health?.deployment === "production" ? "green" : "yellow"} />
        <StatusCard label="Commit" value={health?.commit ? health.commit.slice(0, 8) : "…"} />
        <StatusCard label={tr({ fi: "Oikea raha", en: "Real money", es: "Dinero real" })} value={services.realMoneyBetting === false ? "OFF" : "CHECK"} tone={services.realMoneyBetting === false ? "green" : "red"} />
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Critical path</div>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">{tr({ fi: "Tuotannon viisi pakollista porttia", en: "Five required production gates", es: "Cinco puertas obligatorias de producción" })}</h2>
          </div>
          <div className={`rounded-full px-4 py-2 text-sm font-black ${coreReady ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
            {coreReady ? "CORE READY" : "ACTION REQUIRED"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {launchChecks.map((item, index) => (
            <Link key={item.key} href={item.href} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-emerald-300/30 hover:bg-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">0{index + 1}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.ready ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-200"}`}>
                  {item.ready ? "READY" : "BLOCKED"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <div className={`rounded-[2rem] border p-6 ${coreReady ? "border-emerald-300/25 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"}`}>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Next user action</div>
          <h2 className="mt-3 text-2xl font-black text-white">
            {coreReady
              ? tr({ fi: "Alusta on valmis ensimmäiseen käyttäjäajoon", en: "Platform is ready for the first user run", es: "La plataforma está lista para la primera ejecución" })
              : tr({ fi: "Korjaa ensimmäinen punainen portti", en: "Fix the first blocked gate", es: "Corrige la primera puerta bloqueada" })}
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            {coreReady
              ? tr({ fi: "Käyttäjäkohtainen opt-in on tarkoituksella erillinen turvallisuusraja. Aktivointi luo tarvittaessa 1 000 € virtuaalikassan ja jonottaa suojatun paperiajon.", en: "Per-user opt-in is intentionally a separate safety boundary. Activation creates a €1,000 virtual bankroll when needed and queues a governed paper run.", es: "La activación por usuario es un límite de seguridad separado. Crea una banca virtual de 1.000 € cuando sea necesario y pone en cola una ejecución controlada." })
              : firstBlocked?.description}
          </p>
          <Link href={nextAction.href} className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-slate-950">{nextAction.label}</Link>
        </div>

        <div className={`rounded-[2rem] border p-6 ${signingReady ? "border-emerald-300/20 bg-emerald-300/5" : "border-sky-300/20 bg-sky-300/10"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Production hardening</div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${signingReady ? "bg-emerald-400/10 text-emerald-300" : "bg-sky-400/10 text-sky-200"}`}>
              {signingReady ? "READY" : "NEXT"}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-black text-white">Decision signing key</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {signingReady
              ? tr({ fi: "Serveripuolen Agent Decision -allekirjoitus on konfiguroitu.", en: "Server-side Agent Decision signing is configured.", es: "La firma de decisiones del agente está configurada en servidor." })
              : tr({ fi: "Tämä ei avaa oikean rahan vetoja eikä muuta paperiagentin rajaa. Se on seuraava server-side hardening -vaihe allekirjoitetuille Agent-päätöksille.", en: "This does not enable real-money betting or change the paper-agent boundary. It is the next server-side hardening step for signed Agent decisions.", es: "Esto no habilita apuestas con dinero real ni cambia el límite simulado. Es el siguiente paso de endurecimiento para decisiones firmadas." })}
          </p>
          {health?.nextStep ? <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300"><strong className="text-white">Health next step:</strong> {health.nextStep}</div> : null}
          <Link href="/security" className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-white">Security</Link>
        </div>
      </section>

      <details className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <summary className="cursor-pointer text-xl font-black text-white">{tr({ fi: "Kaikki tekniset service-flagit", en: "All technical service flags", es: "Todos los indicadores técnicos" })}</summary>
        <p className="mt-2 text-sm leading-6 text-slate-400">{tr({ fi: "Nämä ovat diagnostiikkaa, eivät kaikki launch-blokkereita.", en: "These are diagnostics; not every flag is a launch blocker.", es: "Son diagnósticos; no todos bloquean el lanzamiento." })}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {serviceEntries.map(([name, value]) => {
            const isBoolean = typeof value === "boolean";
            const ready = isBoolean ? value : Boolean(value);
            return (
              <div key={name} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-black text-white">{formatName(name)}</div>
                <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${ready ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-300"}`}>
                  {isBoolean ? (ready ? "TRUE" : "FALSE") : String(value)}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">Live endpoint</h2>
        <p className="mt-3 text-slate-400">{tr({ fi: "Raaka health-JSON on edelleen käytettävissä tekniseen tarkistukseen. Käyttäjäkohtaiset ajot pysyvät autentikoinnin takana.", en: "Raw health JSON remains available for technical checks. User-specific runs stay behind authentication.", es: "El JSON de salud sigue disponible para controles técnicos. Las ejecuciones de usuario permanecen autenticadas." })}</p>
        <a href="/api/health" className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Open /api/health</a>
      </section>
    </div>
  );
}

function StatusCard({ label, value, tone = "default" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-amber-200" : tone === "red" ? "text-rose-300" : "text-white";
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 break-all text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function formatName(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
