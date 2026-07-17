"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import AgentExplanation from "./AgentExplanation";
import { getSettings, saveSettings } from "../../lib/settings-storage";
import { formatPercent } from "../../lib/analysis-engine";

function decisionClass(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (decision === "WATCH") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function optionalPercent(value) {
  return Number.isFinite(Number(value)) ? formatPercent(Number(value)) : "–";
}

function optionalNumber(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
}

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div></div>;
}

function contextTone(status) {
  if (status === "verified") return "text-emerald-300";
  if (status === "partial") return "text-yellow-300";
  return "text-slate-400";
}

export default function AgentServerClient() {
  const { tr, t, locale } = useLanguage();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [bankroll, setBankroll] = useState(1000);
  const [maxStakePercent, setMaxStakePercent] = useState(1);
  const [maxTotalExposurePercent, setMaxTotalExposurePercent] = useState(4);
  const [maxLeagueExposurePercent, setMaxLeagueExposurePercent] = useState(2);
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  useEffect(() => {
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setMaxStakePercent(Number(settings.agentMaxStakePercent || 1));
    setMaxTotalExposurePercent(Number(settings.agentMaxTotalExposurePercent || 4));
    setMaxLeagueExposurePercent(Number(settings.agentMaxLeagueExposurePercent || 2));
  }, []);

  async function load(overrides = {}) {
    setLoading(true);
    setError("");
    setMessage("");
    const settings = {
      bankroll: overrides.bankroll ?? bankroll,
      maxStakePercent: overrides.maxStakePercent ?? maxStakePercent,
      maxTotalExposurePercent: overrides.maxTotalExposurePercent ?? maxTotalExposurePercent,
      maxLeagueExposurePercent: overrides.maxLeagueExposurePercent ?? maxLeagueExposurePercent
    };

    try {
      const response = await fetch("/api/agent/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || tr({ fi: "AI-portfoliota ei voitu ladata.", en: "AI portfolio could not be loaded.", es: "No se pudo cargar la cartera IA." }));
      setPortfolio(payload);
    } catch (loadError) {
      setPortfolio(null);
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // Initial settings are loaded from local storage before the request settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSetting(setter, key, fallback, minimum, maximum) {
    return (event) => {
      const raw = Number(event.target.value);
      const value = Number.isFinite(raw) ? Math.max(minimum, Math.min(maximum, raw)) : fallback;
      setter(value);
      saveSettings({ ...getSettings(), [key]: value });
    };
  }

  async function savePaper(decision, index) {
    if (decision.decision !== "PLAY" || Number(decision.suggestedStake || 0) <= 0) return;
    const id = String(decision.gameId || decision.eventId || decision.id || `${decision.match}-${decision.selection}-${index}`);
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch("/api/cloud/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bets: [{
            id,
            eventId: decision.gameId || decision.eventId || decision.id,
            match: decision.match || [decision.homeTeam, decision.awayTeam].filter(Boolean).join(" – "),
            homeTeam: decision.homeTeam,
            awayTeam: decision.awayTeam,
            selection: decision.selection || decision.label,
            odds: decision.odds,
            stake: decision.suggestedStake,
            edge: decision.edge,
            ev: decision.ev,
            confidence: decision.confidence,
            league: decision.league || decision.leagueTitle,
            sport: decision.sportKey,
            bookmaker: decision.bookmaker,
            decision: decision.decision,
            qualityScore: decision.trustScore,
            modelProbability: decision.stressTest?.probability || decision.consensusProbability,
            impliedProbability: decision.marketProbability,
            source: "scorecaster-web-agent-v11-real-intelligence-v1"
          }]
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Paper save failed");
      setMessage(tr({ fi: "Kohde tallennettiin virtuaaliseen paperiseurantaan. Oikeaa toimeksiantoa ei tehty.", en: "The selection was saved to virtual paper tracking. No real transaction was made.", es: "La selección se guardó en seguimiento virtual. No se realizó ninguna transacción real." }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : tr({ fi: "Tallennus epäonnistui.", en: "Save failed.", es: "No se pudo guardar." }));
    } finally {
      setBusyId(null);
    }
  }

  const decisions = portfolio?.decisions || [];
  const visibleDecisions = useMemo(() => decisions.filter((item) => filter === "ALL" || item.decision === filter), [decisions, filter]);
  const lab = portfolio?.modelLab || {};
  const intelligence = portfolio?.sportsIntelligence || {};

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.2),transparent_35%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-9">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">Agent V11 · Real Sports Intelligence V1</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{tr({ fi: "Palvelimen vahvistama päätöskopilotti", en: "Server-authoritative decision copilot", es: "Copiloto de decisiones validado por el servidor" })}</h1>
        <p className="mt-4 max-w-4xl text-slate-300">{tr({ fi: "Markkinatodennäköisyys pysyy lukittuna. Uutiset, loukkaantumiset ja kokoonpanot näkyvät vain lähteistettynä evidenssinä ja voivat turvallisuussyistä alentaa PLAYn WATCHiksi.", en: "The market probability remains locked. News, injuries and lineups appear only as sourced evidence and may downgrade PLAY to WATCH for safety.", es: "La probabilidad de mercado permanece bloqueada. Noticias, lesiones y alineaciones solo aparecen como evidencia con fuente y pueden rebajar PLAY a WATCH por seguridad." })}</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => void load()} disabled={loading} className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? tr({ fi: "Analysoidaan…", en: "Analyzing…", es: "Analizando…" }) : tr({ fi: "Päivitä Agent", en: "Refresh Agent", es: "Actualizar Agent" })}</button><Link href="/watchlist" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir lista" })}</Link></div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error} <Link href="/login" className="font-black underline">{tr({ fi: "Kirjaudu tarvittaessa", en: "Sign in if needed", es: "Inicia sesión si es necesario" })}</Link></div>}
      {message && <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 p-4 text-sky-100">{message}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="PLAY" value={portfolio?.counts?.PLAY || 0} tone="text-emerald-300" />
        <Metric label="WATCH" value={portfolio?.counts?.WATCH || 0} tone="text-yellow-300" />
        <Metric label="SKIP" value={portfolio?.counts?.SKIP || 0} tone="text-red-300" />
        <Metric label={tr({ fi: "Paperialtistus", en: "Paper exposure", es: "Exposición simulada" })} value={money(portfolio?.totalAllocated)} tone="text-sky-300" />
        <Metric label={tr({ fi: "Konteksti arvioitu", en: "Context evaluated", es: "Contexto evaluado" })} value={`${intelligence.evaluated || 0}/${intelligence.maximumEvaluatedPerRequest || 6}`} tone="text-purple-300" />
        <Metric label={tr({ fi: "Konteksti esti", en: "Context blocked", es: "Contexto bloqueó" })} value={intelligence.blockedByVerifiedContext || 0} tone="text-orange-300" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Agent V11 Model Lab" subtitle={tr({ fi: "Kronologinen champion–challenger-varjotesti", en: "Chronological champion–challenger shadow test", es: "Prueba sombra cronológica champion–challenger" })}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={lab.status || "unavailable"} /><Metric label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={`${lab.sampleSize || 0}/${lab.minimumSamples || 120}`} /><Metric label="Champion Brier" value={optionalNumber(lab.champion?.holdout?.brierScore)} /><Metric label="Challenger Brier" value={optionalNumber(lab.challenger?.holdout?.brierScore)} /></div>
          <p className="mt-4 text-sm text-slate-400">{tr({ fi: `Drift: ${lab.drift?.status || "unknown"}. Haastaja ei muuta tuotannon todennäköisyyttä automaattisesti.`, en: `Drift: ${lab.drift?.status || "unknown"}. The challenger does not automatically change production probability.`, es: `Drift: ${lab.drift?.status || "unknown"}. El challenger no cambia automáticamente la probabilidad de producción.` })}</p>
        </Panel>
        <Panel title={tr({ fi: "Urheilukontekstin auditointi", en: "Sports-context audit", es: "Auditoría del contexto deportivo" })} subtitle={tr({ fi: "Vain varmennetut lähteet; ei todennäköisyysmuutosta", en: "Verified sources only; no probability adjustment", es: "Solo fuentes verificadas; sin ajuste de probabilidad" })}>
          <div className="grid gap-3 sm:grid-cols-3"><Metric label={tr({ fi: "Varmennettu", en: "Verified", es: "Verificado" })} value={intelligence.verified || 0} tone="text-emerald-300" /><Metric label={tr({ fi: "Osittainen", en: "Partial", es: "Parcial" })} value={intelligence.partial || 0} tone="text-yellow-300" /><Metric label={tr({ fi: "Ei saatavilla", en: "Unavailable", es: "No disponible" })} value={intelligence.unavailable || 0} /></div>
          <p className="mt-4 text-sm text-slate-400">{tr({ fi: "Ulkoinen markkinadata on vain kontekstia eikä päätössyöte. Arvioimattomat alemman prioriteetin kohteet eivät saa PLAY-paperialtistusta.", en: "External market data is context only, not a decision input. Unevaluated lower-priority selections receive no PLAY paper exposure.", es: "Los mercados externos son solo contexto, no entrada de decisión. Las selecciones no evaluadas no reciben exposición PLAY." })}</p>
        </Panel>
      </section>

      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <summary className="cursor-pointer font-black text-white">{tr({ fi: "Muokkaa paperirajoja", en: "Edit paper limits", es: "Editar límites simulados" })}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Setting label={t("term.bankroll")} value={bankroll} onChange={updateSetting(setBankroll, "bankroll", 1000, 0, 10000000)} />
          <Setting label={tr({ fi: "Yksittäinen %", en: "Single %", es: "Individual %" })} value={maxStakePercent} step="0.1" onChange={updateSetting(setMaxStakePercent, "agentMaxStakePercent", 1, 0.1, 5)} />
          <Setting label={tr({ fi: "Kokonaisaltistus %", en: "Total exposure %", es: "Exposición total %" })} value={maxTotalExposurePercent} step="0.5" onChange={updateSetting(setMaxTotalExposurePercent, "agentMaxTotalExposurePercent", 4, 0.5, 20)} />
          <Setting label={tr({ fi: "Liiga-altistus %", en: "League exposure %", es: "Exposición liga %" })} value={maxLeagueExposurePercent} step="0.25" onChange={updateSetting(setMaxLeagueExposurePercent, "agentMaxLeagueExposurePercent", 2, 0.25, 10)} />
          <button onClick={() => void load()} className="rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950">{tr({ fi: "Käytä rajoja", en: "Apply limits", es: "Aplicar límites" })}</button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">{["ALL", "PLAY", "WATCH", "SKIP"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-black ${filter === item ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-400"}`}>{item === "ALL" ? tr({ fi: "KAIKKI", en: "ALL", es: "TODOS" }) : item}</button>)}</div>

      <div className="space-y-5">
        {!loading && visibleDecisions.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-400">{tr({ fi: "Tällä suodattimella ei ole päätöksiä.", en: "No decisions match this filter.", es: "No hay decisiones con este filtro." })}</div>}
        {visibleDecisions.map((decision, index) => {
          const id = String(decision.gameId || decision.eventId || decision.id || `${decision.match}-${decision.selection}-${index}`);
          const context = decision.verifiedIntelligence || decision.sportsIntelligence || {};
          const expanded = expandedId === id;
          return <article key={id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm text-slate-400">{decision.leagueTitle || decision.league || decision.sportKey || "Sport"}</div><h2 className="mt-1 text-2xl font-black">{decision.match || `${decision.homeTeam || ""} – ${decision.awayTeam || ""}`}</h2><p className="mt-1 text-slate-300">{decision.selection} · {Number(decision.odds || 0).toFixed(2)} · {decision.bookmaker || "–"}</p></div><span className={`rounded-full border px-4 py-2 text-sm font-black ${decisionClass(decision.decision)}`}>{decision.decision}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-7"><Metric label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={optionalPercent(decision.stressTest?.probability)} /><Metric label={tr({ fi: "Stressialue", en: "Stress range", es: "Rango de estrés" })} value={`${optionalPercent(decision.stressTest?.lower)}–${optionalPercent(decision.stressTest?.upper)}`} /><Metric label={tr({ fi: "Alarajan EV", en: "Downside EV", es: "EV a la baja" })} value={optionalPercent(decision.stressTest?.downsideEv)} /><Metric label={tr({ fi: "Kestävyys", en: "Robustness", es: "Robustez" })} value={optionalPercent(decision.robustnessScore)} /><Metric label={tr({ fi: "Konteksti", en: "Context", es: "Contexto" })} value={context.status || "unavailable"} tone={contextTone(context.status)} /><Metric label={tr({ fi: "Kattavuus", en: "Coverage", es: "Cobertura" })} value={optionalPercent(context.coverageScore)} /><Metric label={t("term.paperStake")} value={money(decision.suggestedStake)} tone="text-purple-300" /></div>
            <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">{decision.decisionReason}</div>{decision.portfolioReason && <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-400/10 p-3 text-sm text-purple-100">{decision.portfolioReason}</div>}
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setExpandedId(expanded ? null : id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">{expanded ? tr({ fi: "Piilota auditointi", en: "Hide audit", es: "Ocultar auditoría" }) : tr({ fi: "Näytä evidenssi ja lähteet", en: "Show evidence and sources", es: "Mostrar evidencia y fuentes" })}</button><button onClick={() => void savePaper(decision, index)} disabled={busyId !== null || decision.decision !== "PLAY" || !decision.suggestedStake} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-40">{tr({ fi: "Paperiseurantaan", en: "Paper tracking", es: "Seguimiento simulado" })}</button></div>
            {expanded && <div className="mt-5 grid gap-4 lg:grid-cols-2"><AuditList title={tr({ fi: "Todennettu evidenssi", en: "Verified evidence", es: "Evidencia verificada" })} items={decision.evidence} tone="emerald" /><AuditList title={tr({ fi: "Vastaväitteet", en: "Counterarguments", es: "Contraargumentos" })} items={decision.counterArguments} tone="red" /><AuditList title={tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia faltante" })} items={decision.missingEvidence} tone="yellow" /><div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4"><div className="font-black text-sky-300">{tr({ fi: "Lähteiden tila", en: "Source status", es: "Estado de fuentes" })}</div><div className="mt-3 space-y-2">{(context.sources || []).map((source) => <div key={source.category} className="text-sm text-slate-300"><span className="font-bold">{source.category}</span>: {source.provider} · {source.mode} · {source.live ? tr({ fi: "live", en: "live", es: "en vivo" }) : tr({ fi: "ei live", en: "not live", es: "no en vivo" })}</div>)}{!(context.sources || []).length && <p className="text-sm text-slate-400">{tr({ fi: "Lähteitä ei arvioitu tälle kohteelle.", en: "Sources were not evaluated for this selection.", es: "No se evaluaron fuentes para esta selección." })}</p>}</div></div><div className="lg:col-span-2"><AgentExplanation pick={decision} /></div></div>}
          </article>;
        })}
      </div>
    </div>
  );
}

function Setting({ label, value, onChange, step = "1" }) { return <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{label}<input type="number" value={value} step={step} onChange={onChange} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" /></label>; }
function AuditList({ title, items = [], tone }) { const className = tone === "emerald" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : tone === "red" ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-yellow-400/20 bg-yellow-400/10 text-yellow-300"; return <div className={`rounded-xl border p-4 ${className}`}><div className="font-black">{title}</div>{items.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{items.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">–</p>}</div>; }
