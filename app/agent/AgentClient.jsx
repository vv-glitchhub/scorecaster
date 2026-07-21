"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";
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

function freshnessLabel(pick) {
  return pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
}

function optionalNumber(value, digits = 3) {
  if (value === null || value === undefined || value === "") return "–";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function toneForDrift(status) {
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  return "default";
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
  const money = (value) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));

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
      if (!response.ok) {
        throw new Error(data?.error || tr({
          fi: "Agentin kohteita ei voitu ladata.",
          en: "Agent picks could not be loaded.",
          es: "No se pudieron cargar los pronósticos del Agent."
        }));
      }
      setHistory(trackedBets);
      setLearning(learningData);
      setRawPicks(Array.isArray(data.data) ? data.data : []);
      setSource(data.fixtureSource || data.source || "live-odds-provider-only");
    } catch (error) {
      setRawPicks([]);
      setSource("error");
      setMessage(error instanceof Error ? error.message : tr({
        fi: "Tuntematon virhe",
        en: "Unknown error",
        es: "Error desconocido"
      }));
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

  const visibleDecisions = useMemo(
    () => portfolio.decisions.filter((pick) => filter === "ALL" || pick.decision === filter),
    [portfolio.decisions, filter]
  );

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
    setMessage(tr({
      fi: `${pick.selection} lisättiin Agent V11 -paperiseurantaan.`,
      en: `${pick.selection} was added to Agent V11 paper tracking.`,
      es: `${pick.selection} se añadió al seguimiento simulado de Agent V11.`
    }));
  }

  const heroAside = (
    <div className="grid grid-cols-2 gap-2">
      <MetricTile compact label="PLAY" value={portfolio.counts.PLAY} tone="green" />
      <MetricTile compact label="WATCH" value={portfolio.counts.WATCH} tone="yellow" />
      <MetricTile compact label="SKIP" value={portfolio.counts.SKIP} tone="red" />
      <MetricTile compact label={tr({ fi: "Altistus", en: "Exposure", es: "Exposición" })} value={formatPercent(portfolio.exposurePercent)} tone="purple" />
    </div>
  );

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Agent V11 · Model Lab"
        title={tr({
          fi: "Päätös ensin, auditointi tarvittaessa",
          en: "Decision first, audit when needed",
          es: "Primero la decisión, auditoría cuando haga falta"
        })}
        description={tr({
          fi: "Agentti järjestää palvelimella varmennetut kohteet PLAY-, WATCH- ja SKIP-päätöksiksi. Stressitesti, portfolioportit ja oppimislaboratorio pysyvät mukana, mutta eivät peitä tärkeintä toimintoa.",
          en: "The Agent ranks server-verified picks into PLAY, WATCH and SKIP decisions. Stress tests, portfolio gates and the learning lab remain available without hiding the main action.",
          es: "El Agent ordena los pronósticos verificados en decisiones PLAY, WATCH y SKIP. Las pruebas de estrés, los límites de cartera y el laboratorio siguen disponibles sin ocultar la acción principal."
        })}
        actions={
          <>
            <button onClick={() => void loadAgentPicks()} disabled={loading} className="sc-button-primary">
              {loading ? tr({ fi: "Analysoidaan…", en: "Analyzing…", es: "Analizando…" }) : tr({ fi: "Päivitä päätökset", en: "Refresh decisions", es: "Actualizar decisiones" })}
            </button>
            <Link href="/tracking" className="sc-button-secondary">{tr({ fi: "Avaa paperisalkku", en: "Open paper portfolio", es: "Abrir cartera simulada" })}</Link>
            <Link href="/autonomous-agent" className="sc-button-ghost">{tr({ fi: "Autonominen tila", en: "Autonomous mode", es: "Modo autónomo" })}</Link>
          </>
        }
        aside={heroAside}
      />

      <TrustBar items={[
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source, tone: source === "error" ? "danger" : "default" },
        { label: "Model Lab", value: modelLab.status, tone: toneForDrift(modelLab.drift?.status) },
        { label: tr({ fi: "Oppimisotos", en: "Learning sample", es: "Muestra" }), value: `${modelLab.sampleSize || 0}/${modelLab.minimumSamples || 120}`, tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulado" }), tone: "warning" }
      ]} />

      {message && <div className="rounded-2xl border border-sky-300/25 bg-sky-300/10 p-4 text-sm text-sky-100">{message}</div>}

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Päätökset", en: "Decisions", es: "Decisiones" })}
          title={tr({ fi: "Agentin tämänhetkinen lista", en: "Current Agent list", es: "Lista actual del Agent" })}
          description={tr({
            fi: "Suodata päätöksen mukaan. Kortti näyttää ensin hinnan, stressatun EV:n, kestävyyden ja virtuaalipanoksen.",
            en: "Filter by decision. Each card shows price, stressed EV, robustness and virtual stake first.",
            es: "Filtra por decisión. Cada tarjeta muestra primero cuota, EV estresado, robustez y cantidad virtual."
          })}
          action={<div className="flex flex-wrap gap-2">{["ALL", "PLAY", "WATCH", "SKIP"].map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-black ${filter === item ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100" : "border-white/10 bg-white/[0.035] text-slate-400"}`}>{item === "ALL" ? tr({ fi: "KAIKKI", en: "ALL", es: "TODOS" }) : item}</button>)}</div>}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {!loading && visibleDecisions.length === 0 && <EmptyState title={tr({ fi: "Tällä suodattimella ei ole päätöksiä", en: "No decisions match this filter", es: "No hay decisiones con este filtro" })} description={tr({ fi: "Päivitä analyysi tai valitse toinen päätösluokka.", en: "Refresh the analysis or choose another decision class.", es: "Actualiza el análisis o elige otra clase de decisión." })} actionHref="/betting" actionLabel={tr({ fi: "Avaa kohteet", en: "Open picks", es: "Abrir pronósticos" })} />}

            {visibleDecisions.map((pick, index) => {
              const id = String(pick.id || pick.gameId || `${pick.match}-${pick.selection}-${index}`);
              const expanded = expandedId === id;
              const stress = pick.stressTest || {};
              const priceGuard = pick.priceGuard || {};
              return (
                <article key={id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">#{index + 1} · {pick.leagueTitle || pick.league || pick.sportKey || "Sport"}</div>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-white md:text-2xl">{pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`}</h2>
                      <p className="mt-2 text-slate-300"><strong>{pick.selection}</strong> @ {Number(pick.odds || 0).toFixed(2)}<span className="text-slate-500"> · {pick.bookmaker || tr({ fi: "paras hinta", en: "best price", es: "mejor cuota" })}</span></p>
                    </div>
                    <DecisionBadge decision={pick.decision} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <MetricTile label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={formatPercent(stress.probability)} />
                    <MetricTile label={tr({ fi: "Alarajan EV", en: "Downside EV", es: "EV a la baja" })} value={formatPercent(stress.downsideEv)} tone={Number(stress.downsideEv) > 0 ? "green" : "red"} />
                    <MetricTile label={tr({ fi: "Kestävyys", en: "Robustness", es: "Robustez" })} value={formatPercent(pick.robustnessScore)} tone="blue" />
                    <MetricTile label={t("term.paperStake")} value={money(pick.suggestedStake)} tone="purple" />
                  </div>

                  <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-300/10 p-4 text-sm leading-6 text-slate-200">{pick.decisionReason}</div>
                  <TrustBar className="mt-4" items={[
                    { label: tr({ fi: "Data", en: "Data", es: "Datos" }), value: freshnessLabel(pick) },
                    { label: tr({ fi: "Lähteet", en: "Sources", es: "Fuentes" }), value: pick.bookmakerCount || 0, tone: "info" },
                    { label: tr({ fi: "PLAY-raja", en: "PLAY floor", es: "Límite PLAY" }), value: Number(priceGuard.minimumPlayOdds || 0).toFixed(2), tone: "warning" },
                    { label: "Drift", value: pick.selfLearning?.driftStatus || modelLab.drift?.status || "unknown", tone: toneForDrift(pick.selfLearning?.driftStatus || modelLab.drift?.status) }
                  ]} />

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : id)} className="sc-button-secondary">{expanded ? tr({ fi: "Piilota auditointi", en: "Hide audit", es: "Ocultar auditoría" }) : tr({ fi: "Näytä auditointi", en: "Show audit", es: "Mostrar auditoría" })}</button>
                    <button type="button" onClick={() => addPickToTracking(pick)} disabled={pick.decision !== "PLAY" || pick.suggestedStake <= 0} className="sc-button-primary disabled:cursor-not-allowed disabled:opacity-40">{tr({ fi: "Lisää paperisalkkuun", en: "Add to paper portfolio", es: "Añadir a cartera simulada" })}</button>
                  </div>

                  {expanded && <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <AuditBox tone="green" title={tr({ fi: "Todennettu evidenssi", en: "Verified evidence", es: "Evidencia verificada" })} items={pick.evidence} empty={tr({ fi: "Ei erillistä evidenssilistaa.", en: "No separate evidence list.", es: "Sin lista separada de evidencia." })} />
                    <AuditBox tone="red" title={tr({ fi: "AI:n vastaväite", en: "AI counterargument", es: "Contraargumento de la IA" })} items={pick.counterArguments} empty={tr({ fi: "Ei erillistä vastaväitettä.", en: "No separate counterargument.", es: "Sin contraargumento separado." })} />
                    <AuditBox tone="yellow" title={tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia faltante" })} items={pick.missingEvidence} empty={tr({ fi: "Ei tunnistettuja puutteita.", en: "No identified gaps.", es: "No se detectaron carencias." })} />
                    <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4"><div className="font-black text-sky-200">{tr({ fi: "Hinta- ja stressirajat", en: "Price and stress limits", es: "Límites de cuota y estrés" })}</div><div className="mt-3 space-y-2 text-sm text-slate-300"><p>{tr({ fi: "Stressialue", en: "Stress range", es: "Rango de estrés" })}: {formatPercent(stress.lower)}–{formatPercent(stress.upper)}</p><p>{tr({ fi: "Perus-EV", en: "Base EV", es: "EV base" })}: {formatPercent(stress.baseEv)}</p><p>Break-even: {Number(priceGuard.breakEvenOdds || 0).toFixed(2)}</p><p>{tr({ fi: "Nykyinen kerroin", en: "Current odds", es: "Cuota actual" })}: {Number(priceGuard.currentOdds || 0).toFixed(2)}</p></div></div>
                    {pick.portfolioReason && <div className="rounded-2xl border border-purple-300/20 bg-purple-300/10 p-4 text-sm text-purple-100 lg:col-span-2"><strong>{tr({ fi: "Portfolioperuste", en: "Portfolio reason", es: "Motivo de cartera" })}:</strong> {pick.portfolioReason}</div>}
                    <div className="lg:col-span-2"><AgentExplanation pick={pick} /></div>
                  </div>}
                </article>
              );
            })}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
            <Panel title={tr({ fi: "Portfolio nyt", en: "Portfolio now", es: "Cartera actual" })} subtitle={tr({ fi: "Virtuaaliset rajat ja altistus", en: "Virtual limits and exposure", es: "Límites y exposición virtuales" })}>
              <div className="grid grid-cols-2 gap-3">
                <MetricTile label={tr({ fi: "Suunniteltu", en: "Planned", es: "Previsto" })} value={money(portfolio.totalAllocated)} tone="blue" />
                <MetricTile label={tr({ fi: "Kassa", en: "Bankroll", es: "Banca" })} value={money(bankroll)} />
                <MetricTile label={tr({ fi: "Kokonaiskatto", en: "Total cap", es: "Límite total" })} value={money(portfolio.totalCap)} tone="purple" />
                <MetricTile label={tr({ fi: "Liigakatto", en: "League cap", es: "Límite liga" })} value={money(portfolio.leagueCap)} tone="yellow" />
              </div>
            </Panel>

            <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <summary className="cursor-pointer font-black text-white">{tr({ fi: "Muokkaa paperirajoja", en: "Edit paper limits", es: "Editar límites simulados" })}</summary>
              <p className="mt-2 text-sm leading-6 text-slate-400">{tr({ fi: "Näitä ei tarvitse muuttaa tavallisessa käytössä. Asetukset vaikuttavat vain virtuaaliseen paperiseurantaan.", en: "These do not need changing in normal use. Settings affect virtual paper tracking only.", es: "No hace falta cambiarlos en el uso normal. Solo afectan al seguimiento simulado." })}</p>
              <div className="mt-4 space-y-3">
                <NumberField label={t("term.bankroll")} value={bankroll} min={0} max={10000000} step={10} onChange={updateNumber(setBankroll, "bankroll", 1000, 0, 10000000)} />
                <NumberField label={tr({ fi: "Yksittäinen panos %", en: "Single stake %", es: "Importe individual %" })} value={maxStakePercent} min={0.1} max={5} step={0.1} onChange={updateNumber(setMaxStakePercent, "agentMaxStakePercent", 1, 0.1, 5)} />
                <NumberField label={tr({ fi: "Kokonaisaltistus %", en: "Total exposure %", es: "Exposición total %" })} value={maxTotalExposurePercent} min={0.5} max={20} step={0.5} onChange={updateNumber(setMaxTotalExposurePercent, "agentMaxTotalExposurePercent", 4, 0.5, 20)} />
                <NumberField label={tr({ fi: "Liiga-altistus %", en: "League exposure %", es: "Exposición por liga %" })} value={maxLeagueExposurePercent} min={0.25} max={10} step={0.25} onChange={updateNumber(setMaxLeagueExposurePercent, "agentMaxLeagueExposurePercent", 2, 0.25, 10)} />
              </div>
            </details>

            <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <summary className="cursor-pointer font-black text-white">Agent V11 Model Lab</summary>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MetricTile label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={modelLab.status} tone={modelLab.promotion?.eligible ? "green" : "yellow"} />
                <MetricTile label="Drift" value={modelLab.drift?.status || "unknown"} tone={modelLab.drift?.status === "critical" ? "red" : "yellow"} />
                <MetricTile label="Champion" value={modelLab.champion?.id || "identity"} />
                <MetricTile label="Challenger" value={modelLab.challenger?.id || "–"} tone="blue" />
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300"><p>{tr({ fi: "Koulutus / holdout", en: "Train / holdout", es: "Entrenamiento / holdout" })}: <strong>{modelLab.trainSize || 0} / {modelLab.holdoutSize || 0}</strong></p><p>Champion Brier: {optionalNumber(modelLab.champion?.holdout?.brierScore)}</p><p>Challenger Brier: {optionalNumber(modelLab.challenger?.holdout?.brierScore)}</p><p>Δ Brier: {optionalNumber(modelLab.challenger?.holdoutImprovement?.brier)}</p><p className="mt-2 text-slate-500">{modelLab.drift?.note}</p></div>
              <div className="mt-3 text-xs leading-5 text-slate-500">{tr({ fi: "Haastajamalli pysyy varjotilassa eikä muuta tuotannon todennäköisyyttä ilman erillistä hyväksyntää.", en: "The challenger stays in shadow mode and never changes the production probability without separate approval.", es: "El challenger permanece en modo sombra y no cambia la probabilidad de producción sin aprobación separada." })}</div>
            </details>

            <Panel title={tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite del producto" })} subtitle="Paper only"><div className="space-y-2 text-sm leading-6 text-slate-300"><p>• {tr({ fi: "Ei oikean rahan toimintoja.", en: "No real-money actions.", es: "Sin acciones con dinero real." })}</p><p>• {tr({ fi: "Ei keksittyjä uutisia, kokoonpanoja tai loukkaantumisia.", en: "No invented news, lineups or injuries.", es: "Sin noticias, alineaciones ni lesiones inventadas." })}</p><p>• {tr({ fi: "Ei tuottolupausta.", en: "No profit promise.", es: "Sin promesa de beneficios." })}</p></div></Panel>
          </aside>
        </div>
      </section>
    </div>
  );
}

function NumberField({ label, value, min, max, step, onChange }) {
  return <label className="block rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={onChange} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white" /></label>;
}

function AuditBox({ title, items = [], empty, tone }) {
  const toneClass = tone === "green" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : tone === "red" ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : "border-amber-300/20 bg-amber-300/10 text-amber-200";
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="font-black">{title}</div>{items?.length ? <ul className="mt-3 space-y-1 text-sm text-slate-300">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-400">{empty}</p>}</div>;
}
