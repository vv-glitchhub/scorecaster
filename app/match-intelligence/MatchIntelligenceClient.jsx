"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MatchIntelligenceClient({ eventId, sport }) {
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Analysis unavailable");
        if (!cancelled) setState({ loading: false, error: "", detail: payload.detail || null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "Analysis unavailable", detail: null });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, sport]);

  if (state.loading) return <section className="sc-surface rounded-[1.65rem] p-6 text-[var(--sc-muted)]">Building match intelligence…</section>;
  if (!state.detail) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="font-black text-[var(--sc-text)]">Match intelligence unavailable</div><div className="mt-2 text-sm text-[var(--sc-muted)]">{state.error}</div><Link href="/events" className="sc-button-secondary mt-4 inline-flex">Back to events</Link></section>;

  const detail = state.detail;
  const intelligence = detail.sportsIntelligence || {};
  const featureEngine = detail.featureEngine || {};
  const ensemble = detail.ensembleEngine || {};
  const uncertainty = ensemble.uncertainty || {};

  return (
    <div className="space-y-6" data-match-intelligence-v1="true">
      <section className="sc-surface overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Intelligence V1</div>
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">{detail.match}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">A visual read of verified context, model coverage and disagreement. Missing information stays missing.</p>
          </div>
          <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Analysis readiness</div>
            <div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{intelligence.readiness?.level || "market-only"}</div>
            <div className="mt-3 text-sm text-[var(--sc-muted)]">Verified checks: {intelligence.readiness?.verifiedCount ?? 0}/{intelligence.readiness?.totalChecks ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ["Feature coverage", Number.isFinite(Number(featureEngine.eligibilityRate)) ? `${Math.round(Number(featureEngine.eligibilityRate) * 100)}%` : "—"],
          ["Research models", ensemble.counts?.researchEligible ?? 0],
          ["Calibrated models", ensemble.counts?.calibrationReady ?? 0],
          ["Model disagreement", uncertainty.band || "unknown"]
        ].map(([label, value]) => (
          <div key={label} className="sc-surface rounded-[1.4rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
            <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match map</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">Where the analysis is strong — and where it is not</h2>
          <div className="mt-5 space-y-3">
            {(featureEngine.eligibleFeatures || []).slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3"><span className="font-black text-[var(--sc-text)]">{item.id}</span><span className="text-xs text-[var(--sc-muted)]">{item.family || item.role || "feature"}</span></div>
                <div className="mt-2 text-xs text-[var(--sc-muted)]">Source: {item.source || "verified pipeline"}</div>
              </div>
            ))}
            {(featureEngine.eligibleFeatures || []).length === 0 ? <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-[var(--sc-muted)]">No verified advanced features are available for this event yet.</div> : null}
          </div>
        </div>

        <div className="space-y-6">
          <section className="sc-surface rounded-[1.65rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">What changes the analysis</div>
            <div className="mt-4 space-y-3 text-sm text-[var(--sc-muted)]">
              {(intelligence.readiness?.missing || []).slice(0, 5).map((item) => <div key={item} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">Missing: {item}</div>)}
              {(ensemble.researchRiskGate?.reasons || []).slice(0, 5).map((item) => <div key={item} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">Model gate: {item}</div>)}
              {!(intelligence.readiness?.missing || []).length && !(ensemble.researchRiskGate?.reasons || []).length ? <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">No additional analysis trigger is currently published.</div> : null}
            </div>
          </section>

          <section className="sc-surface rounded-[1.65rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Boundary</div>
            <p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">This view summarizes existing verified analysis only. It does not invent missing values, change production probabilities, or alter product decisions.</p>
            <Link href={`/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(detail.sportKey || sport)}`} className="sc-button-secondary mt-4 inline-flex">Open full event audit</Link>
          </section>
        </div>
      </section>
    </div>
  );
}
