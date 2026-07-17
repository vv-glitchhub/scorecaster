"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import AgentExplanation from "./AgentExplanation";
import { addTrackedBet, getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { buildSelfLearningReport } from "../../lib/agent-self-learning.mjs";
import {
  applyModelLabSafety,
  summarizeGovernedDecisions
} from "../../lib/agent-model-governance.mjs";
import { buildAgentV9Portfolio } from "../../lib/agent-v9-engine.mjs";
import { getSettings, saveSettings } from "../../lib/settings-storage";
import { formatPercent } from "../../lib/analysis-engine";

function decisionClass(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "WATCH") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-red-400/30 bg-red-400/10 text-red-300";
}

function freshnessLabel(pick) {
  return pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
}

function optionalPercent(value) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  return Number.isFinite(number) ? formatPercent(number) : "–";
}

function optionalNumber(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function Metric({ label, value, tone = "text-slate-100" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div></div>;
}

export default function AgentClient() {
  const { tr, t, locale } = useLanguage();
  const [rawPicks, setRawPicks] = useState([]);
  const [history, setHistory] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [message, setMessage] = useState("");
  const [bankroll, setBankroll] = useState(1000);
  const [maxStakePercent, setMaxStakePercent] = useState(1);
  const [maxTotalExposurePercent, setMaxTotalExposurePercent] = useState(4);
  const [maxLeagueExposurePercent, setMaxLeagueExposurePercent] = useState(2);
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  useEffect(() => {
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setMaxStakePercent(Number(settings.agentMaxStakePercent || 1));
    setMaxTotalExposurePercent(Number(settings.agentMaxTotalExposurePercent || 4));
    setMaxLeagueExposurePercent(Number(settings.agentMaxLeagueExposurePercent || 2));
    void loadAgentPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAgentPicks() {
    setLoading(true);
    setMessage("");
    try {
      const trackedBets = getTrackedBets();
      const learningData = calculateAgentPerformance(trackedBets);
      const response = await fetch("/api/top-picks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || tr({ fi: "Agentin kohteita ei voitu ladata.", en: "Agent picks could not be loaded.", es: "No se pudieron cargar los pronósticos del Agent." }));
      setHistory(trackedBets);
      setLearning(learningData);
      setRawPicks(Array.isArray(data.data) ? data.data : []);
      setSource(data.fixtureSource || data.source || "live-odds-provider-only");
    } catch (error) {
      setRawPicks([]);
      setSource("error");
      setMessage(error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }

  const basePortfolio = useMemo(() => buildAgentV9Portfolio(rawPicks, {
    learning,
    bankroll,
    maxStakePercent,
    maxTotalExposurePercent,
    maxLeagueExposurePercent
  }), [rawPicks, learning, bankroll, maxStakePercent, maxTotalExposurePercent, maxLeagueExposurePercent]);

  const modelLab = useMemo(() => buildSelfLearningReport(history), [history]);
  const portfolio = useMemo(() => {
    const decisions = applyModelLabSafety(basePortfolio.decisions, modelLab);
    const summary = summarizeGovernedDecisions(decisions);
    return {
      ...basePortfolio,
      agentVersion: "V11-model-lab-shadow",
      decisions,
      counts: summary.counts,
      totalAllocated: summary.totalAllocated,
      exposurePercent: bankroll > 0 ? summary.totalAllocated / bankroll : 0
    };
  }, [basePortfolio, modelLab, bankroll]);

  const decisions = portfolio.decisions;
  const visibleDecisions = useMemo(() => decisions.filter((pick) => filter === "ALL" || pick.decision === filter), [decisions, filter]);

  function saveAgentSettings(next) {
    saveSettings({ ...getSettings(), ...next });
  }

  function updateNumber(setter, key, fallback, minimum, maximum) {
    return (event) => {
      const raw = Number(event.target.value);
      const value = Number.isFinite(raw) ? Math.max(minimum, Math.min(maximum, raw)) : fallback;
      setter(value);
      saveAgentSettings({ [key]: value });
    };
  }

  function addPickToTracking(pick) {
    if (pick.decision !== "PLAY" || pick.suggestedStake <= 0) return;

    addTrackedBet({
      eventId: pick.gameId || pick.eventId || pick.id,
      match: pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      selection: pick.selection,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      edge: pick.edge,
      ev: pick.ev,
      confidence: pick.confidence,
      modelProbability: pick.consensusProbability || pick.modelProbability,
      marketProbability: pick.marketProbability,
      fairOdds: pick.fairOdds,
      stake: pick.suggestedStake,
      bankroll,
      kellyMode: "agent-v11-shadow-governed-quarter-kelly",
      source: "scorecaster-agent-v11-model-lab",
      sportKey: pick.sportKey,
      marketKey: pick.marketKey || pick.market,
      league: pick.league,
      leagueTitle: pick.leagueTitle,
      decision: pick.decision,
      decisionReason: pick.decisionReason,
      trustScore: pick.trustScore,
      robustnessScore: pick.robustnessScore,
      learningSampleSize: modelLab.sampleSize || 0,
      learningStatus: modelLab.status,
      learningDriftStatus: modelLab.drift?.status,
      challengerId: modelLab.challenger?.id || null,
      probabilityAdjustedByLearning: false,
      uncertaintyLower: pick.stressTest?.lower,
      uncertaintyUpper: pick.stressTest?.upper,
      downsideEv: pick.stressTest?.downsideEv,
      minimumPlayOdds: pick.priceGuard?.minimumPlayOdds,
      evidence: pick.evidence,
      counterArguments: pick.counterArguments,
      missingEvidence: pick.missingEvidence,
      portfolioReason: pick.portfolioReason,
      riskWarnings: [
        "Agent V11 uses virtual paper tracking only.",
        "The challenger remains in shadow mode and does not alter the production probability.",
        "Critical drift freezes new PLAY exposure.",
        "No result or profit is guaranteed."
      ],
      paperOnly: true
    });

    const trackedBets = getTrackedBets();
    setHistory(trackedBets);
    setLearning(calculateAgentPerformance(trackedBets));
    setMessage(tr({ fi: `${pick.selection} lisättiin Agent V11 -paperiseurantaan.`, en: `${pick.selection} was added to Agent V11 paper tracking.`, es: `${pick.selection} se añadió al seguimiento simulado de Agent V11.` }));
  }

  const learningTone = Number(learning?.roi || 0) > 0 ? "text-emerald-300" : Number(learning?.roi || 0) < 0 ? "text-red-300" : "text-slate-100";
  const driftTone = modelLab.drift?.status === "critical" ? "text-red-300" : modelLab.drift?.status === "warning" ? "text-yellow-300" : "text-emerald-300";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">Agent V11 · Model Lab</div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{tr({ fi: "Scorecaster-päätöskopilotti", en: "Scorecaster Decision Copilot", es: "Copiloto de decisiones Scorecaster" })}</h1>
        <p className="mt-3 max-w-4xl text-slate-300">{tr({
          fi: "Deterministinen ydin tekee päätöksen. Oppimislaboratorio kouluttaa haastajaa kronologisella datalla, arvioi sen koskemattomalla holdout-jaksolla ja jäädyttää uuden paperialtistuksen kriittisessä driftissä.",
          en: "The deterministic core makes the decision. The learning lab trains a challenger on chronological data, evaluates it on an untouched holdout and freezes new paper exposure under critical drift.",
          es: "El núcleo determinista toma la decisión. El laboratorio entrena un challenger con datos cronológicos, lo evalúa en un holdout intacto y congela nueva exposición simulada ante drift crítico."
        })}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="PLAY" value={portfolio.counts.PLAY} tone="text-emerald-300" />
          <Metric label="WATCH" value={portfolio.counts.WATCH} tone="text-yellow-300" />
          <Metric label="SKIP" value={portfolio.counts.SKIP} tone="text-red-300" />
          <Metric label={tr({ fi: "Suunniteltu altistus", en: "Planned exposure", es: "Exposición prevista" })} value={money(portfolio.totalAllocated)} tone="text-sky-300" />
          <Metric label={tr({ fi: "Altistus kassasta", en: "Bankroll exposure", es: "Exposición de la banca" })} value={formatPercent(portfolio.exposurePercent)} tone="text-purple-300" />
        </div>

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer font-black text-slate-200">{tr({ fi: "AI-portfolion paperirajat", en: "AI portfolio paper limits", es: "Límites simulados de la cartera IA" })}</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{t("term.bankroll")}<input type="number" min="0" value={bankroll} onChange={updateNumber(setBankroll, "bankroll", 1000, 0, 10000000)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
            <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{tr({ fi: "Yksittäinen panos %", en: "Single stake %", es: "Importe individual %" })}<input type="number" min="0.1" max="5" step="0.1" value={maxStakePercent} onChange={updateNumber(setMaxStakePercent, "agentMaxStakePercent", 1, 0.1, 5)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
            <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{tr({ fi: "Kokonaisaltistus %", en: "Total exposure %", es: "Exposición total %" })}<input type="number" min="0.5" max="20" step="0.5" value={maxTotalExposurePercent} onChange={updateNumber(setMaxTotalExposurePercent, "agentMaxTotalExposurePercent", 4, 0.5, 20)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
            <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{tr({ fi: "Liiga-altistus %", en: "League exposure %", es: "Exposición por liga %" })}<input type="number" min="0.25" max="10" step="0.25" value={maxLeagueExposurePercent} onChange={updateNumber(setMaxLeagueExposurePercent, "agentMaxLeagueExposurePercent", 2, 0.25, 10)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
            <button onClick={() => void loadAgentPicks()} disabled={loading} className="rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Analysoidaan…", en: "Analyzing…", es: "Analizando…" }) : tr({ fi: "Päivitä Agent V11", en: "Refresh Agent V11", es: "Actualizar Agent V11" })}</button>
          </div>
        </details>

        <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
          <div>{tr({ fi: "Lähde", en: "Source", es: "Fuente" })} <span className="font-bold text-emerald-300">{source}</span></div>
          <div>{tr({ fi: "Oppimisotos", en: "Learning sample", es: "Muestra de aprendizaje" })} <span className="font-bold text-sky-300">{modelLab.sampleSize || 0}/{modelLab.minimumSamples || 120}</span></div>
          <div>{tr({ fi: "Historian ROI", en: "Historical ROI", es: "ROI histórico" })} <span className={`font-bold ${learningTone}`}>{optionalPercent(learning?.roi)}</span></div>
          <div>CLV / Brier <span className="font-bold text-purple-300">{optionalPercent(learning?.averageClv)} / {optionalNumber(learning?.brierScore)}</span></div>
        </div>
        <div className="mt-2 text-xs text-slate-500">{tr({ fi: "Haastajamalli pysyy varjotilassa. Se ei muuta tuotannon todennäköisyyttä ilman erillistä hyväksyntää.", en: "The challenger remains in shadow mode. It does not alter the production probability without separate approval.", es: "El challenger permanece en modo sombra. No modifica la probabilidad de producción sin aprobación separada." })}</div>
      </section>

      <Panel title="Agent V11 Model Lab" subtitle={tr({ fi: "Kronologinen champion–challenger ja driftin tunnistus", en: "Chronological champion–challenger and drift detection", es: "Champion–challenger cronológico y detección de drift" })}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={modelLab.status} tone={modelLab.promotion?.eligible ? "text-emerald-300" : "text-yellow-300"} />
          <Metric label="Champion" value={modelLab.champion?.id || "identity"} />
          <Metric label="Challenger" value={modelLab.challenger?.id || "–"} />
          <Metric label="Drift" value={modelLab.drift?.status || "unknown"} tone={driftTone} />
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">{tr({ fi: "Koulutus / holdout", en: "Train / holdout", es: "Entrenamiento / holdout" })}: <b>{modelLab.trainSize || 0} / {modelLab.holdoutSize || 0}</b><br />Champion Brier: {optionalNumber(modelLab.champion?.holdout?.brierScore)}<br />Challenger Brier: {optionalNumber(modelLab.challenger?.holdout?.brierScore)}<br />Δ Brier: {optionalNumber(modelLab.challenger?.holdoutImprovement?.brier)}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className={`font-bold ${driftTone}`}>{modelLab.drift?.note}</div><div className="mt-2 text-slate-400">{(modelLab.promotion?.reasons || []).slice(0, 3).map((reason) => <div key={reason}>• {reason}</div>)}</div></div>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">{["ALL", "PLAY", "WATCH", "SKIP"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filter === item ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>{item === "ALL" ? tr({ fi: "KAIKKI", en: "ALL", es: "TODOS" }) : item}</button>)}</div>
      {message && <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">{message}</div>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-4">
          {!loading && visibleDecisions.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-400">{tr({ fi: "Tällä suodattimella ei ole agenttipäätöksiä.", en: "No Agent decisions match this filter.", es: "No hay decisiones del Agent con este filtro." })}</div>}
          {visibleDecisions.map((pick, index) => {
            const id = String(pick.id || pick.gameId || `${pick.match}-${pick.selection}-${index}`);
            const expanded = expandedId === id;
            const stress = pick.stressTest || {};
            const priceGuard = pick.priceGuard || {};
            return (
              <article key={id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="text-sm text-slate-400">#{index + 1} · {pick.leagueTitle || pick.league || pick.sportKey || "Sport"}</div><h2 className="mt-1 text-xl font-black">{pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`}</h2><p className="mt-1 text-slate-300">{pick.selection} @ {Number(pick.odds || 0).toFixed(2)} · {pick.bookmaker || tr({ fi: "paras hinta", en: "best price", es: "mejor cuota" })}</p></div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${decisionClass(pick.decision)}`}>{pick.decision}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <Metric label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={formatPercent(stress.probability)} />
                  <Metric label={tr({ fi: "Stressialue", en: "Stress range", es: "Rango de estrés" })} value={`${formatPercent(stress.lower)}–${formatPercent(stress.upper)}`} />
                  <Metric label={tr({ fi: "Perus-EV", en: "Base EV", es: "EV base" })} value={formatPercent(stress.baseEv)} tone="text-sky-300" />
                  <Metric label={tr({ fi: "Alarajan EV", en: "Downside EV", es: "EV a la baja" })} value={formatPercent(stress.downsideEv)} tone={Number(stress.downsideEv) > 0 ? "text-emerald-300" : "text-red-300"} />
                  <Metric label={tr({ fi: "Kestävyys", en: "Robustness", es: "Robustez" })} value={formatPercent(pick.robustnessScore)} />
                  <Metric label={t("term.paperStake")} value={money(pick.suggestedStake)} tone="text-purple-300" />
                </div>
                <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-slate-200">{pick.decisionReason}</div>
                {pick.portfolioReason && <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-200">{tr({ fi: "Portfolio", en: "Portfolio", es: "Cartera" })}: {pick.portfolioReason}</div>}
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2"><div>{tr({ fi: "Data", en: "Data", es: "Datos" })} {freshnessLabel(pick)} · {pick.bookmakerCount || 0} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })}</div><div>{tr({ fi: "Nykyinen kerroin", en: "Current odds", es: "Cuota actual" })} {Number(priceGuard.currentOdds || 0).toFixed(2)} · PLAY {Number(priceGuard.minimumPlayOdds || 0).toFixed(2)}</div></div>
                <div className="mt-2 text-xs text-slate-500">Agent V11 · {pick.selfLearning?.status || modelLab.status} · drift {pick.selfLearning?.driftStatus || modelLab.drift?.status} · {tr({ fi: "todennäköisyys muuttumaton", en: "probability unchanged", es: "probabilidad sin cambios" })}</div>
                <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setExpandedId(expanded ? null : id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">{expanded ? tr({ fi: "Piilota AI-auditointi", en: "Hide AI audit", es: "Ocultar auditoría IA" }) : tr({ fi: "Näytä AI-auditointi", en: "Show AI audit", es: "Mostrar auditoría IA" })}</button><button onClick={() => addPickToTracking(pick)} disabled={pick.decision !== "PLAY" || pick.suggestedStake <= 0} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">{tr({ fi: "Lisää paperiseurantaan", en: "Add to paper tracking", es: "Añadir al seguimiento simulado" })}</button></div>
                {expanded && <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4"><div className="font-bold text-emerald-300">{tr({ fi: "Todennettu evidenssi", en: "Verified evidence", es: "Evidencia verificada" })}</div><ul className="mt-2 space-y-1 text-sm text-slate-300">{(pick.evidence || []).map((item) => <li key={item}>• {item}</li>)}</ul></div>
                  <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4"><div className="font-bold text-red-300">{tr({ fi: "AI:n vastaväite", en: "AI counterargument", es: "Contraargumento de la IA" })}</div><ul className="mt-2 space-y-1 text-sm text-slate-300">{(pick.counterArguments || []).map((item) => <li key={item}>• {item}</li>)}</ul></div>
                  <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4"><div className="font-bold text-yellow-300">{tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia faltante" })}</div>{(pick.missingEvidence || []).length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.missingEvidence.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-300">{tr({ fi: "Ei tunnistettuja puutteita.", en: "No identified gaps.", es: "No se detectaron carencias." })}</p>}</div>
                  <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4"><div className="font-bold text-sky-300">{tr({ fi: "Hinta- ja päätösrajat", en: "Price and decision limits", es: "Límites de cuota y decisión" })}</div><div className="mt-2 space-y-1 text-sm text-slate-300"><p>Break-even {Number(priceGuard.breakEvenOdds || 0).toFixed(2)}</p><p>{tr({ fi: "PLAY-minimikerroin", en: "Minimum PLAY odds", es: "Cuota mínima PLAY" })} {Number(priceGuard.minimumPlayOdds || 0).toFixed(2)}</p><p>{tr({ fi: "Konservatiivinen break-even", en: "Conservative break-even", es: "Break-even conservador" })} {Number(priceGuard.conservativeBreakEvenOdds || 0).toFixed(2)}</p><p>{tr({ fi: "Hintapuskuri", en: "Price buffer", es: "Margen de cuota" })} {Number(priceGuard.buffer || 0).toFixed(2)}</p></div></div>
                  <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 lg:col-span-2"><div className="font-bold text-purple-300">{tr({ fi: "Oppimissignaali", en: "Learning signal", es: "Señal de aprendizaje" })}</div><p className="mt-2 text-sm text-slate-300">{pick.learningSignal?.note}</p><p className="mt-2 text-xs text-slate-400">{tr({ fi: "Otos", en: "Sample", es: "Muestra" })} {pick.learningSignal?.sampleSize || 0} · ROI {optionalPercent(pick.learningSignal?.metrics?.roi)} · CLV {optionalPercent(pick.learningSignal?.metrics?.averageClv)} · Brier {optionalNumber(pick.learningSignal?.metrics?.brierScore)}. {tr({ fi: "Todennäköisyyttä ei muutettu.", en: "Probability was not changed.", es: "La probabilidad no se modificó." })}</p></div>
                  <div className="lg:col-span-2"><AgentExplanation pick={pick} /></div>
                </div>}
              </article>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel title={tr({ fi: "Agent V11 -päätösketju", en: "Agent V11 decision chain", es: "Cadena de decisión Agent V11" })} subtitle={tr({ fi: "Laskenta, holdout ja drift ennen kielikerrosta", en: "Calculation, holdout and drift before language", es: "Cálculo, holdout y drift antes del lenguaje" })}>
            <div className="space-y-3 text-sm text-slate-300"><p>1. {tr({ fi: "Ydin lukee live-markkinan no-vig-konsensuksen.", en: "The core reads the live no-vig market consensus.", es: "El núcleo lee el consenso vivo sin margen." })}</p><p>2. {tr({ fi: "Agentti stressaa hinnan, todennäköisyyden ja portfolioaltistuksen.", en: "The Agent stress-tests price, probability and portfolio exposure.", es: "El Agent somete a estrés cuota, probabilidad y exposición." })}</p><p>3. {tr({ fi: "Model Lab kouluttaa haastajan vain vanhemmalla jaksolla ja testaa uudemmalla holdoutilla.", en: "Model Lab trains the challenger only on the older period and tests it on the newer holdout.", es: "Model Lab entrena el challenger solo con el periodo antiguo y lo prueba en el holdout reciente." })}</p><p>4. {tr({ fi: "Kriittinen drift muuttaa uudet PLAY-päätökset WATCHiksi.", en: "Critical drift converts new PLAY decisions to WATCH.", es: "El drift crítico convierte nuevas decisiones PLAY en WATCH." })}</p><p>5. {tr({ fi: "Kielimalli saa vain selittää lukittua päätöstä.", en: "The language model may only explain the locked decision.", es: "El modelo de lenguaje solo puede explicar la decisión bloqueada." })}</p></div>
          </Panel>
          <Panel title={tr({ fi: "V11-tietosuoja", en: "V11 privacy", es: "Privacidad V11" })} subtitle={tr({ fi: "Minimoitu AI-syöte", en: "Minimized AI input", es: "Entrada IA minimizada" })}><div className="space-y-2 text-sm text-slate-300"><p>• {tr({ fi: "Ei sähköpostia, nimeä, käyttäjätunnusta tai maksutietoja.", en: "No email, name, user ID or payment data.", es: "Sin correo, nombre, identificador de usuario ni datos de pago." })}</p><p>• {tr({ fi: "Oppimiseen käytetään vain ratkaistun paperihistorian minimoituja mittareita.", en: "Learning uses only minimized metrics from settled paper history.", es: "El aprendizaje usa solo métricas minimizadas del historial simulado resuelto." })}</p><p>• store false</p></div></Panel>
          <Panel title={tr({ fi: "Portfolioportit", en: "Portfolio gates", es: "Filtros de cartera" })} subtitle={t("common.paperOnly")}><div className="space-y-2 text-sm text-slate-300"><p>{tr({ fi: "Kokonaiskatto", en: "Total cap", es: "Límite total" })}: <span className="font-bold text-sky-300">{money(portfolio.totalCap)}</span></p><p>{tr({ fi: "Liigakohtainen katto", en: "League cap", es: "Límite por liga" })}: <span className="font-bold text-purple-300">{money(portfolio.leagueCap)}</span></p><p>{tr({ fi: "Yksi PLAY-valinta per tapahtuma.", en: "One PLAY selection per event.", es: "Una selección PLAY por evento." })}</p></div></Panel>
          <Panel title={tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite del producto" })} subtitle="Paper only"><div className="space-y-2 text-sm text-slate-300"><p>• {tr({ fi: "Ei oikean rahan toimintoja.", en: "No real-money actions.", es: "Sin acciones con dinero real." })}</p><p>• {tr({ fi: "Ei keksittyjä uutisia, kokoonpanoja tai loukkaantumisia.", en: "No invented news, lineups or injuries.", es: "Sin noticias, alineaciones ni lesiones inventadas." })}</p><p>• {tr({ fi: "Ei tuottolupausta.", en: "No profit promise.", es: "Sin promesa de beneficios." })}</p></div></Panel>
        </div>
      </section>
    </div>
  );
}
