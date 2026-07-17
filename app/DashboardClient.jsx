"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";
import Panel from "./components/Panel";
import { getTrackedBets } from "../lib/tracking-storage";
import { calculateTrackingStats } from "../lib/tracking-engine";
import { formatMoney, formatPercent } from "../lib/analysis-engine";

const steps = [
  {
    number: "1",
    title: "Aseta paperirajat",
    description: "Määritä virtuaalinen pelikassa ja enimmäispanos. Oikeaa rahaa ei liiku.",
    href: "/risk",
    action: "Avaa riskiasetukset"
  },
  {
    number: "2",
    title: "Katso päivän analyysit",
    description: "AI näyttää PLAY-, WATCH- ja SKIP-päätökset sekä perustelut ja vastaväitteet.",
    href: "/agent",
    action: "Avaa AI-analyysi"
  },
  {
    number: "3",
    title: "Seuraa paperituloksia",
    description: "Tallenna vain virtuaalisia kohteita ja seuraa ROI:ta, CLV:tä ja kalibrointia.",
    href: "/tracking",
    action: "Avaa seuranta"
  }
];

const tools = [
  {
    title: "Kohteet",
    href: "/betting",
    description: "Valitse laji ja liiga. Vertaa kertoimia ja näe edge, EV sekä datan laatu.",
    label: "Vertaa markkinaa"
  },
  {
    title: "AI-analyysi",
    href: "/agent",
    description: "Palvelimen laskema portfolio, stressitesti, vastaväite ja valvottu selitys.",
    label: "Avaa Agent V10"
  },
  {
    title: "Simulaattori",
    href: "/simulator",
    description: "Testaa omia ratingeja toistettavalla simulaatiolla ilman rahaa.",
    label: "Simuloi ottelu"
  },
  {
    title: "Analyysi",
    href: "/analytics",
    description: "Seuraa paperitulosta, CLV:tä, Brier scorea ja todennäköisyyksien rehellisyyttä.",
    label: "Katso suorituskyky"
  }
];

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
  const [topPicks, setTopPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [trackingStats, setTrackingStats] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Analyysia ei voitu ladata.");
        setTopPicks(Array.isArray(data.featured) && data.featured.length ? data.featured : (Array.isArray(data.data) ? data.data.slice(0, 3) : []));
        setSource(data.source || "no-vig-market-consensus");
      } catch {
        setTopPicks([]);
        setSource("ei saatavilla");
      } finally {
        setLoading(false);
      }
    }

    const tracked = getTrackedBets();
    setTrackingStats(calculateTrackingStats(tracked));
    void load();
  }, []);

  const summary = useMemo(() => {
    const play = topPicks.filter((pick) => decisionLabel(pick) === "PLAY").length;
    const bestEdge = topPicks.reduce((best, pick) => Math.max(best, Number(pick.edge || 0)), 0);
    return { play, bestEdge };
  }, [topPicks]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="relative max-w-4xl">
          <div className="mb-5 inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-sm font-black text-yellow-200">
            Paperitila · ei talletuksia, maksuja tai oikean rahan vetoja
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Ymmärrä urheilumarkkinaa ilman että sinun tarvitsee olla vedonlyöntiasiantuntija.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Scorecaster vertaa kertoimia, näyttää epävarmuuden, haastaa oman AI-suosituksensa ja seuraa vain virtuaalisia paperituloksia.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/agent" className="rounded-2xl bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 shadow-lg shadow-emerald-400/20 hover:bg-emerald-300">
              Aloita AI-analyysistä
            </Link>
            <Link href="/betting" className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center font-black text-white hover:bg-white/10">
              Selaa päivän kohteita
            </Link>
            <Link href="/help" className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-6 py-4 text-center font-black text-sky-200 hover:bg-sky-400/20">
              Näytä käyttöohje
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="start-title">
        <div className="mb-4">
          <h2 id="start-title" className="text-2xl font-black">Aloita kolmessa vaiheessa</h2>
          <p className="mt-1 text-slate-400">Tämä on suositeltu polku ensimmäisellä käyttökerralla.</p>
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
        <StatCard title="Päivän kohteet" value={loading ? "…" : String(topPicks.length)} subtitle={`Lähde: ${source}`} tone="blue" />
        <StatCard title="PLAY-päätökset" value={loading ? "…" : String(summary.play)} subtitle="Vain läpäisseet kohteet" tone="green" />
        <StatCard title="Korkein edge" value={loading ? "…" : formatPercent(summary.bestEdge)} subtitle="Paras hinta vs konsensus" />
        <StatCard title="Paperitulos" value={trackingStats ? formatMoney(trackingStats.totalProfit) : "0,00 €"} subtitle={trackingStats ? `${trackingStats.totalBets} tallennettua` : "Ei historiaa"} tone={trackingStats?.totalProfit >= 0 ? "green" : "red"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Panel title="Päätoiminnot" subtitle="Kaikki mitä tavallinen käyttäjä tarvitsee">
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
          <Panel title="Päivän Top 3" subtitle="Palvelimen nykyinen analyysi">
            <div className="space-y-3">
              {loading && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Analysoidaan markkinaa…</div>}
              {!loading && topPicks.length === 0 && (
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
                  Riittävän laadukasta aineistoa ei löytynyt juuri nyt. SKIP on hyväksytty lopputulos.
                </div>
              )}
              {topPicks.map((pick, index) => {
                const decision = decisionLabel(pick);
                return (
                  <div key={`${pick.id || pick.match}-${pick.selection}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">{pick.leagueTitle || pick.league || "Urheilu"}</div>
                        <div className="mt-1 truncate font-black">{pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`}</div>
                        <div className="mt-1 text-sm text-slate-400">{pick.selection || pick.label || "Valinta"} @ {Number(pick.odds || 0).toFixed(2)}</div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-xs font-black ${decisionClass(decision)}`}>{decision}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">Edge</div><div className="font-black">{formatPercent(pick.edge)}</div></div>
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">EV</div><div className="font-black">{formatPercent(pick.ev)}</div></div>
                      <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">Luottamus</div><div className="font-black">{formatPercent(pick.confidence)}</div></div>
                    </div>
                  </div>
                );
              })}
              <Link href="/agent" className="block rounded-xl bg-fuchsia-400 px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-fuchsia-300">
                Avaa perustelut ja vastaväitteet
              </Link>
            </div>
          </Panel>

          <Panel title="Muista" subtitle="Scorecasterin rajat">
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">✓ AI voi sanoa PLAY, WATCH tai SKIP.</div>
              <div className="rounded-xl bg-sky-400/10 p-4">✓ Kaikki panokset ja saldot ovat virtuaalisia.</div>
              <div className="rounded-xl bg-yellow-400/10 p-4">! Mikään todennäköisyys tai simulaatio ei takaa tulosta.</div>
              <div className="rounded-xl bg-red-400/10 p-4">✕ Scorecaster ei ota vastaan rahaa eikä aseta vetoa puolestasi.</div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
