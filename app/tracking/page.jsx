"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import { getTrackedBets, settleTrackedBet, deleteTrackedBet, clearTrackedBets, updateClosingOdds } from "../../lib/tracking-storage";
import { calculateTrackingStats, calculateProfitLoss, calculateCLV } from "../../lib/tracking-engine";
import { formatPercent } from "../../lib/analysis-engine";

function StatBox({ title, value, subtitle, tone = "default" }) {
  const color = tone === "green" ? "text-emerald-300" : tone === "red" ? "text-red-300" : tone === "blue" ? "text-sky-300" : tone === "yellow" ? "text-yellow-300" : "text-white";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{title}</div><div className={`mt-2 text-3xl font-black ${color}`}>{value}</div>{subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}</div>;
}

function resultClass(result) {
  if (result === "win") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (result === "loss") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (result === "push") return "border-sky-400/30 bg-sky-400/10 text-sky-300";
  return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
}

export default function TrackingPage() {
  const { tr, t, locale } = useLanguage();
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const resultLabel = (result) => result === "win" ? tr({ fi: "Voitto", en: "Win", es: "Victoria" }) : result === "loss" ? tr({ fi: "Tappio", en: "Loss", es: "Derrota" }) : result === "push" ? tr({ fi: "Palautus", en: "Push", es: "Nulo" }) : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  useEffect(() => { refresh(); }, []);
  function refresh() { setBets(getTrackedBets()); }
  function settleBet(id, result) { settleTrackedBet(id, result); refresh(); }
  function removeBet(id) {
    if (!window.confirm(tr({ fi: "Poistetaanko tämä paperikohde historiasta?", en: "Remove this paper pick from history?", es: "¿Eliminar este pronóstico simulado del historial?" }))) return;
    deleteTrackedBet(id); refresh();
  }
  function clearAll() {
    if (!window.confirm(tr({ fi: "Poistetaanko koko paikallinen paperihistoria? Tätä ei voi perua.", en: "Delete the entire local paper history? This cannot be undone.", es: "¿Eliminar todo el historial simulado local? No se puede deshacer." }))) return;
    clearTrackedBets(); refresh();
  }
  function changeClosingOdds(id, value) { updateClosingOdds(id, value); refresh(); }

  const stats = calculateTrackingStats(bets);
  const filteredBets = bets.filter((bet) => {
    if (filter === "all") return true;
    if (filter === "open") return bet.result === "pending";
    if (filter === "settled") return bet.result !== "pending";
    if (filter === "wins") return bet.result === "win";
    if (filter === "losses") return bet.result === "loss";
    if (filter === "pushes") return bet.result === "push";
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-300">{tr({ fi: "Paikallinen paperiseuranta", en: "Local paper tracking", es: "Seguimiento simulado local" })}</div>
        <h1 className="text-4xl font-black tracking-tight">{t("nav.tracking")}</h1>
        <p className="mt-3 max-w-3xl text-slate-300">{tr({ fi: "Kirjaa virtuaaliset lopputulokset ja seuraa päätöksenteon laatua. Tällä sivulla ei aseteta oikean rahan vetoja.", en: "Record virtual results and track decision quality. This page does not place real-money bets.", es: "Registra resultados virtuales y sigue la calidad de las decisiones. Esta página no realiza apuestas con dinero real." })}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/betting" className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">{tr({ fi: "Lisää paperikohde", en: "Add paper pick", es: "Añadir pronóstico simulado" })}</Link>
          <Link href="/analytics" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black">{tr({ fi: "Avaa tarkempi analyysi", en: "Open detailed analytics", es: "Abrir analítica detallada" })}</Link>
          {bets.length > 0 && <button onClick={clearAll} className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-black text-red-300 hover:bg-red-400/20">{tr({ fi: "Tyhjennä paikallinen historia", en: "Clear local history", es: "Borrar historial local" })}</button>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox title={tr({ fi: "Paperikohteet", en: "Paper picks", es: "Pronósticos simulados" })} value={stats.totalBets} subtitle={`${stats.openBets} ${tr({ fi: "avoinna", en: "open", es: "abiertos" })}`} />
        <StatBox title="ROI" value={formatPercent(stats.roi)} tone="blue" />
        <StatBox title={t("home.paperResult")} value={money(stats.totalProfit)} tone={stats.totalProfit >= 0 ? "green" : "red"} />
        <StatBox title={tr({ fi: "Osumaprosentti", en: "Win rate", es: "Porcentaje de acierto" })} value={formatPercent(stats.winRate)} tone="yellow" />
      </section>

      <details className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <summary className="cursor-pointer font-black text-slate-200">{tr({ fi: "Näytä edistyneet mittarit", en: "Show advanced metrics", es: "Mostrar métricas avanzadas" })}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatBox title={tr({ fi: "Keskimääräinen edge", en: "Average edge", es: "Ventaja media" })} value={formatPercent(stats.averageEdge)} tone="green" />
          <StatBox title={tr({ fi: "Keskimääräinen EV", en: "Average EV", es: "EV medio" })} value={formatPercent(stats.averageEV)} tone="blue" />
          <StatBox title={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={formatPercent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} />
          <StatBox title={tr({ fi: "Keskimääräinen kerroin", en: "Average odds", es: "Cuota media" })} value={stats.averageOdds.toFixed(2)} />
          <StatBox title={tr({ fi: "Voitot", en: "Wins", es: "Victorias" })} value={stats.wins} tone="green" />
          <StatBox title={tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })} value={stats.losses} tone="red" />
          <StatBox title={tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })} value={stats.pushes} />
          <StatBox title={tr({ fi: "Nykyinen putki", en: "Current streak", es: "Racha actual" })} value={stats.currentStreak} />
        </div>
      </details>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Näytä", en: "Show", es: "Mostrar" })}
            <select aria-label={tr({ fi: "Suodata paperikohteita", en: "Filter paper picks", es: "Filtrar pronósticos simulados" })} value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none">
              <option value="all">{tr({ fi: "Kaikki kohteet", en: "All picks", es: "Todos" })}</option><option value="open">{tr({ fi: "Avoimet", en: "Open", es: "Abiertos" })}</option><option value="settled">{tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" })}</option><option value="wins">{tr({ fi: "Voitot", en: "Wins", es: "Victorias" })}</option><option value="losses">{tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })}</option><option value="pushes">{tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })}</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Järjestys", en: "Order", es: "Orden" })}
            <select aria-label={tr({ fi: "Järjestä paperikohteet", en: "Sort paper picks", es: "Ordenar pronósticos" })} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none"><option value="newest">{tr({ fi: "Uusin ensin", en: "Newest first", es: "Más recientes primero" })}</option><option value="oldest">{tr({ fi: "Vanhin ensin", en: "Oldest first", es: "Más antiguos primero" })}</option></select>
          </label>
        </div>
      </section>

      <Panel title={tr({ fi: "Paperikohteet", en: "Paper picks", es: "Pronósticos simulados" })} subtitle={tr({ fi: "Lopputulos, paperitulos ja päätöskerroin", en: "Result, paper profit and closing odds", es: "Resultado, beneficio simulado y cuota de cierre" })}>
        <div className="space-y-4">
          {filteredBets.length === 0 && <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">{tr({ fi: "Tällä suodattimella ei ole kohteita. Lisää ensimmäinen Kohteet- tai AI-sivulta.", en: "No picks match this filter. Add the first one from Picks or AI.", es: "No hay pronósticos con este filtro. Añade el primero desde Pronósticos o IA." })}</div>}
          {filteredBets.map((bet) => {
            const profit = calculateProfitLoss({ stake: bet.stake, odds: bet.odds, result: bet.result });
            const clv = calculateCLV({ odds: bet.odds, closingOdds: bet.closingOdds });
            return (
              <article key={bet.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${resultClass(bet.result)}`}>{resultLabel(bet.result)}</span><span className="text-xs text-slate-500">{bet.createdAt ? new Date(bet.createdAt).toLocaleString(locale) : tr({ fi: "Päivämäärä puuttuu", en: "Date missing", es: "Falta la fecha" })}</span></div><h2 className="mt-3 text-xl font-black">{bet.match}</h2><div className="mt-2 text-sm text-slate-400">{bet.selection} @ {bet.odds}</div></div>
                  <div className="rounded-xl bg-slate-950 px-4 py-3 lg:text-right"><div className="text-sm text-slate-400">{t("term.paperStake")}</div><div className="mt-1 text-xl font-black text-emerald-300">{money(bet.stake)}</div></div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-400">{t("term.edge")}</div><div className="mt-2 text-xl font-black text-emerald-300">{formatPercent(bet.edge)}</div></div>
                  <div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-400">{t("term.ev")}</div><div className="mt-2 text-xl font-black text-sky-300">{formatPercent(bet.ev)}</div></div>
                  <label className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">{tr({ fi: "Päätöskerroin", en: "Closing odds", es: "Cuota de cierre" })}<input value={bet.closingOdds || ""} onChange={(event) => changeClosingOdds(bet.id, event.target.value)} placeholder="1.95" inputMode="decimal" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" /></label>
                  <div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-400">CLV</div><div className={`mt-2 text-xl font-black ${clv >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatPercent(clv)}</div></div>
                  <div className="rounded-xl bg-slate-950 p-4"><div className="text-sm text-slate-400">{t("home.paperResult")}</div><div className={`mt-2 text-xl font-black ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(profit)}</div></div>
                </div>
                {bet.riskWarnings?.length > 0 && <details className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4"><summary className="cursor-pointer font-bold text-yellow-300">{tr({ fi: "Näytä riskivaroitukset", en: "Show risk warnings", es: "Mostrar avisos de riesgo" })}</summary><ul className="mt-2 space-y-1 text-sm text-slate-300">{bet.riskWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></details>}
                <div className="mt-5 flex flex-wrap gap-3">
                  {bet.result === "pending" ? <><button onClick={() => settleBet(bet.id, "win")} className="rounded-xl bg-emerald-400 px-4 py-2 font-black text-slate-950">{tr({ fi: "Merkitse voitoksi", en: "Mark as win", es: "Marcar victoria" })}</button><button onClick={() => settleBet(bet.id, "loss")} className="rounded-xl bg-red-400 px-4 py-2 font-black text-slate-950">{tr({ fi: "Merkitse tappioksi", en: "Mark as loss", es: "Marcar derrota" })}</button><button onClick={() => settleBet(bet.id, "push")} className="rounded-xl bg-yellow-400 px-4 py-2 font-black text-slate-950">{tr({ fi: "Merkitse palautukseksi", en: "Mark as push", es: "Marcar nulo" })}</button></> : <button onClick={() => settleBet(bet.id, "pending")} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-black text-slate-300">{tr({ fi: "Avaa uudelleen", en: "Reopen", es: "Reabrir" })}</button>}
                  <button onClick={() => removeBet(bet.id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-black text-slate-300">{t("common.delete")}</button>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
