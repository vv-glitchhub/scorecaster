"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { MetricTile } from "./ProductUI";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const decimal = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function Factor({ title, item, emptyLabel }) {
  return (
    <div className="rounded-[1.15rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{title}</div>
      <div className="mt-2 font-black text-[var(--sc-text)]">{item?.label || emptyLabel}</div>
      <div className="mt-1 text-sm text-[var(--sc-muted)]">{item?.value === null || item?.value === undefined ? item?.direction || "missing" : `${decimal(item.value)} · ${item.direction}`}</div>
    </div>
  );
}

function ContributionTable({ title, reconciliation }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-black text-[var(--sc-text)]">{title}</div>
        <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${reconciliation?.reconciled ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-200"}`}>
          reconciled={String(Boolean(reconciliation?.reconciled))}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="uppercase tracking-[0.11em] text-[var(--sc-faint)]"><tr><th className="p-2">Component</th><th className="p-2">Input</th><th className="p-2">Weight</th><th className="p-2">Contribution</th></tr></thead>
          <tbody>{(reconciliation?.contributions || []).map((item) => <tr key={item.id} className="border-t border-[var(--sc-border)]"><td className="p-2 font-black text-[var(--sc-text)]">{item.id}</td><td className="p-2">{decimal(item.normalizedInput ?? item.input)}</td><td className="p-2">{decimal(item.weight)}</td><td className="p-2 font-black text-[var(--sc-brand)]">{decimal(item.contribution)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-[var(--sc-muted)]">recomputed={decimal(reconciliation?.recomputed)} · displayed={decimal(reconciliation?.displayed)} · difference={decimal(reconciliation?.difference, 6)}</div>
    </div>
  );
}

export default function ProfessionalExplanationCard({ eventId, initialMode = "simple", compact = false }) {
  const { tr } = useLanguage();
  const [mode, setMode] = useState(initialMode === "pro" ? "pro" : "simple");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ eventId, mode: "pro" });
      const response = await fetch(`/api/transparency?${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Explanation unavailable");
      setPayload(data.professionalExplanation || null);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Explanation unavailable");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const simple = payload?.simple;
  const pro = payload?.pro;
  const missing = useMemo(() => Array.isArray(simple?.missingEvidence) ? simple.missingEvidence : [], [simple]);

  if (!eventId) return null;
  if (loading) return <section className="sc-surface rounded-[1.55rem] p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Rakennetaan toistettavaa selitystä…", en: "Building a reproducible explanation…", es: "Construyendo una explicación reproducible…" })}</section>;

  return (
    <section className={`sc-surface rounded-[1.65rem] ${compact ? "p-5" : "p-5 sm:p-6"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Professional Explanation V1</div>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Mistä tämä arvio syntyi?", en: "How was this assessment produced?", es: "¿Cómo se produjo esta evaluación?" })}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Selitys muodostetaan suoraan laskennan evidenssistä. Puuttuvaa tietoa ei muuteta nollaksi eikä markkinaa nimetä itsenäiseksi malliksi.", en: "The explanation is derived directly from calculation evidence. Missing values are not converted to zero and market data is not labeled as an independent model.", es: "La explicación se deriva directamente de la evidencia del cálculo. Los valores ausentes no se convierten en cero y el mercado no se etiqueta como modelo independiente." })}</p>
        </div>
        <div className="flex rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-1">
          {["simple", "pro"].map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-4 py-2 text-xs font-black uppercase ${mode === item ? "bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "text-[var(--sc-muted)]"}`}>{item}</button>)}
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
      {!error && !payload && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">{tr({ fi: "Tapahtumalle ei ole julkaistavaa selitysevidenssiä.", en: "No publishable explanation evidence is available for this event.", es: "No hay evidencia publicable para este evento." })}</div>}

      {payload && mode === "simple" && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label={tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" })} value={pct(simple?.probability)} tone="blue" hint={simple?.probabilityLabel} />
            <MetricTile label={tr({ fi: "Valittu hinta", en: "Selected price", es: "Cuota elegida" })} value={decimal(simple?.selectedPrice, 2)} />
            <MetricTile label={tr({ fi: "Päätös", en: "Decision", es: "Decisión" })} value={simple?.verdict || "–"} />
          </div>
          <div className="rounded-[1.15rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">{simple?.summary}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Factor title={tr({ fi: "Vahvin positiivinen tekijä", en: "Strongest positive factor", es: "Factor positivo principal" })} item={simple?.strongestPositiveFactor} emptyLabel={tr({ fi: "Ei vahvaa positiivista evidenssiä", en: "No strong positive evidence", es: "Sin evidencia positiva fuerte" })} />
            <Factor title={tr({ fi: "Suurin riski", en: "Strongest risk", es: "Riesgo principal" })} item={simple?.strongestRisk} emptyLabel={tr({ fi: "Ei yksittäistä riskitekijää", en: "No single risk factor", es: "Sin un riesgo único" })} />
          </div>
          <div className="rounded-[1.15rem] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            <span className="font-black">{tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia ausente" })}: </span>{missing.length ? missing.join(", ") : tr({ fi: "ei havaittua ydinputetta", en: "no core missing item detected", es: "sin ausencia principal detectada" })}
          </div>
        </div>
      )}

      {payload && mode === "pro" && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label={tr({ fi: "Itsenäinen malli", en: "Independent model", es: "Modelo independiente" })} value={pct(pro?.probabilitySeparation?.independentModelProbability)} tone="purple" />
            <MetricTile label={tr({ fi: "Markkinavertailu", en: "Market benchmark", es: "Referencia de mercado" })} value={pct(pro?.probabilitySeparation?.marketBenchmarkProbability)} tone="blue" />
            <MetricTile label={tr({ fi: "Vedonvälittäjän hinta", en: "Bookmaker price", es: "Cuota del operador" })} value={decimal(pro?.probabilitySeparation?.selectedBookmakerPrice, 2)} />
            <MetricTile label={tr({ fi: "Evidenssin laatu", en: "Evidence quality", es: "Calidad de evidencia" })} value={pct(pro?.calculations?.quality)} />
          </div>

          {pro?.uncertainty && <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-brand)]">Evidence sensitivity band</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{pct(pro.uncertainty.lower)} – {pct(pro.uncertainty.upper)}</div><div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{pro.uncertainty.note}</div></div>}

          <div className="grid gap-4 xl:grid-cols-2">
            <ContributionTable title={tr({ fi: "Laatukontribuutiot", en: "Quality contributions", es: "Contribuciones de calidad" })} reconciliation={pro?.evidenceQualityDecomposition} />
            <ContributionTable title={tr({ fi: "Ranking-täsmäytys", en: "Ranking reconciliation", es: "Conciliación del ranking" })} reconciliation={pro?.rankingReconciliation} />
          </div>

          <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
            <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-brand)]">Active model</div>
            <div className="mt-2 font-black text-[var(--sc-text)]">{pro?.activeModel?.id}</div>
            <div className="mt-1 text-sm text-[var(--sc-muted)]">role={pro?.activeModel?.role} · independent={String(Boolean(pro?.activeModel?.independentPredictiveModel))} · training={pro?.trainingStatus} · cutoff={pro?.featureAvailabilityCutoff}</div>
          </div>

          <details className="rounded-[1.2rem] border border-[var(--sc-border)] p-4">
            <summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: "Kaavat ja toteutuspolut", en: "Formulas and implementation paths", es: "Fórmulas y rutas de implementación" })}</summary>
            <div className="mt-4 space-y-3">{(pro?.formulasUsed || []).map((formula) => <div key={formula.id} className="rounded-xl bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{formula.name}</div><code className="mt-2 block whitespace-pre-wrap text-xs text-[var(--sc-brand)]">{formula.formula}</code><div className="mt-2 text-xs text-[var(--sc-muted)]">{formula.implementationPath} · {formula.note}</div></div>)}</div>
          </details>

          <div className="rounded-[1.2rem] border border-[var(--sc-border)] p-4 text-xs leading-5 text-[var(--sc-muted)]">
            snapshotHash={payload.reproducibility?.snapshotHash}<br />
            contributionsReconcile={String(Boolean(pro?.contributionsReconcile))} · marketMislabeledAsIndependentModel=false · missingValuesConvertedToZero=false
          </div>
          <div className="flex flex-wrap gap-2"><Link href={`/api/transparency?eventId=${encodeURIComponent(eventId)}&mode=pro`} className="sc-button-secondary">JSON audit</Link><Link href={`/api/transparency?eventId=${encodeURIComponent(eventId)}&mode=pro&reproduce=1&snapshotHash=${encodeURIComponent(payload.reproducibility?.snapshotHash || "")}`} className="sc-button-ghost">Reproduce snapshot</Link><Link href="/model-lab" className="sc-button-ghost">Model Lab</Link></div>
        </div>
      )}
    </section>
  );
}
