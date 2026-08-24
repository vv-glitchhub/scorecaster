"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { DecisionBadge, EmptyState, MetricTile, PageHero, TrustBar } from "../components/ProductUI";
import { formatPercent } from "../../lib/analysis-engine";

function identity(item) {
  return `${item?.eventId || ""}::${item?.marketKey || "h2h"}::${item?.selection || ""}`;
}

function gateName(code, tr) {
  return ({
    "fresh-data": tr({ fi: "Tuore data", en: "Fresh data", es: "Datos recientes" }),
    "bookmaker-coverage": tr({ fi: "Bookmaker-kattavuus", en: "Bookmaker coverage", es: "Cobertura de casas" }),
    confidence: tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" }),
    edge: "Edge",
    ev: "EV",
    "verified-evidence": tr({ fi: "Verified evidence", en: "Verified evidence", es: "Evidencia verificada" }),
    "safety-recheck": tr({ fi: "Final safety", en: "Final safety", es: "Control final" }),
    "maintain-play-gates": tr({ fi: "PLAY-portit auki", en: "PLAY gates open", es: "Filtros PLAY abiertos" })
  })[code] || code || "–";
}

function CompareColumn({ item, tr }) {
  const intelligence = item.intelligenceV2 || {};
  const decomposition = intelligence.scoreDecomposition || {};
  return (
    <article className="sc-surface min-w-0 rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">#{item.rank} · {item.league || ""}</div><div className="mt-2 truncate text-lg font-black text-[var(--sc-text)]">{item.match}</div><div className="mt-1 text-sm font-bold text-[var(--sc-text-secondary)]">{item.selection} {item.odds ? <span className="text-[var(--sc-brand)]">@ {Number(item.odds).toFixed(2)}</span> : null}</div></div><DecisionBadge decision={item.decision} /></div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricTile compact label={tr({ fi: "Pisteet", en: "Score", es: "Puntos" })} value={`${Number(item.score || 0).toFixed(1)}`} />
        <MetricTile compact label="Edge" value={formatPercent(item.edge)} />
        <MetricTile compact label="EV" value={formatPercent(item.ev)} />
        <MetricTile compact label={tr({ fi: "Confidence", en: "Confidence", es: "Confianza" })} value={formatPercent(item.confidence)} />
        <MetricTile compact label={tr({ fi: "Fair kerroin", en: "Fair odds", es: "Cuota justa" })} value={item.fairOdds ? Number(item.fairOdds).toFixed(2) : "–"} />
        <MetricTile compact label={tr({ fi: "3% EV floor", en: "3% EV floor", es: "Piso EV 3%" })} value={item.minimumEvOdds ? Number(item.minimumEvOdds).toFixed(2) : "–"} />
        <MetricTile compact label={tr({ fi: "Bookkerit", en: "Bookmakers", es: "Casas" })} value={String(item.bookmakerCount || 0)} />
        <MetricTile compact label={tr({ fi: "Gate progress", en: "Gate progress", es: "Progreso filtros" })} value={`${intelligence.visibleGateSummary?.passed || 0}/${intelligence.visibleGateSummary?.total || 6}`} />
      </div>

      <TrustBar className="mt-4" items={[
        { label: tr({ fi: "Evidenssi", en: "Evidence", es: "Evidencia" }), value: item.readiness || "–", tone: item.readiness === "verified" ? "good" : "warning" },
        { label: tr({ fi: "Tuoreus", en: "Freshness", es: "Actualidad" }), value: item.freshness || "–", tone: item.freshness === "stale" ? "danger" : "info" },
        { label: tr({ fi: "Seuraava portti", en: "Next gate", es: "Siguiente filtro" }), value: gateName(item.nextGate?.code, tr), tone: intelligence.nearPlay ? "warning" : "info" }
      ]} />

      <div className="mt-4 space-y-2">
        {(intelligence.visiblePlayGates || []).map((gate) => <div key={gate.code} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sc-border)] px-3 py-2 text-xs"><span className="font-bold text-[var(--sc-text-secondary)]">{gateName(gate.code, tr)}</span><span className={gate.passed ? "font-black text-emerald-300" : "font-black text-amber-200"}>{gate.passed ? "PASS" : "BLOCKED"}</span></div>)}
      </div>

      <div className="mt-4 border-t border-[var(--sc-border)] pt-4">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Score decomposition</div>
        <div className="mt-2 grid grid-cols-3 gap-2">{(decomposition.components || []).map((component) => <div key={component.code} className="rounded-lg bg-[var(--sc-surface-soft)] p-2"><div className="text-[9px] font-black uppercase text-[var(--sc-faint)]">{component.code}</div><div className="mt-1 font-black text-[var(--sc-text)]">+{Number(component.contribution || 0).toFixed(1)}</div></div>)}</div>
      </div>
    </article>
  );
}

export default function CompareRecommendationsClient() {
  const { tr } = useLanguage();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=12", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "Comparison data unavailable");
      setData(payload);
      setSelected((current) => current.length ? current : (payload.recommendations || []).slice(0, 3).map(identity));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Comparison data unavailable");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const selectedRows = useMemo(() => recommendations.filter((item) => selected.includes(identity(item))).slice(0, 4), [recommendations, selected]);

  function toggle(item) {
    const key = identity(item);
    setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : current.length < 4 ? [...current, key] : current);
  }

  return <div className="space-y-7">
    <PageHero eyebrow="Recommendation Compare V1" title={tr({ fi: "Miksi #1 on parempi kuin #2?", en: "Why is #1 better than #2?", es: "¿Por qué #1 es mejor que #2?" })} description={tr({ fi: "Vertaa enintään neljä kohdetta samalla tuotantodatalla: decision, score, edge, EV, confidence, fair odds, markkinakattavuus, evidenssi ja kaikki näkyvät PLAY-portit.", en: "Compare up to four picks using the same production data: decision, score, edge, EV, confidence, fair odds, market coverage, evidence and every visible PLAY gate.", es: "Compara hasta cuatro selecciones con los mismos datos de producción: decisión, puntuación, edge, EV, confianza, cuota justa, cobertura, evidencia y filtros PLAY." })} actions={<><button type="button" onClick={() => void load()} disabled={loading} className="sc-button-primary">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/recommendations" className="sc-button-secondary">Recommendation Center</Link></>} />

    {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
    <section className="sc-surface rounded-[1.5rem] p-5"><div className="text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Valitse 2–4 vertailtavaa kohdetta", en: "Choose 2–4 picks to compare", es: "Elige 2–4 selecciones" })}</div><div className="mt-3 flex flex-wrap gap-2">{recommendations.map((item) => { const active = selected.includes(identity(item)); return <button type="button" key={identity(item)} onClick={() => toggle(item)} className={`rounded-xl border px-3 py-2 text-xs font-black ${active ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"}`}>#{item.rank} {item.selection} · {item.decision}</button>; })}</div><p className="mt-3 text-xs text-[var(--sc-muted)]">{tr({ fi: "Ranking ei saa päivittää päätöstä: CAUTION pysyy CAUTIONina, vaikka sen score olisi korkea.", en: "Ranking cannot upgrade a decision: CAUTION remains CAUTION even with a high score.", es: "El ranking no puede mejorar una decisión: CAUTION sigue siendo CAUTION aunque tenga puntuación alta." })}</p></section>

    {selectedRows.length < 2 ? <EmptyState title={tr({ fi: "Valitse vähintään kaksi kohdetta", en: "Select at least two picks", es: "Selecciona al menos dos" })} /> : <div className={`grid gap-4 ${selectedRows.length >= 3 ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}>{selectedRows.map((item) => <CompareColumn key={identity(item)} item={item} tr={tr} />)}</div>}
  </div>;
}
