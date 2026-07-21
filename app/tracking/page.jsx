"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import {
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";
import {
  getTrackedBets,
  settleTrackedBet,
  deleteTrackedBet,
  clearTrackedBets,
  updateClosingOdds
} from "../../lib/tracking-storage";
import {
  calculateTrackingStats,
  calculateProfitLoss,
  calculateCLV
} from "../../lib/tracking-engine";
import { formatPercent } from "../../lib/analysis-engine";

function resultStyle(result) {
  if (result === "win") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  if (result === "loss") return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  if (result === "push") return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
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
  const filteredBets = useMemo(() => bets.filter((bet) => {
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
  }), [bets, filter, sortOrder]);

  const settled = stats.wins + stats.losses + stats.pushes;
  const heroAside = <div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Avoinna", en: "Open", es: "Abiertos" })} value={stats.openBets} tone="yellow" /><MetricTile compact label={tr({ fi: "Ratkaistu", en: "Settled", es: "Resueltos" })} value={settled} tone="blue" /><MetricTile compact label="ROI" value={formatPercent(stats.roi)} tone={stats.roi >= 0 ? "green" : "red"} /><MetricTile compact label="CLV" value={formatPercent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} /></div>;

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow={tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })}
        title={tr({ fi: "Avoimet päätökset, tulokset ja oppiminen yhdessä", en: "Open decisions, results and learning in one place", es: "Decisiones abiertas, resultados y aprendizaje juntos" })}
        description={tr({ fi: "Seuraa virtuaalisia kohteita, kirjaa lopputulos ja lisää päätöskerroin CLV-laskentaa varten. Tämä sivu ei aseta oikean rahan vetoja.", en: "Track virtual picks, record the outcome and add closing odds for CLV analysis. This page never places real-money bets.", es: "Sigue pronósticos virtuales, registra el resultado y añade la cuota de cierre para CLV. Esta página nunca realiza apuestas con dinero real." })}
        actions={<><Link href="/betting" className="sc-button-primary">{tr({ fi: "Lisää uusi paperikohde", en: "Add a paper pick", es: "Añadir pronóstico simulado" })}</Link><Link href="/analytics" className="sc-button-secondary">{tr({ fi: "Avaa analytiikka", en: "Open analytics", es: "Abrir analítica" })}</Link><Link href="/agent" className="sc-button-ghost">{tr({ fi: "Avaa AI-agentti", en: "Open AI Agent", es: "Abrir agente IA" })}</Link></>}
        aside={heroAside}
      />

      <TrustBar items={[
        { label: tr({ fi: "Tallennus", en: "Storage", es: "Almacenamiento" }), value: tr({ fi: "paikallinen laite", en: "local device", es: "dispositivo local" }), tone: "info" },
        { label: tr({ fi: "Kohteita", en: "Picks", es: "Pronósticos" }), value: stats.totalBets },
        { label: tr({ fi: "Osumaprosentti", en: "Win rate", es: "Acierto" }), value: formatPercent(stats.winRate), tone: "warning" },
        { label: tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulado" }) }
      ]} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(stats.totalProfit)} tone={stats.totalProfit >= 0 ? "green" : "red"} />
        <MetricTile label="ROI" value={formatPercent(stats.roi)} tone={stats.roi >= 0 ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={formatPercent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Osumaprosentti", en: "Win rate", es: "Porcentaje de acierto" })} value={formatPercent(stats.winRate)} tone="blue" />
      </section>

      <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><summary className="cursor-pointer font-black text-white">{tr({ fi: "Näytä edistyneet mittarit", en: "Show advanced metrics", es: "Mostrar métricas avanzadas" })}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricTile label={tr({ fi: "Keskimääräinen edge", en: "Average edge", es: "Ventaja media" })} value={formatPercent(stats.averageEdge)} tone="green" /><MetricTile label={tr({ fi: "Keskimääräinen EV", en: "Average EV", es: "EV medio" })} value={formatPercent(stats.averageEV)} tone="blue" /><MetricTile label={tr({ fi: "Keskimääräinen kerroin", en: "Average odds", es: "Cuota media" })} value={stats.averageOdds.toFixed(2)} /><MetricTile label={tr({ fi: "Nykyinen putki", en: "Current streak", es: "Racha actual" })} value={stats.currentStreak} tone="purple" /><MetricTile label={tr({ fi: "Voitot", en: "Wins", es: "Victorias" })} value={stats.wins} tone="green" /><MetricTile label={tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })} value={stats.losses} tone="red" /><MetricTile label={tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })} value={stats.pushes} tone="blue" /><MetricTile label={tr({ fi: "Avoimet", en: "Open", es: "Abiertos" })} value={stats.openBets} tone="yellow" /></div></details>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Salkun sisältö", en: "Portfolio contents", es: "Contenido de cartera" })} title={tr({ fi: "Paperikohteet", en: "Paper picks", es: "Pronósticos simulados" })} description={tr({ fi: "Suodata avoimet tai ratkaistut kohteet. Lopputulos ja päätöskerroin päivittävät paperituloksen sekä CLV:n.", en: "Filter open or settled picks. Outcome and closing odds update paper profit and CLV.", es: "Filtra pronósticos abiertos o resueltos. Resultado y cuota de cierre actualizan beneficio y CLV." })} action={bets.length > 0 ? <button type="button" onClick={clearAll} className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-2 text-sm font-black text-rose-200">{tr({ fi: "Poista koko paikallinen historia", en: "Delete local history", es: "Eliminar historial local" })}</button> : null} />

        <div className="mb-5 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Näytä", en: "Show", es: "Mostrar" })}<select aria-label={tr({ fi: "Suodata paperikohteita", en: "Filter paper picks", es: "Filtrar pronósticos simulados" })} value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"><option value="all">{tr({ fi: "Kaikki kohteet", en: "All picks", es: "Todos" })}</option><option value="open">{tr({ fi: "Avoimet", en: "Open", es: "Abiertos" })}</option><option value="settled">{tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" })}</option><option value="wins">{tr({ fi: "Voitot", en: "Wins", es: "Victorias" })}</option><option value="losses">{tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })}</option><option value="pushes">{tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })}</option></select></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Järjestys", en: "Order", es: "Orden" })}<select aria-label={tr({ fi: "Järjestä paperikohteet", en: "Sort paper picks", es: "Ordenar pronósticos" })} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"><option value="newest">{tr({ fi: "Uusin ensin", en: "Newest first", es: "Más recientes primero" })}</option><option value="oldest">{tr({ fi: "Vanhin ensin", en: "Oldest first", es: "Más antiguos primero" })}</option></select></label>
        </div>

        {filteredBets.length === 0 ? <EmptyState title={tr({ fi: "Tällä suodattimella ei ole kohteita", en: "No picks match this filter", es: "No hay pronósticos con este filtro" })} description={tr({ fi: "Lisää ensimmäinen kohde Kohteet- tai AI-agentti-sivulta.", en: "Add the first pick from Picks or the AI Agent.", es: "Añade el primer pronóstico desde Pronósticos o el agente IA." })} actionHref="/betting" actionLabel={tr({ fi: "Avaa kohteet", en: "Open picks", es: "Abrir pronósticos" })} /> : <div className="space-y-4">{filteredBets.map((bet) => {
          const profit = calculateProfitLoss({ stake: bet.stake, odds: bet.odds, result: bet.result });
          const clv = calculateCLV({ odds: bet.odds, closingOdds: bet.closingOdds });
          return <article key={bet.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-xl"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${resultStyle(bet.result)}`}>{resultLabel(bet.result)}</span><span className="text-xs text-slate-500">{bet.createdAt ? new Date(bet.createdAt).toLocaleString(locale) : tr({ fi: "Päivämäärä puuttuu", en: "Date missing", es: "Falta la fecha" })}</span></div><h2 className="mt-3 text-xl font-black tracking-tight text-white md:text-2xl">{bet.match}</h2><div className="mt-2 text-slate-300"><strong>{bet.selection}</strong> @ {bet.odds}</div></div><MetricTile label={t("term.paperStake")} value={money(bet.stake)} tone="purple" /></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><MetricTile label={t("term.edge")} value={formatPercent(bet.edge)} tone="green" /><MetricTile label={t("term.ev")} value={formatPercent(bet.ev)} tone="blue" /><label className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{tr({ fi: "Päätöskerroin", en: "Closing odds", es: "Cuota de cierre" })}<input value={bet.closingOdds || ""} onChange={(event) => changeClosingOdds(bet.id, event.target.value)} placeholder="1.95" inputMode="decimal" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-base font-black normal-case tracking-normal text-white" /></label><MetricTile label="CLV" value={formatPercent(clv)} tone={clv >= 0 ? "green" : "red"} /><MetricTile label={t("home.paperResult")} value={money(profit)} tone={profit >= 0 ? "green" : "red"} /></div>{bet.riskWarnings?.length > 0 && <details className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><summary className="cursor-pointer font-bold text-amber-200">{tr({ fi: "Näytä riskivaroitukset", en: "Show risk warnings", es: "Mostrar avisos de riesgo" })}</summary><ul className="mt-3 space-y-1 text-sm text-slate-300">{bet.riskWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></details>}<div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{bet.result === "pending" ? <><button onClick={() => settleBet(bet.id, "win")} className="sc-button-primary">{tr({ fi: "Merkitse voitoksi", en: "Mark as win", es: "Marcar victoria" })}</button><button onClick={() => settleBet(bet.id, "loss")} className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100">{tr({ fi: "Merkitse tappioksi", en: "Mark as loss", es: "Marcar derrota" })}</button><button onClick={() => settleBet(bet.id, "push")} className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100">{tr({ fi: "Merkitse palautukseksi", en: "Mark as push", es: "Marcar nulo" })}</button></> : <button onClick={() => settleBet(bet.id, "pending")} className="sc-button-secondary">{tr({ fi: "Avaa uudelleen", en: "Reopen", es: "Reabrir" })}</button>}<button onClick={() => removeBet(bet.id)} className="sc-button-ghost">{t("common.delete")}</button></div></article>;
        })}</div>}
      </section>
    </div>
  );
}
