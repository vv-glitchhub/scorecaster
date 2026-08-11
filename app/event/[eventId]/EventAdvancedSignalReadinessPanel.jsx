"use client";

import { SectionHeader } from "../../components/ProductUI";
import { useLanguage } from "../../components/LanguageProvider";

function compact(value, fallback = "–") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function percent(value) {
  if (value === null || value === undefined || value === "") return "–";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(0)}%` : "–";
}

function statusTone(status) {
  if (status === "review-ready-shadow") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "shadow-model-needs-holdout") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

function StatusBadge({ status }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${statusTone(status)}`}>{compact(status, "unknown")}</span>;
}

function FamilyCard({ row, tr }) {
  const coverage = row?.metricCoverage || {};
  return (
    <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-[var(--sc-text)]">{compact(row?.family)}</div>
          <div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "Seuraava vaatimus", en: "Next requirement", es: "Siguiente requisito" })}: {compact(row?.nextRequirement)}</div>
        </div>
        <StatusBadge status={row?.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Provider", en: "Provider", es: "Proveedor" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{row?.rawAnalyticsSourceConfigured === true ? tr({ fi: "konfiguroitu", en: "configured", es: "configurado" }) : tr({ fi: "puuttuu", en: "missing", es: "falta" })}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Probability-malli", en: "Probability model", es: "Modelo de probabilidad" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{row?.probabilityModelPresent === true ? tr({ fi: "on", en: "present", es: "presente" }) : tr({ fi: "ei", en: "none", es: "ninguno" })}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Holdout", en: "Holdout", es: "Holdout" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{row?.performanceEvidenceReady === true ? tr({ fi: "valmis", en: "ready", es: "listo" }) : tr({ fi: "puuttuu", en: "missing", es: "falta" })}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Metric lineage", en: "Metric lineage", es: "Linaje métrico" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{coverage?.observed === true ? percent(coverage?.rate) : tr({ fi: "ei vielä", en: "not yet", es: "aún no" })}</div></div>
      </div>

      {Array.isArray(row?.modelIds) && row.modelIds.length ? <div className="mt-4 text-xs text-[var(--sc-muted)]"><span className="font-black text-[var(--sc-text)]">Models:</span> {row.modelIds.join(", ")}</div> : null}
      {Array.isArray(coverage?.missingMetrics) && coverage.missingMetrics.length ? <div className="mt-3 text-xs leading-5 text-[var(--sc-muted)]"><span className="font-black text-[var(--sc-text)]">{tr({ fi: "Tavoitemetriikat", en: "Anchor metrics", es: "Métricas objetivo" })}:</span> {coverage.missingMetrics.slice(0, 5).join(", ")}</div> : null}
    </div>
  );
}

export default function EventAdvancedSignalReadinessPanel({ row }) {
  const { tr } = useLanguage();
  const readiness = row?.advancedSignalReadiness || {};
  const families = Array.isArray(readiness?.families) ? readiness.families : [];
  const counts = readiness?.counts || {};
  const provider = readiness?.rawAnalyticsProvider || {};
  const next = readiness?.nextPriority || {};

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Independent Signal Readiness"
        title={tr({ fi: "Mitä seuraavalta oikeasti riippumattomalta mallilta vielä puuttuu", en: "What the next genuinely independent model still needs", es: "Qué le falta al próximo modelo realmente independiente" })}
        description={tr({
          fi: "Scorecaster erottaa datalähteen, metriikat, probability-mallin ja holdout-näytön toisistaan. Raaka xG-, shot-, efficiency- tai tracking-data ei koskaan muutu automaattisesti ennusteeksi.",
          en: "Scorecaster keeps the data source, metrics, probability model and holdout evidence separate. Raw xG, shot, efficiency or tracking data never becomes a prediction automatically.",
          es: "Scorecaster separa la fuente, las métricas, el modelo de probabilidad y la evidencia holdout. Los datos xG, shots, efficiency o tracking nunca se convierten automáticamente en una predicción."
        })}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Advanced provider", en: "Advanced provider", es: "Proveedor avanzado" })}</div><div className="mt-2 text-lg font-black text-[var(--sc-text)]">{provider?.configured === true ? tr({ fi: "Konfiguroitu", en: "Configured", es: "Configurado" }) : tr({ fi: "Ei konfiguroitu", en: "Not configured", es: "No configurado" })}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{compact(provider?.source)}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Shadow-perheitä", en: "Shadow families", es: "Familias shadow" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{Number(counts?.shadowModelReadyFamilies || 0)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "aidosti uutta signaaliperhettä", en: "advanced signal families with models", es: "familias avanzadas con modelo" })}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Holdout-valmiit", en: "Holdout ready", es: "Holdout listo" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{Number(counts?.reviewReadyFamilies || 0)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "perhettä review-tasolla", en: "families ready for review", es: "familias listas para revisión" })}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Seuraava prioriteetti", en: "Next priority", es: "Siguiente prioridad" })}</div><div className="mt-2 text-sm font-black text-[var(--sc-text)]">{compact(next?.family, tr({ fi: "ei puutteita", en: "none", es: "ninguna" }))}</div><div className="mt-1 break-words text-xs text-[var(--sc-muted)]">{compact(next?.requirement)}</div></div>
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-3">
        {families.map((family) => <FamilyCard key={family.family} row={family} tr={tr} />)}
      </div>

      <div className="mt-6 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-5 text-[var(--sc-muted)]">
        <strong className="text-[var(--sc-text)]">Safety:</strong> rawAnalyticsAutomaticallyConvertedToProbability = false · providerConfiguredMeansModelReady = false · modelOutputWithoutHoldoutGetsPerformanceWeight = false · automaticPromotionAllowed = false · paperOnly = true
      </div>
    </section>
  );
}
