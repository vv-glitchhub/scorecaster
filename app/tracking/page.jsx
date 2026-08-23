"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";
import {
  getTrackedBets,
  settleTrackedBet,
  deleteTrackedBet,
  clearTrackedBets,
  updateClosingOdds
} from "../../lib/tracking-storage";
import { calculateTrackingStats, calculateProfitLoss, calculateCLV } from "../../lib/tracking-engine";
import { formatPercent } from "../../lib/analysis-engine";
import MatchStoryCard from "./MatchStoryCard";

function resultStyle(result) {
  if (result === "win") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  if (result === "loss") return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  if (result === "push") return "border-sky-300/30 bg-sky-300/10 text-sky-200";
  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

function marketOnlyMode(value) {
  const mode = String(value || "").toLowerCase();
  return mode.includes("market") && (
    mode.includes("consensus") || mode.includes("benchmark") || mode.includes("implied")
  );
}

function marketOnlyEvidence(value = {}) {
  if (marketOnlyMode(value.modelMode)) return true;
  return /scorecaster-(?:betting-consensus|market-universe-v1|agent-v11-model-lab|events)/i.test(String(value.source || ""));
}

function normalizeLocalBet(bet = {}) {
  const marketOnly = marketOnlyEvidence(bet);
  return {
    ...bet,
    modelProbability: marketOnly ? null : bet.modelProbability ?? null,
    marketProbability: bet.marketProbability ?? (marketOnly ? bet.modelProbability : null)
  };
}

function getSafeLocalBets() {
  return getTrackedBets().map(normalizeLocalBet);
}

function normalizeCloudBet(bet = {}) {
  const raw = bet.raw_pick && typeof bet.raw_pick === "object" ? bet.raw_pick : {};
  const marketOnly = marketOnlyEvidence(raw);
  const result = bet.status === "won" ? "win" : bet.status === "lost" ? "loss" : ["push", "void"].includes(bet.status) ? "push" : "pending";
  return {
    id: bet.id,
    createdAt: bet.created_at,
    status: bet.status === "open" ? "open" : "settled",
    result,
    closingOdds: bet.closing_odds ?? "",
    match: bet.match || [bet.home_team, bet.away_team].filter(Boolean).join(" – ") || "Paper pick",
    selection: bet.label,
    odds: Number(bet.odds || 0),
    stake: Number(bet.stake || 0),
    edge: bet.edge,
    ev: bet.ev,
    confidence: bet.confidence,
    bookmaker: bet.bookmaker,
    market: bet.market,
    league: bet.league,
    homeTeam: bet.home_team,
    awayTeam: bet.away_team,
    sportKey: bet.sport,
    eventId: String(raw.eventId || "").trim(),
    modelProbability: marketOnly ? null : raw.modelProbability ?? null,
    marketProbability: raw.entryMarketProbability ?? raw.impliedProbability ?? (marketOnly ? raw.modelProbability : null),
    decision: raw.decision,
    riskWarnings: Array.isArray(raw.riskWarnings) ? raw.riskWarnings : [],
    cloud: true
  };
}

function parseClosingOdds(value) {
  const text = String(value ?? "").trim();
  if (!text) return { valid: true, value: null };
  const parsed = Number(text.replace(",", "."));
  return { valid: Number.isFinite(parsed) && parsed > 1, value: parsed };
}

async function payloadOf(response) {
  return response.json().catch(() => ({}));
}

export default function TrackingPage() {
  const { tr, t, locale } = useLanguage();
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [storageMode, setStorageMode] = useState("loading");
  const [localCount, setLocalCount] = useState(0);
  const [monitor, setMonitor] = useState(null);
  const [closingDrafts, setClosingDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currency = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }), [locale]);
  const money = (value) => currency.format(Number(value || 0));
  const resultLabel = (result) => result === "win"
    ? tr({ fi: "Voitto", en: "Win", es: "Victoria" })
    : result === "loss"
      ? tr({ fi: "Tappio", en: "Loss", es: "Derrota" })
      : result === "push"
        ? tr({ fi: "Palautus", en: "Push", es: "Nulo" })
        : tr({ fi: "Avoin", en: "Open", es: "Abierto" });

  const loadPortfolio = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    const localBets = getSafeLocalBets();
    setLocalCount(localBets.length);
    try {
      const [betsResponse, monitorResponse] = await Promise.all([
        fetch("/api/cloud/bets", { cache: "no-store" }),
        fetch("/api/cloud/settlement-monitor", { cache: "no-store" }).catch(() => null)
      ]);
      const payload = await payloadOf(betsResponse);
      if (betsResponse.status === 401) {
        setStorageMode("local");
        setBets(localBets);
        setMonitor(null);
        setClosingDrafts(Object.fromEntries(localBets.map((bet) => [bet.id, String(bet.closingOdds ?? "")])));
        return;
      }
      if (!betsResponse.ok || !payload.ok) throw new Error(payload.error || "Cloud history could not be loaded");

      const cloudBets = (payload.data || []).map(normalizeCloudBet);
      setStorageMode("cloud");
      setBets(cloudBets);
      setClosingDrafts(Object.fromEntries(cloudBets.map((bet) => [bet.id, String(bet.closingOdds ?? "")])));
      if (monitorResponse?.ok) {
        const monitorPayload = await payloadOf(monitorResponse);
        setMonitor(monitorPayload.ok ? monitorPayload : null);
      } else setMonitor(null);
    } catch (cause) {
      setStorageMode("local");
      setBets(localBets);
      setMonitor(null);
      setClosingDrafts(Object.fromEntries(localBets.map((bet) => [bet.id, String(bet.closingOdds ?? "")])));
      setError(cause instanceof Error ? cause.message : "Cloud history could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPortfolio(); }, [loadPortfolio]);

  async function settleBet(id, result) {
    if (storageMode === "local") {
      settleTrackedBet(id, result);
      setBets(getSafeLocalBets());
      return;
    }
    const closing = parseClosingOdds(closingDrafts[id]);
    if (!closing.valid) {
      setError(tr({ fi: "Päätöskertoimen pitää olla suurempi kuin 1,00 tai kenttä jätetään tyhjäksi.", en: "Closing odds must be greater than 1.00 or left empty.", es: "La cuota de cierre debe ser superior a 1,00 o quedar vacía." }));
      return;
    }
    const status = result === "win" ? "won" : result === "loss" ? "lost" : result === "push" ? "push" : "open";
    setBusy(id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/bets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, result: status, closingOdds: closing.value })
      });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Paper pick could not be updated");
      setMessage(tr({ fi: "Paperikohde päivitettiin käyttäjätilille.", en: "The paper pick was updated in your account.", es: "El pronóstico se actualizó en tu cuenta." }));
      await loadPortfolio({ silent: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper pick could not be updated");
    } finally { setBusy(""); }
  }

  async function removeBet(id) {
    if (!window.confirm(tr({ fi: "Poistetaanko tämä paperikohde historiasta? Poisto vaikuttaa myös tunnuslukuihin.", en: "Remove this paper pick from history? Deletion also affects metrics.", es: "¿Eliminar este pronóstico simulado del historial? La eliminación también afecta las métricas." }))) return;
    if (storageMode === "local") {
      deleteTrackedBet(id);
      const localBets = getSafeLocalBets();
      setBets(localBets); setLocalCount(localBets.length);
      return;
    }
    setBusy(id); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/bets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Paper pick could not be deleted");
      setBets((current) => current.filter((bet) => bet.id !== id));
      setMessage(tr({ fi: "Paperikohde poistettiin käyttäjätililtä.", en: "The paper pick was removed from your account.", es: "El pronóstico se eliminó de tu cuenta." }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper pick could not be deleted");
    } finally { setBusy(""); }
  }

  function clearAll() {
    if (!window.confirm(tr({ fi: "Poistetaanko koko paikallinen paperihistoria? Tätä ei voi perua.", en: "Delete the entire local paper history? This cannot be undone.", es: "¿Eliminar todo el historial local? No se puede deshacer." }))) return;
    clearTrackedBets(); setBets([]); setLocalCount(0); setClosingDrafts({});
  }

  function changeClosingOdds(id, value) {
    setClosingDrafts((current) => ({ ...current, [id]: value }));
    if (storageMode === "local") { updateClosingOdds(id, value); setBets(getSafeLocalBets()); }
  }

  async function checkResults() {
    if (storageMode !== "cloud") return;
    setBusy("settle-all"); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/bets/settle", { method: "POST" });
      const payload = await payloadOf(response);
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Result check failed");
      const warnings = Number(payload.providerWarnings?.length || 0) + Number(payload.updateFailures || 0);
      setMessage(tr({
        fi: `Tarkistettiin ${payload.checked || 0}, ratkaistiin ${payload.settled || 0} ja avoimeksi jäi ${payload.pending || 0}.${warnings ? ` Varoituksia ${warnings}.` : ""}`,
        en: `Checked ${payload.checked || 0}, settled ${payload.settled || 0} and ${payload.pending || 0} remain open.${warnings ? ` Warnings: ${warnings}.` : ""}`,
        es: `Se comprobaron ${payload.checked || 0}, se resolvieron ${payload.settled || 0} y quedan ${payload.pending || 0}.${warnings ? ` Avisos: ${warnings}.` : ""}`
      }));
      await loadPortfolio({ silent: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Result check failed");
    } finally { setBusy(""); }
  }

  async function syncLocalHistory() {
    const localBets = getSafeLocalBets();
    if (storageMode !== "cloud" || !localBets.length) return;
    setBusy("sync-local"); setMessage(""); setError("");
    try {
      const response = await fetch("/api/cloud/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets: localBets.map((bet) => ({ ...bet, source: "local-tracking-migration-v1" })) })
      });
      const payload = await payloadOf(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Local history could not be synced");
      setMessage(tr({ fi: `${payload.synced || 0} paikallista kohdetta siirrettiin pilveen. Paikallinen varmuuskopio säilytettiin.`, en: `${payload.synced || 0} local picks were synced. The local backup was kept.`, es: `${payload.synced || 0} pronósticos se sincronizaron. Se conservó la copia local.` }));
      await loadPortfolio({ silent: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local history could not be synced");
    } finally { setBusy(""); }
  }

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
    const delta = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    return sortOrder === "newest" ? delta : -delta;
  }), [bets, filter, sortOrder]);

  const settled = stats.wins + stats.losses + stats.pushes;
  const storageLabel = storageMode === "cloud" ? tr({ fi: "suojattu käyttäjätili", en: "protected user account", es: "cuenta protegida" }) : storageMode === "local" ? tr({ fi: "paikallinen varatila", en: "local fallback", es: "respaldo local" }) : tr({ fi: "tarkistetaan", en: "checking", es: "comprobando" });
  const heroAside = <div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Avoinna", en: "Open", es: "Abiertos" })} value={stats.openBets} tone="yellow" /><MetricTile compact label={tr({ fi: "Ratkaistu", en: "Settled", es: "Resueltos" })} value={settled} tone="blue" /><MetricTile compact label="ROI" value={formatPercent(stats.roi)} tone={stats.roi >= 0 ? "green" : "red"} /><MetricTile compact label="CLV" value={formatPercent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} /></div>;

  return (
    <div className="space-y-7">
      <PageHero eyebrow={tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })} title={tr({ fi: "Avoimet päätökset, tulokset ja oppiminen yhdessä", en: "Open decisions, results and learning in one place", es: "Decisiones abiertas, resultados y aprendizaje juntos" })} description={tr({ fi: "Seuraa tilillesi tallennettuja paperikohteita, tarkista tulokset ja lisää päätöskerroin CLV-laskentaan. Tämä sivu ei aseta oikean rahan vetoja.", en: "Track account-backed paper picks, check outcomes and add closing odds for CLV. This page never places real-money bets.", es: "Sigue pronósticos guardados, comprueba resultados y añade la cuota de cierre. Nunca apuesta dinero real." })} actions={<><Link href="/events" className="sc-button-primary">{tr({ fi: "Avaa varmennetut ottelut", en: "Open verified events", es: "Abrir eventos verificados" })}</Link><Link href="/analytics" className="sc-button-secondary">{tr({ fi: "Avaa analytiikka", en: "Open analytics", es: "Abrir analítica" })}</Link><Link href="/agent" className="sc-button-ghost">{tr({ fi: "Avaa AI-agentti", en: "Open AI Agent", es: "Abrir agente IA" })}</Link></>} aside={heroAside} />

      <TrustBar items={[
        { label: tr({ fi: "Tallennus", en: "Storage", es: "Almacenamiento" }), value: storageLabel, tone: storageMode === "cloud" ? "good" : "info" },
        { label: tr({ fi: "Kohteita", en: "Picks", es: "Pronósticos" }), value: stats.totalBets },
        { label: tr({ fi: "Osumaprosentti", en: "Win rate", es: "Acierto" }), value: formatPercent(stats.winRate), tone: "warning" },
        { label: tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulado" }) }
      ]} />

      {storageMode === "local" ? <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">{tr({ fi: "Näytetään tämän laitteen paikallinen historia. Kirjaudu, jotta käyttäjätilin kohteet näkyvät kaikilla laitteilla.", en: "Showing this device's local history. Sign in to access account-backed picks on every device.", es: "Se muestra el historial local. Inicia sesión para acceder a los pronósticos de tu cuenta." })} <Link href="/login" className="font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link></div> : null}
      {storageMode === "cloud" && localCount > 0 ? <div className="flex flex-col gap-3 rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm text-sky-100 sm:flex-row sm:items-center sm:justify-between"><span>{tr({ fi: `Tällä laitteella on lisäksi ${localCount} paikallista kohdetta.`, en: `This device also has ${localCount} local picks.`, es: `Este dispositivo también tiene ${localCount} pronósticos locales.` })}</span><button type="button" onClick={() => void syncLocalHistory()} disabled={busy !== ""} className="sc-button-secondary shrink-0 disabled:opacity-50">{busy === "sync-local" ? tr({ fi: "Siirretään…", en: "Syncing…", es: "Sincronizando…" }) : tr({ fi: "Siirrä pilveen", en: "Sync to cloud", es: "Sincronizar" })}</button></div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</div> : null}
      {message ? <div aria-live="polite" className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{message}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={tr({ fi: "Paperitulos", en: "Paper result", es: "Resultado simulado" })} value={money(stats.totalProfit)} tone={stats.totalProfit >= 0 ? "green" : "red"} />
        <MetricTile label="ROI" value={formatPercent(stats.roi)} tone={stats.roi >= 0 ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Keskimääräinen CLV", en: "Average CLV", es: "CLV medio" })} value={formatPercent(stats.averageCLV)} tone={stats.averageCLV >= 0 ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Osumaprosentti", en: "Win rate", es: "Porcentaje de acierto" })} value={formatPercent(stats.winRate)} tone="blue" />
      </section>

      {storageMode === "cloud" && monitor ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300"><strong className="text-white">{tr({ fi: "Automaattinen tulosseuranta", en: "Automatic result monitoring", es: "Seguimiento automático" })}: </strong>{monitor.monitorActive ? tr({ fi: "aktiivinen", en: "active", es: "activo" }) : tr({ fi: "ei aktiivinen", en: "not active", es: "inactivo" })}. {tr({ fi: "Viimeisin ajo", en: "Latest run", es: "Última ejecución" })}: {monitor.state?.last_completed_at ? new Date(monitor.state.last_completed_at).toLocaleString(locale) : "–"}. {tr({ fi: "Seuranta ei aseta vetoja eikä keksi puuttuvaa tulosta.", en: "Monitoring never places bets or invents missing results.", es: "El seguimiento no apuesta ni inventa resultados." })}</section> : null}

      <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><summary className="cursor-pointer font-black text-white">{tr({ fi: "Näytä edistyneet mittarit", en: "Show advanced metrics", es: "Mostrar métricas avanzadas" })}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricTile label={tr({ fi: "Keskimääräinen edge", en: "Average edge", es: "Ventaja media" })} value={formatPercent(stats.averageEdge)} tone="green" /><MetricTile label={tr({ fi: "Keskimääräinen EV", en: "Average EV", es: "EV medio" })} value={formatPercent(stats.averageEV)} tone="blue" /><MetricTile label={tr({ fi: "Keskimääräinen kerroin", en: "Average odds", es: "Cuota media" })} value={stats.averageOdds.toFixed(2)} /><MetricTile label={tr({ fi: "Nykyinen putki", en: "Current streak", es: "Racha actual" })} value={stats.currentStreak} tone="purple" /><MetricTile label={tr({ fi: "Voitot", en: "Wins", es: "Victorias" })} value={stats.wins} tone="green" /><MetricTile label={tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })} value={stats.losses} tone="red" /><MetricTile label={tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })} value={stats.pushes} tone="blue" /><MetricTile label={tr({ fi: "Avoimet", en: "Open", es: "Abiertos" })} value={stats.openBets} tone="yellow" /></div></details>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Salkun sisältö", en: "Portfolio contents", es: "Contenido de cartera" })} title={tr({ fi: "Paperikohteet", en: "Paper picks", es: "Pronósticos simulados" })} description={tr({ fi: "Lopputulos ja päätöskerroin päivittävät paperituloksen sekä CLV:n.", en: "Outcome and closing odds update paper profit and CLV.", es: "El resultado y la cuota de cierre actualizan beneficio y CLV." })} action={storageMode === "cloud" ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void checkResults()} disabled={busy !== "" || stats.openBets === 0} className="sc-button-secondary disabled:opacity-40">{busy === "settle-all" ? tr({ fi: "Tarkistetaan…", en: "Checking…", es: "Comprobando…" }) : tr({ fi: "Tarkista avoimien tulokset", en: "Check open results", es: "Comprobar resultados" })}</button><button type="button" onClick={() => void loadPortfolio()} disabled={busy !== "" || loading} className="sc-button-ghost disabled:opacity-40">{tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button></div> : bets.length ? <button type="button" onClick={clearAll} className="rounded-xl border border-rose-300/25 bg-rose-300/10 px-4 py-2 text-sm font-black text-rose-200">{tr({ fi: "Poista paikallinen historia", en: "Delete local history", es: "Eliminar historial local" })}</button> : null} />

        <div className="mb-5 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Näytä", en: "Show", es: "Mostrar" })}<select aria-label={tr({ fi: "Suodata paperikohteita", en: "Filter paper picks", es: "Filtrar pronósticos" })} value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"><option value="all">{tr({ fi: "Kaikki kohteet", en: "All picks", es: "Todos" })}</option><option value="open">{tr({ fi: "Avoimet", en: "Open", es: "Abiertos" })}</option><option value="settled">{tr({ fi: "Ratkaistut", en: "Settled", es: "Resueltos" })}</option><option value="wins">{tr({ fi: "Voitot", en: "Wins", es: "Victorias" })}</option><option value="losses">{tr({ fi: "Tappiot", en: "Losses", es: "Derrotas" })}</option><option value="pushes">{tr({ fi: "Palautukset", en: "Pushes", es: "Nulos" })}</option></select></label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Järjestys", en: "Order", es: "Orden" })}<select aria-label={tr({ fi: "Järjestä paperikohteet", en: "Sort paper picks", es: "Ordenar pronósticos" })} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"><option value="newest">{tr({ fi: "Uusin ensin", en: "Newest first", es: "Más recientes primero" })}</option><option value="oldest">{tr({ fi: "Vanhin ensin", en: "Oldest first", es: "Más antiguos primero" })}</option></select></label>
        </div>

        {loading ? <div className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/[0.035]" /> : filteredBets.length === 0 ? <EmptyState title={tr({ fi: "Tällä suodattimella ei ole kohteita", en: "No picks match this filter", es: "No hay pronósticos con este filtro" })} description={tr({ fi: "Avaa varmennettu ottelu, valitse kohde ja tallenna se paperiseurantaan.", en: "Open a verified event, choose a selection and save it to paper tracking.", es: "Abre un evento verificado, elige una selección y guárdala." })} actionHref="/events" actionLabel={tr({ fi: "Avaa ottelut", en: "Open events", es: "Abrir eventos" })} /> : (
          <div className="space-y-4">
            {filteredBets.map((bet) => {
              const profit = calculateProfitLoss({ stake: bet.stake, odds: bet.odds, result: bet.result });
              const closingOdds = Number(closingDrafts[bet.id]);
              const hasClosing = Number.isFinite(closingOdds) && closingOdds > 1;
              const clv = hasClosing ? calculateCLV({ odds: bet.odds, closingOdds }) : null;
              const itemBusy = busy === bet.id;
              return <article key={bet.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-xl">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${resultStyle(bet.result)}`}>{resultLabel(bet.result)}</span><span className="text-xs text-slate-500">{bet.createdAt ? new Date(bet.createdAt).toLocaleString(locale) : tr({ fi: "Päivämäärä puuttuu", en: "Date missing", es: "Falta la fecha" })}</span></div><h2 className="mt-3 text-xl font-black tracking-tight text-white md:text-2xl">{bet.match}</h2><div className="mt-2 text-slate-300"><strong>{bet.selection}</strong> @ {bet.odds}</div></div><MetricTile label={t("term.paperStake")} value={money(bet.stake)} tone="purple" /></div>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><MetricTile label={t("term.edge")} value={formatPercent(bet.edge)} tone="green" /><MetricTile label={t("term.ev")} value={formatPercent(bet.ev)} tone="blue" /><label className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{tr({ fi: "Päätöskerroin", en: "Closing odds", es: "Cuota de cierre" })}<input value={closingDrafts[bet.id] ?? ""} onChange={(event) => changeClosingOdds(bet.id, event.target.value)} placeholder="1.95" inputMode="decimal" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-base font-black normal-case tracking-normal text-white" /></label><MetricTile label="CLV" value={clv === null ? "—" : formatPercent(clv)} tone={clv === null ? "default" : clv >= 0 ? "green" : "red"} /><MetricTile label={t("home.paperResult")} value={money(profit)} tone={profit >= 0 ? "green" : "red"} /></div>
                {bet.riskWarnings?.length ? <details className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><summary className="cursor-pointer font-bold text-amber-200">{tr({ fi: "Näytä riskivaroitukset", en: "Show risk warnings", es: "Mostrar avisos de riesgo" })}</summary><ul className="mt-3 space-y-1 text-sm text-slate-300">{bet.riskWarnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></details> : null}
                <MatchStoryCard bet={bet} tr={tr} locale={locale} />
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{bet.result === "pending" ? <><button type="button" disabled={itemBusy} onClick={() => void settleBet(bet.id, "win")} className="sc-button-primary disabled:opacity-50">{tr({ fi: "Merkitse voitoksi", en: "Mark as win", es: "Marcar victoria" })}</button><button type="button" disabled={itemBusy} onClick={() => void settleBet(bet.id, "loss")} className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100 disabled:opacity-50">{tr({ fi: "Merkitse tappioksi", en: "Mark as loss", es: "Marcar derrota" })}</button><button type="button" disabled={itemBusy} onClick={() => void settleBet(bet.id, "push")} className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-black text-amber-100 disabled:opacity-50">{tr({ fi: "Merkitse palautukseksi", en: "Mark as push", es: "Marcar nulo" })}</button></> : <button type="button" disabled={itemBusy} onClick={() => void settleBet(bet.id, "pending")} className="sc-button-secondary disabled:opacity-50">{tr({ fi: "Avaa uudelleen", en: "Reopen", es: "Reabrir" })}</button>}<button type="button" disabled={itemBusy} onClick={() => void removeBet(bet.id)} className="sc-button-ghost disabled:opacity-50">{itemBusy ? tr({ fi: "Odota…", en: "Please wait…", es: "Espera…" }) : t("common.delete")}</button></div>
              </article>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
