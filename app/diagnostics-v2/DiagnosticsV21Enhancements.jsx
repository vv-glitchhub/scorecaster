"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function signed(value, scale = 100, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  const result = number * scale;
  return `${result > 0 ? "+" : ""}${result.toFixed(digits)}`;
}

function tone(direction) {
  if (direction === "improving") return "green";
  if (direction === "worsening") return "red";
  return "default";
}

function TrendBars({ points = [], field, label }) {
  const values = points.map((point) => Number(point[field] || 0));
  const maximum = Math.max(1, ...values);
  return (
    <div className="sc-surface rounded-[1.35rem] p-5">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-4 flex h-28 items-end gap-1.5" aria-label={`${label} trend`}>
        {points.slice(-24).map((point) => <span key={`${field}-${point.capturedAt}`} title={`${point.capturedAt}: ${point[field]}`} className="min-w-1 flex-1 rounded-t bg-[var(--sc-brand)] opacity-80" style={{ height: `${Math.max(4, Number(point[field] || 0) / maximum * 100)}%` }} />)}
      </div>
    </div>
  );
}

export default function DiagnosticsV21Enhancements({ compact = false }) {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/diagnostics-v2?limit=168", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Diagnostics unavailable");
        if (active) setPayload(data);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Diagnostics unavailable"); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="rounded-[1.25rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{error}</div>;
  if (!payload) return <div className="sc-surface h-28 animate-pulse rounded-[1.35rem]" />;

  const trends = payload.trends;
  const diagnosis = payload.providerDiagnosis;
  return (
    <div className="space-y-8">
      <section id="diagnostic-trends">
        <SectionHeader
          eyebrow="Decision Diagnostics V2.1"
          title={tr({ fi: "Näe suunta, ei vain tämänhetkinen snapshot", en: "See the direction, not only the current snapshot", es: "Observa la dirección, no solo el snapshot actual" })}
          description={tr({ fi: "Vertailee viimeistä trendi-ikkunaa edelliseen ja tunnistaa pitkittyvän no-PLAY- tai all-SKIP-tilan.", en: "Compares the latest trend window with the previous one and detects persistent no-PLAY or all-SKIP states.", es: "Compara ventanas y detecta estados persistentes sin PLAY o all-SKIP." })}
          action={<div className="flex flex-wrap gap-2"><a className="sc-button-secondary" href={payload.report?.json || "/api/diagnostics-v2/report?format=json"}>{tr({ fi: "Lataa JSON", en: "Download JSON", es: "Descargar JSON" })}</a><a className="sc-button-secondary" href={payload.report?.csv || "/api/diagnostics-v2/report?format=csv"}>{tr({ fi: "Lataa CSV", en: "Download CSV", es: "Descargar CSV" })}</a></div>}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile label={tr({ fi: "Trenditila", en: "Trend status", es: "Estado de tendencia" })} value={trends.status.toUpperCase()} tone={trends.status === "improving" ? "green" : trends.status === "worsening" ? "red" : "default"} />
          <MetricTile label="PLAY Δ" value={`${signed(trends.deltas.playRate)} pp`} tone={tone(trends.directions.playRate)} />
          <MetricTile label="SKIP Δ" value={`${signed(trends.deltas.skipRate)} pp`} tone={tone(trends.directions.skipRate)} />
          <MetricTile label="STALE Δ" value={`${signed(trends.deltas.staleRate)} pp`} tone={tone(trends.directions.staleRate)} />
          <MetricTile label={tr({ fi: "Provider Δ", en: "Provider Δ", es: "Proveedor Δ" })} value={signed(trends.deltas.providerScore, 1, 1)} tone={tone(trends.directions.providerScore)} />
        </div>
        {!compact && <div className="mt-4 grid gap-4 lg:grid-cols-2"><TrendBars points={trends.points} field="skipRate" label="SKIP rate" /><TrendBars points={trends.points} field="providerScore" label="Provider score" /></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="sc-surface rounded-[1.25rem] p-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">NO PLAY STREAK</div><div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{trends.noPlayStreak}</div></div><div className="sc-surface rounded-[1.25rem] p-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">ALL SKIP STREAK</div><div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{trends.allSkipStreak}</div></div></div>
      </section>

      <section id="provider-root-cause">
        <SectionHeader eyebrow="Provider Root Cause V1" title={tr({ fi: "Todennäköisin juurisyy ja seuraava tarkistus", en: "Most likely root cause and next check", es: "Causa probable y siguiente comprobación" })} description={tr({ fi: "Luokittelee ongelman provideriksi, päätösporteiksi tai terveeksi tilaksi muuttamatta mitään asetuksia.", en: "Classifies the issue as provider-related, decision-gate-related or healthy without changing settings.", es: "Clasifica el problema sin cambiar ajustes." })} />
        <div className="rounded-[1.45rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{diagnosis.classification}</div><h3 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{diagnosis.primaryCause?.title || tr({ fi: "Provider-ongelmaa ei havaittu", en: "No provider problem detected", es: "No se detectó problema" })}</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{diagnosis.recommendation}</p></div><MetricTile compact label="Provider" value={`${diagnosis.evidence.providerScore}/100`} tone={diagnosis.evidence.providerStatus === "healthy" ? "green" : "yellow"} /></div>
          {diagnosis.causes.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2">{diagnosis.causes.map((cause) => <div key={cause.code} className="rounded-[1.1rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4"><div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{cause.category} · {cause.severity}</div><div className="mt-2 font-black text-[var(--sc-text)]">{cause.title}</div><div className="mt-1 text-sm leading-6 text-[var(--sc-muted)]">{cause.action}</div></div>)}</div>}
          {diagnosis.degradedLeagues.length > 0 && <div className="mt-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Degraded leagues</div><div className="mt-3 flex flex-wrap gap-2">{diagnosis.degradedLeagues.map((league) => <span key={league.league} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">{league.league} · stale {percent(league.staleRate)}</span>)}</div></div>}
        </div>
      </section>
    </div>
  );
}
