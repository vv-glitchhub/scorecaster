"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

export default function PersonalLaunchStatus() {
  const { tr, locale } = useLanguage();
  const [status, setStatus] = useState({ loading: true, authenticated: null, data: null, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          if (active) setStatus({ loading: false, authenticated: false, data: null, error: "" });
          return;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Autonomous Agent status unavailable");
        if (active) setStatus({ loading: false, authenticated: true, data: payload, error: "" });
      } catch (error) {
        if (active) setStatus({ loading: false, authenticated: null, data: null, error: error instanceof Error ? error.message : "Autonomous Agent status unavailable" });
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const data = status.data;
  const settings = data?.settings || {};
  const readiness = data?.readiness || {};
  const bankroll = data?.bankroll || null;
  const state = data?.state || null;
  const optedIn = settings.enabled === true;
  const ready = readiness.ready === true;
  const paused = Boolean(state?.paused_until && Date.parse(state.paused_until) > Date.now());
  const statusLabel = !optedIn ? "OPT-IN REQUIRED" : paused ? "PAUSED" : ready ? "READY" : "WAITING";
  const statusTone = ready ? "text-emerald-300 bg-emerald-400/10" : paused ? "text-rose-200 bg-rose-400/10" : "text-amber-200 bg-amber-400/10";
  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const recentRun = Array.isArray(data?.runs) ? data.runs[0] : null;
  const sports = Array.isArray(settings.sports) ? settings.sports : [];
  const virtualBankroll = Number(bankroll?.bankroll || 0);
  const paperMode = bankroll?.paper_trading_mode !== false;

  const date = (value) => {
    if (!value) return "–";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const summary = useMemo(() => {
    if (!optedIn) return tr({ fi: "Käyttäjäkohtainen opt-in ei ole vielä päällä.", en: "Per-user opt-in is not enabled yet.", es: "La activación por usuario aún no está habilitada." });
    if (paused) return tr({ fi: "Turvajarru pitää agentin tilapäisesti tauolla.", en: "A safety cooldown is temporarily pausing the agent.", es: "Un enfriamiento de seguridad mantiene el agente en pausa temporal." });
    if (ready) return tr({ fi: "Sinun paperiagenttisi on valmis seuraavaan suojattuun sykliin.", en: "Your paper agent is ready for the next governed cycle.", es: "Tu agente simulado está listo para el siguiente ciclo controlado." });
    return tr({ fi: "Opt-in on päällä, mutta yksi tai useampi safety gate odottaa.", en: "Opt-in is enabled, but one or more safety gates are still waiting.", es: "La activación está habilitada, pero una o más puertas de seguridad siguen pendientes." });
  }, [optedIn, paused, ready, tr]);

  if (status.loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Personal launch readiness</div>
        <div className="mt-3 text-xl font-black text-white">{tr({ fi: "Tarkistetaan käyttäjätila…", en: "Checking user state…", es: "Comprobando el estado del usuario…" })}</div>
      </section>
    );
  }

  if (status.authenticated === false) {
    return (
      <section className="rounded-[2rem] border border-sky-300/20 bg-sky-300/10 p-6 md:p-7">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">Personal launch readiness</div>
        <h2 className="mt-3 text-2xl font-black text-white">{tr({ fi: "Kirjaudu nähdäksesi oman agenttisi tilan", en: "Sign in to see your agent readiness", es: "Inicia sesión para ver el estado de tu agente" })}</h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-300">{tr({ fi: "Julkinen Production Launch Board näyttää alustan tilan. Käyttäjäkohtainen opt-in, virtuaalikassa, safety gate ja ajohistoria pysyvät autentikoinnin takana.", en: "The public Production Launch Board shows platform readiness. Per-user opt-in, virtual bankroll, safety gates and run history stay behind authentication.", es: "El tablero público muestra la plataforma. La activación, banca virtual, puertas de seguridad e historial permanecen autenticados." })}</p>
        <Link href="/login" className="mt-5 inline-flex rounded-2xl bg-sky-200 px-5 py-3 font-black text-slate-950">{tr({ fi: "Kirjaudu sisään", en: "Sign in", es: "Iniciar sesión" })}</Link>
      </section>
    );
  }

  if (status.error) {
    return <section className="rounded-[2rem] border border-rose-300/25 bg-rose-300/10 p-6 text-rose-100">{status.error}</section>;
  }

  if (data?.available === false) {
    return (
      <section className="rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-6">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Personal launch readiness</div>
        <h2 className="mt-3 text-2xl font-black text-white">{tr({ fi: "Autonomous Agent -migraatio odottaa", en: "Autonomous Agent migration is waiting", es: "La migración del agente autónomo está pendiente" })}</h2>
        <p className="mt-3 text-slate-300">{data?.warning || "Migration required"}</p>
        <Link href="/operations" className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-slate-950">Operations</Link>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-200">Personal launch readiness</div>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">{tr({ fi: "Sinun paperiautomaatiosi", en: "Your paper automation", es: "Tu automatización simulada" })}</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">{summary}</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-black ${statusTone}`}>{statusLabel}</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <PersonalMetric label={tr({ fi: "Opt-in", en: "Opt-in", es: "Activación" })} value={optedIn ? "ON" : "OFF"} good={optedIn} />
        <PersonalMetric label={tr({ fi: "Virtuaalikassa", en: "Virtual bankroll", es: "Banca virtual" })} value={virtualBankroll > 0 ? `${virtualBankroll.toFixed(0)} €` : "–"} good={virtualBankroll > 0 && paperMode} />
        <PersonalMetric label={tr({ fi: "Paper mode", en: "Paper mode", es: "Modo simulado" })} value={paperMode ? "ON" : "OFF"} good={paperMode} />
        <PersonalMetric label={tr({ fi: "Viime ajo", en: "Last run", es: "Última ejecución" })} value={state?.last_status || recentRun?.status || "–"} good={["success", "idle"].includes(state?.last_status || recentRun?.status)} />
        <PersonalMetric label={tr({ fi: "Tallennettu viime ajossa", en: "Saved last run", es: "Guardadas última ejecución" })} value={String(state?.last_saved_count ?? recentRun?.saved_count ?? 0)} />
        <PersonalMetric label={tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Siguiente control" })} value={date(state?.next_check_at)} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-sm font-black text-white">{tr({ fi: "Safety gate", en: "Safety gate", es: "Puerta de seguridad" })}</div>
          {blockers.length ? (
            <div className="mt-3 flex flex-wrap gap-2">{blockers.map((item) => <span key={item} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-100">{item}</span>)}</div>
          ) : (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">{tr({ fi: "Ei käyttäjäkohtaisia blokkereita.", en: "No user-specific blockers.", es: "Sin bloqueos específicos del usuario." })}</div>
          )}
          <div className="mt-4 text-sm leading-6 text-slate-400">{tr({ fi: "Valitut liigat", en: "Selected leagues", es: "Ligas seleccionadas" })}: <strong className="text-slate-200">{sports.length ? sports.join(", ") : tr({ fi: "turvalliset oletusmarkkinat", en: "safe default markets", es: "mercados seguros predeterminados" })}</strong></div>
        </div>

        <div className="rounded-3xl border border-purple-300/20 bg-purple-300/10 p-5">
          <div className="text-sm font-black text-white">{tr({ fi: "Seuraava toiminto", en: "Next action", es: "Siguiente acción" })}</div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{!optedIn
            ? tr({ fi: "Aktivoi paperiagentti Autonomous Agent -näkymässä. Aktivointi pysyy tarkoituksella autentikoituna ja nimenomaisena.", en: "Enable the paper agent in Autonomous Agent. Activation intentionally remains authenticated and explicit.", es: "Activa el agente simulado en Autonomous Agent. La activación permanece autenticada y explícita." })
            : ready
              ? tr({ fi: "Agentti on valmis. Voit avata Mission Controlin tai paperisalkun ja seurata seuraavaa sykliä.", en: "The agent is ready. Open Mission Control or the paper portfolio to follow the next cycle.", es: "El agente está listo. Abre Mission Control o la cartera simulada para seguir el próximo ciclo." })
              : tr({ fi: "Avaa Autonomous Agent nähdäksesi blockerit ja turvarajat yksityiskohtaisesti.", en: "Open Autonomous Agent to inspect blockers and safety limits in detail.", es: "Abre Autonomous Agent para revisar bloqueos y límites de seguridad." })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/autonomous-agent" className="rounded-2xl bg-purple-200 px-4 py-2.5 text-sm font-black text-slate-950">Autonomous Agent</Link>
            {optedIn ? <Link href="/tracking" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-white">{tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })}</Link> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PersonalMetric({ label, value, good = null }) {
  const tone = good === true ? "text-emerald-300" : good === false ? "text-amber-200" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-2 break-words text-lg font-black ${tone}`}>{value}</div>
    </div>
  );
}
