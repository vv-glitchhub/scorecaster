"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { DecisionBadge, EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "./ProductUI";
import { formatPercent } from "../../lib/analysis-engine";

function gateLabel(code, tr) {
  const labels = {
    "fresh-data": tr({ fi: "Tuore data", en: "Fresh data", es: "Datos recientes" }),
    "bookmaker-coverage": tr({ fi: "Markkinakattavuus", en: "Market coverage", es: "Cobertura" }),
    confidence: tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" }),
    edge: "Edge",
    ev: "EV",
    "verified-evidence": tr({ fi: "Varmennettu evidenssi", en: "Verified evidence", es: "Evidencia verificada" }),
    "safety-recheck": tr({ fi: "Final safety check", en: "Final safety check", es: "Control final" }),
    "maintain-play-gates": tr({ fi: "Säilytä PLAY-portit", en: "Maintain PLAY gates", es: "Mantener filtros PLAY" })
  };
  return labels[code] || code || "–";
}

function kickoff(value, locale) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function GateStrip({ item, tr }) {
  const gates = item.intelligenceV2?.visiblePlayGates || [];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {gates.map((gate) => (
        <div key={gate.code} className={`rounded-xl border px-3 py-2 ${gate.passed ? "border-emerald-400/20 bg-emerald-400/8" : "border-amber-400/25 bg-amber-400/8"}`}>
          <div className={`text-[9px] font-black uppercase tracking-[0.12em] ${gate.passed ? "text-emerald-300" : "text-amber-200"}`}>{gate.passed ? "PASS" : "BLOCKED"}</div>
          <div className="mt-1 text-xs font-bold text-[var(--sc-text-secondary)]">{gateLabel(gate.code, tr)}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreBreakdown({ item, tr }) {
  const decomposition = item.intelligenceV2?.scoreDecomposition;
  if (!decomposition) return null;
  return (
    <details className="mt-4 rounded-[1.1rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Mistä suosituspisteet muodostuvat?", en: "What builds the recommendation score?", es: "¿Cómo se forma la puntuación?" })}</summary>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(decomposition.components || []).map((component) => (
          <div key={component.code} className="rounded-xl border border-[var(--sc-border)] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{component.code}</div>
            <div className="mt-1 text-lg font-black text-[var(--sc-text)]">+{Number(component.contribution || 0).toFixed(1)}</div>
            <div className="text-xs text-[var(--sc-muted)]">{tr({ fi: "paino", en: "weight", es: "peso" })} {(Number(component.weight || 0) * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">
        {tr({ fi: `Raakapisteet ${Number(decomposition.rawScore || 0).toFixed(1)} · päätösluokan katto ${decomposition.decisionCeiling}. Katto estää ranking-pisteitä muuttamasta CAUTION/SKIP-luokitusta PLAYksi.`, en: `Raw score ${Number(decomposition.rawScore || 0).toFixed(1)} · decision-class ceiling ${decomposition.decisionCeiling}. The ceiling prevents ranking score from turning CAUTION/SKIP into PLAY.`, es: `Puntuación bruta ${Number(decomposition.rawScore || 0).toFixed(1)} · límite de clase ${decomposition.decisionCeiling}. El límite impide que el ranking convierta CAUTION/SKIP en PLAY.` })}
      </p>
    </details>
  );
}

function OpportunityCard({ item, locale, tr }) {
  const intelligence = item.intelligenceV2 || {};
  const signals = intelligence.opportunitySignals || [];
  return (
    <article className="sc-surface rounded-[1.55rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">#{item.rank} · {kickoff(item.commenceTime, locale)} · {item.league || ""}</div>
          <h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{item.match}</h3>
          <div className="mt-1 font-bold text-[var(--sc-text-secondary)]">{item.selection} {item.odds ? <span className="text-[var(--sc-brand)]">@ {Number(item.odds).toFixed(2)}</span> : null}</div>
        </div>
        <DecisionBadge decision={item.decision} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MetricTile compact label={tr({ fi: "Pisteet", en: "Score", es: "Puntos" })} value={`${Number(item.score || 0).toFixed(0)}/100`} tone={item.decision === "PLAY" ? "green" : "yellow"} />
        <MetricTile compact label="Edge" value={formatPercent(item.edge)} />
        <MetricTile compact label="EV" value={formatPercent(item.ev)} />
        <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={formatPercent(item.confidence)} />
        <MetricTile compact label={tr({ fi: "Portit", en: "Gates", es: "Filtros" })} value={`${intelligence.visibleGateSummary?.passed || 0}/${intelligence.visibleGateSummary?.total || 6}`} />
      </div>

      <GateStrip item={item} tr={tr} />

      <div className="mt-4 flex flex-wrap gap-2">
        {signals.map((signal) => <span key={signal.code} className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">{signal.label}</span>)}
      </div>

      <div className="mt-4 rounded-[1rem] border border-amber-400/20 bg-amber-400/7 p-4 text-sm leading-6 text-[var(--sc-muted)]">
        <strong className="text-amber-200">{tr({ fi: "Seuraava näkyvä portti", en: "Next visible gate", es: "Siguiente filtro visible" })}:</strong> {gateLabel(item.nextGate?.code, tr)}.
        {intelligence.nearPlay ? ` ${tr({ fi: "Tämä on yhden näkyvän PLAY-portin päässä, mutta final safety check vaaditaan silti ennen PLAY-tilaa.", en: "This is one visible PLAY gate away, but the final safety check is still required before PLAY.", es: "Está a un filtro visible de PLAY, pero aún se requiere el control final antes de PLAY." })}` : ""}
      </div>

      <ScoreBreakdown item={item} tr={tr} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/journey?eventId=${encodeURIComponent(item.eventId || "")}&selection=${encodeURIComponent(item.selection || "")}`} className="sc-button-secondary">{tr({ fi: "Avaa Journey", en: "Open Journey", es: "Abrir Journey" })}</Link>
        <Link href="/auto-watch" className="sc-button-ghost">Auto-Watch</Link>
      </div>
    </article>
  );
}

function LeagueReadiness({ rows, tr }) {
  if (!rows.length) return null;
  return (
    <section>
      <SectionHeader title={tr({ fi: "Current Window League Readiness", en: "Current Window League Readiness", es: "Preparación de liga en la ventana actual" })} description={tr({ fi: "Luokitus kuvaa vain tämän live-suositusikkunan datan kattavuutta — ei koko liigan historiallista laatua.", en: "This classification describes only the current live recommendation window, not the league's historical quality.", es: "La clasificación describe solo la ventana actual, no la calidad histórica de toda la liga." })} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => <article key={row.league} className="sc-surface rounded-[1.35rem] p-4"><div className="flex items-center justify-between gap-3"><div className="font-black text-[var(--sc-text)]">{row.league}</div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${row.status === "full" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : row.status === "partial" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}>{row.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--sc-muted)]"><div>{tr({ fi: "Otos", en: "Sample", es: "Muestra" })}: <strong className="text-[var(--sc-text)]">{row.sampleSize}</strong></div><div>{tr({ fi: "Bookkerit avg", en: "Bookmakers avg", es: "Casas prom." })}: <strong className="text-[var(--sc-text)]">{row.averageBookmakers}</strong></div><div>{tr({ fi: "Confidence", en: "Confidence", es: "Confianza" })}: <strong className="text-[var(--sc-text)]">{formatPercent(row.averageConfidence)}</strong></div><div>{tr({ fi: "Verified", en: "Verified", es: "Verificado" })}: <strong className="text-[var(--sc-text)]">{formatPercent(row.verifiedEvidenceRate)}</strong></div></div></article>)}
      </div>
    </section>
  );
}

export default function RecommendationIntelligenceCenter({ mode = "radar" }) {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=20", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Recommendation intelligence unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "Recommendation intelligence unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => mode === "near-play"
    ? (Array.isArray(data?.nearPlay) ? data.nearPlay : [])
    : (Array.isArray(data?.opportunityRadar?.opportunities) ? data.opportunityRadar.opportunities : []), [data, mode]);
  const leagueRows = Array.isArray(data?.leagueReadiness) ? data.leagueReadiness : [];
  const counts = data?.opportunityRadar?.counts || {};

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow={mode === "near-play" ? "Near PLAY V1" : "Opportunity Radar V1"}
        title={mode === "near-play"
          ? tr({ fi: "Mitkä kohteet ovat yhden näkyvän portin päässä PLAYsta?", en: "Which picks are one visible gate away from PLAY?", es: "¿Qué selecciones están a un filtro visible de PLAY?" })
          : tr({ fi: "Näe nykyiset mahdollisuudet ja pullonkaulat ennen kuin markkina muuttuu", en: "See current opportunities and bottlenecks before the market changes", es: "Ve oportunidades y cuellos de botella antes de que cambie el mercado" })}
        description={tr({ fi: "Näkymä ei muuta päätöksiä. Se järjestää nykyisen Recommendation Engine -datan ja näyttää täsmälleen mitkä tuotantoportit ovat auki tai kiinni.", en: "This view never changes decisions. It organizes current Recommendation Engine data and shows exactly which production gates are open or blocked.", es: "La vista nunca cambia decisiones. Organiza los datos actuales y muestra qué filtros están abiertos o bloqueados." })}
        actions={<><button type="button" disabled={loading} onClick={() => void load()} className="sc-button-primary">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href={mode === "near-play" ? "/opportunities" : "/near-play"} className="sc-button-secondary">{mode === "near-play" ? "Opportunity Radar" : "Near PLAY"}</Link><Link href="/recommendations/compare" className="sc-button-ghost">{tr({ fi: "Vertaa kohteita", en: "Compare picks", es: "Comparar" })}</Link></>}
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label="PLAY" value={data?.counts?.PLAY ?? "…"} tone="green" /><MetricTile compact label="Near PLAY" value={data?.counts?.NEAR_PLAY ?? counts.nearPlay ?? "…"} tone="yellow" /><MetricTile compact label={tr({ fi: "Evidence blocker", en: "Evidence blocker", es: "Bloqueo evidencia" })} value={counts.evidenceBottleneck ?? "…"} tone="purple" /><MetricTile compact label={tr({ fi: "Price blocker", en: "Price blocker", es: "Bloqueo precio" })} value={counts.priceBottleneck ?? "…"} tone="blue" /></div>}
      />

      <TrustBar items={[
        { label: "Decision authority", value: "Production Recommendation Engine", tone: "good" },
        { label: "Upgrade by this view", value: "disabled", tone: "good" },
        { label: "Probability adjustment", value: "disabled", tone: "good" },
        { label: "Mode", value: "paper-only", tone: "warning" }
      ]} />

      {error && <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
      {!loading && !rows.length ? <EmptyState title={mode === "near-play" ? tr({ fi: "Yhtään yhden näkyvän portin Near PLAY -kohdetta ei ole juuri nyt", en: "No one-visible-gate Near PLAY picks right now", es: "No hay Near PLAY a un filtro visible ahora" }) : tr({ fi: "Opportunity Radar on tyhjä", en: "Opportunity Radar is empty", es: "Opportunity Radar está vacío" })} description={tr({ fi: "Tämä on hyväksyttävä tila: Scorecaster ei luo mahdollisuuksia puuttuvasta datasta.", en: "This is a valid state: Scorecaster does not invent opportunities from missing data.", es: "Es un estado válido: Scorecaster no inventa oportunidades con datos faltantes." })} /> : <div className="grid gap-4 xl:grid-cols-2">{rows.map((item) => <OpportunityCard key={`${item.eventId}-${item.selection}-${item.rank}`} item={item} locale={locale} tr={tr} />)}</div>}

      {mode === "radar" && <LeagueReadiness rows={leagueRows} tr={tr} />}
    </div>
  );
}
