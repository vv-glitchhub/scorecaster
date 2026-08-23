"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function Metric({ label, value, hint, tone = "default" }) {
  const colors = tone === "good" ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-100" : tone === "warning" ? "border-amber-400/20 bg-amber-400/8 text-amber-100" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-text)]";
  return <div className={`rounded-2xl border p-4 ${colors}`}><div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-70">{label}</div><div className="mt-2 text-2xl font-black">{value}</div>{hint ? <div className="mt-1 text-xs leading-5 opacity-70">{hint}</div> : null}</div>;
}

function Progress({ label, item }) {
  const percent = Math.round(Number(item?.ratio || 0) * 100);
  return <div><div className="flex items-center justify-between gap-3 text-sm"><strong className="text-[var(--sc-text)]">{label}</strong><span className="text-[var(--sc-muted)]">{item?.current || 0}/{item?.target || 0}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--sc-surface-soft)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={item?.target || 0} aria-valuenow={item?.current || 0}><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width: `${percent}%` }} /></div><div className="mt-1 text-xs text-[var(--sc-faint)]">{item?.remaining || 0} remaining · {percent}%</div></div>;
}

export default function DataReadinessClient() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/data-readiness", { cache: "no-store" });
      const next = await response.json();
      if (!response.ok && !next.data) throw new Error(next?.error || "Data readiness unavailable");
      setPayload(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data readiness unavailable");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const data = payload?.data;
  const capture = data?.marketCapture;
  const live = data?.verifiedLiveMonitor;
  const shadow = data?.shadowLearning;
  const acquisition = data?.providerAcquisition;

  return <div className="space-y-7">
    <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Data Readiness V1 · paper-only</div>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{tr({ fi: "Mitä dataa toimii ja mitä puuttuu", en: "What data works and what is missing", es: "Qué datos funcionan y cuáles faltan" })}</h1>
      <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "Yksi näkymä Market Capturelle, provider-sopimuksille, varmennetulle live-datalle ja Shadow Learningin havaintokertymälle. Puuttuva data näkyy esteenä eikä sitä korvata esimerkeillä.", en: "One view for Market Capture, provider contracts, verified live data and Shadow Learning evidence. Missing data stays visible and is never replaced with examples.", es: "Una vista para capturas, proveedores, datos en vivo y aprendizaje." })}</p>
      <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-secondary mt-5 disabled:opacity-50">{loading ? "Loading…" : tr({ fi: "Päivitä tila", en: "Refresh status", es: "Actualizar" })}</button>
    </section>

    {error ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div> : null}
    {data ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Market Capture" value={capture.status} hint={`${capture.snapshotCount} snapshots · ${capture.ageMinutes ?? "–"} min`} tone={capture.status === "healthy" ? "good" : "warning"} />
        <Metric label={tr({ fi: "Provider-valmiit", en: "Provider capable", es: "Con proveedor" })} value={acquisition.providerCapableCount} hint={`${acquisition.targetCount} target markets`} tone="good" />
        <Metric label="Provider gaps" value={acquisition.providerGapCount} hint={`${acquisition.bundles.length} procurement bundles`} tone="warning" />
        <Metric label="Verified Live" value={live.status} hint={live.provider.contractReady ? `${live.snapshots24h} snapshots / 24h` : `${live.provider.failedGates?.length || 0} contract gates open`} tone={live.status === "healthy" ? "good" : "warning"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Provider acquisition</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">14 gaps → {acquisition.bundles.length} contract bundles</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{acquisition.bundles.map((bundle) => <article key={bundle.key} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><strong className="text-[var(--sc-text)]">{bundle.label}</strong><span className="rounded-full border border-amber-400/25 px-2 py-1 text-[10px] font-black text-amber-100">P{bundle.priority}</span></div><div className="mt-2 text-sm text-[var(--sc-muted)]">{bundle.targets.length} markets · {bundle.liveDataRequired ? "live + pre-match" : "pre-match"}</div><div className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">{bundle.requiredCapabilities.join(" · ")}</div></article>)}</div></div>
        <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Shadow Learning</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{shadow.status}</h2><div className="mt-6 space-y-6"><Progress label={tr({ fi: "Ratkaistut paperihavainnot", en: "Settled paper observations", es: "Observaciones resueltas" })} item={shadow.settled} /><Progress label="Closing-line / CLV evidence" item={shadow.clv} /></div><div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/8 p-4 text-xs leading-5 text-sky-100">Automatic promotion remains disabled. Review readiness requires chronological evidence and a separate human release decision.</div></div>
      </section>

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Written rights gate</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Provideria ei aktivoida pelkällä API-avaimella", en: "An API key alone cannot activate a provider", es: "Una clave API no basta para activar un proveedor" })}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{acquisition.rightsGates.map((gate) => <div key={gate.key} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm font-bold text-[var(--sc-text-secondary)]">{gate.label}</div>)}</div></section>
      <div className="flex flex-wrap gap-3"><Link href="/market-universe" className="sc-button-primary">Market Universe</Link><Link href="/live-monitor" className="sc-button-secondary">Verified Live Monitor</Link><Link href="/calibration" className="sc-button-secondary">CLV & Calibration</Link><a href="/api/data-readiness" className="sc-button-secondary">Audit JSON</a></div>
    </> : null}
  </div>;
}
