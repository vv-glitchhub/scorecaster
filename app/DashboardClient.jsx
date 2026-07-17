"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";
import Panel from "./components/Panel";
import { useLanguage } from "./components/LanguageProvider";
import { getTrackedBets } from "../lib/tracking-storage";
import { calculateTrackingStats } from "../lib/tracking-engine";
import { formatMoney, formatPercent } from "../lib/analysis-engine";

function decisionLabel(pick) {
  if (pick.productDecision) return pick.productDecision;
  if (pick.decision === "BET") return "PLAY";
  if (pick.decision === "PASS") return "SKIP";
  return pick.decision || "WATCH";
}

function decisionClass(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "SKIP") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
}

export default function DashboardClient() {
  const { t, tr, locale } = useLanguage();
  const [topPicks, setTopPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [trackingStats, setTrackingStats] = useState(null);

  const steps = useMemo(() => [
    {
      number: "1",
      title: t("home.step1Title"),
      description: t("home.step1Description"),
      href: "/risk",
      action: t("help.openRisk")
    },
    {
      number: "2",
      title: t("home.step2Title"),
      description: t("home.step2Description"),
      href: "/agent",
      action: t("home.openAi")
    },
    {
      number: "3",
      title: t("home.step3Title"),
      description: t("home.step3Description"),
      href: "/tracking",
      action: t("home.openTracking")
    }
  ], [t]);

  const tools = useMemo(() => [
    {
      title: t("nav.picks"),
      href: "/betting",
      description: tr({
        fi: "Valitse laji ja liiga. Vertaa kertoimia ja näe edge, EV sekä datan laatu.",
        en: "Choose a sport and league. Compare prices and see edge, EV and data quality.",
        es: "Elige deporte y liga. Compara cuotas y consulta ventaja, EV y calidad de datos."
      }),
      label: tr({ fi: "Vertaa markkinaa", en: "Compare the market", es: "Comparar el mercado" })
    },
    {
      title: t("nav.ai"),
      href: "/agent",
      description: tr({
        fi: "Palvelimen laskema portfolio, stressitesti, vastaväite ja valvottu selitys.",
        en: "Server-calculated portfolio, stress test, counterargument and governed explanation.",
        es: "Cartera calculada por el servidor, prueba de estrés, contraargumento y explicación controlada."
      }),
      label: tr({ fi: "Avaa Agent V10", en: "Open Agent V10", es: "Abrir Agent V10" })
    },
    {
      title: t("nav.simulator"),
      href: "/simulator",
      description: tr({
        fi: "Testaa omia ratingeja toistettavalla simulaatiolla ilman rahaa.",
        en: "Test your own ratings with a reproducible simulation and no money.",
        es: "Prueba tus ratings con una simulación reproducible y sin dinero."
      }),
      label: tr({ fi: "Simuloi ottelu", en: "Simulate a match", es: "Simular un partido" })
    },
    {
      title: t("nav.analytics"),
      href: "/analytics",
      description: tr({
        fi: "Seuraa paperitulosta, CLV:tä, Brier scorea ja todennäköisyyksien rehellisyyttä.",
        en: "Track paper results, CLV, Brier score and probability calibration.",
        es: "Sigue resultados simulados, CLV, puntuación Brier y calibración de probabilidades."
      }),
      label: tr({ fi: "Katso suorituskyky", en: "View performance", es: "Ver rendimiento" })
    }
  ], [t, tr]);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Top Picks unavailable");
        setTopPicks(Array.isArray(data.featured) && data.featured.length ? data.featured : (Array.isArray(data.data) ? data.data.slice(0, 3) : []));
        setSource(data.source || "no-vig-market-consensus");
      } catch {
        setTopPicks([]);
        setSource(tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" }));
      } finally {
        setLoading(false);
      }
    }

    const tracked = getTrackedBets();
    setTrackingStats(calculateTrackingStats(tracked));
    void load();
  }, [tr]);

  const summary = useMemo(() => {
    const play = topPicks.filter((pick) => decisionLabel(pick) === "PLAY").length;
    const bestEdge = topPicks.reduce((best, pick) => Math.max(best, Number(pick.edge || 0)), 0);
    return { play, bestEdge };
  }, [topPicks]);

  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="relative max-w-4xl">
          <div className="mb-5 inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-200">{t("mode.paper")}</div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">{t("home.title")}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{t("home.description")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/agent" className="rounded-2xl bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 shadow-lg shadow-emerald-400/20 hover:bg-emerald-300">{t("home.openAi")}</Link>
            <Link href="/betting" className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center font-black text-white hover:bg-white/10">{t("home.openPicks")}</Link>
            <Link href="/help" className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-6 py-4 text-center font-black text-sky-200 hover:bg-sky-400/20">{t("nav.help")}</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="start-title">
        <div className="mb-4">
          <h2 id="start-title" className="text-2xl font-black">{t("home.startTitle")}</h2>
          <p className="mt-1 text-slate-400">{tr({ fi: "Tämä on suositeltu polku ensimmäisellä käyttökerralla.", en: "This is the recommended path for your first session.", es: "Este es el recorrido recomendado para la primera sesión." })}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <Link key={step.number} href={step.href} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/[0.07]">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">{step.number}</div>
                <div>
                  <h3 className="text-xl font-black group-hover:text-emerald-300">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                  <div className="mt-4 text-sm font-black text-emerald-300">{step.action} →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("home.topTitle")} value={loading ? "…" : String(topPicks.length)} subtitle={`${tr({ fi: "Lähde", en: "Source", es: "Fuente" })}: ${source}`} tone="blue" />
        <StatCard title="PLAY" value={loading ? "…" : String(summary.play)} subtitle={tr({ fi: "Vain läpäisseet kohteet", en: "Only picks that pass all gates", es: "Solo pronósticos que superan los filtros" })} tone="green" />
        <StatCard title={tr({ fi: "Korkein edge", en: "Highest edge", es: "Mayor ventaja" })} value={loading ? "…" : formatPercent(summary.bestEdge)} subtitle={tr({ fi: "Paras hinta vs konsensus", en: "Best price versus consensus", es: "Mejor cuota frente al consenso" })} />
        <StatCard title={t("home.paperResult")} value={trackingStats ? money(trackingStats.totalProfit) : money(0)} subtitle={trackingStats ? `${trackingStats.totalBets} ${tr({ fi: "tallennettua", en: "saved", es: "guardados" })}` : tr({ fi: "Ei historiaa", en: "No history", es: "Sin historial" })} tone={trackingStats?.totalProfit >= 0 ? "green" : "red"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Panel title={tr({ fi: "Päätoiminnot", en: "Main tools", es: "Herramientas principales" })} subtitle={tr({ fi: "Kaikki mitä tavallinen käyttäjä tarvitsee", en: "Everything most users need", es: "Todo lo que necesita la mayoría de usuarios" })}>
          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08]">
                <h3 className="text-xl font-black group-hover:text-emerald-300">{tool.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
                <div className="mt-4 text-sm font-black text-emerald-300">{tool.label} →</div>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title={tr({ fi: "Päivän Top 3", en: "Today's Top 3", es: "Top 3 de hoy" })} subtitle={t("home.topDescription")}>
            <div className="space-y-3">
              {loading && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Analysoidaan markkinaa…", en: "Analyzing the market…", es: "Analizando el mercado…" })}</div>}
              {!loading && topPicks.length === 0 && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">{t("home.noPicks")}</div>}
              {topPicks.map((pick, index) => {
                const decision = decisionLabel(pick);
                return (
                  <div key={`${pick.id || pick.match}-${pick.selection}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">{pick.leagueTitle || pick.league || tr({ fi: "Urheilu", en: "Sport", es: "Deporte" })}</div>
                        <div className="mt-1 truncate font-black">{pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`}</div>
                        <div className="mt-1 text-sm text-slate-400">{pick.selection || pick.label || tr({ fi: "Valinta", en: "Selection", es: "Selección" })} @ {Number(pick.odds || 0).toFixed(2)}</div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs font-black ${decisionClass(decision)}`}>{decision}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">{t("term.edge")}</div><div className="font-black">{formatPercent(pick.edge)}</div></div>
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">{t("term.ev")}</div><div className="font-black">{formatPercent(pick.ev)}</div></div>
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">{t("term.confidence")}</div><div className="font-black">{formatPercent(pick.confidence)}</div></div>
                    </div>
                  </div>
                );
              })}
              <Link href="/agent" className="block rounded-xl bg-fuchsia-400 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-fuchsia-300">{tr({ fi: "Avaa perustelut ja vastaväitteet", en: "Open reasoning and counterarguments", es: "Abrir motivos y contraargumentos" })}</Link>
            </div>
          </Panel>

          <Panel title={tr({ fi: "Muista", en: "Remember", es: "Recuerda" })} subtitle={tr({ fi: "Scorecasterin rajat", en: "Scorecaster boundaries", es: "Límites de Scorecaster" })}>
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">✓ {tr({ fi: "AI voi sanoa PLAY, WATCH tai SKIP.", en: "AI can say PLAY, WATCH or SKIP.", es: "La IA puede indicar PLAY, WATCH o SKIP." })}</div>
              <div className="rounded-xl bg-sky-400/10 p-4">✓ {tr({ fi: "Kaikki panokset ja saldot ovat virtuaalisia.", en: "All stakes and balances are virtual.", es: "Todos los importes y saldos son virtuales." })}</div>
              <div className="rounded-xl bg-yellow-400/10 p-4">! {tr({ fi: "Mikään todennäköisyys tai simulaatio ei takaa tulosta.", en: "No probability or simulation guarantees a result.", es: "Ninguna probabilidad o simulación garantiza un resultado." })}</div>
              <div className="rounded-xl bg-red-400/10 p-4">✕ {tr({ fi: "Scorecaster ei ota vastaan rahaa eikä aseta vetoa puolestasi.", en: "Scorecaster does not accept money or place bets for you.", es: "Scorecaster no acepta dinero ni realiza apuestas por ti." })}</div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
