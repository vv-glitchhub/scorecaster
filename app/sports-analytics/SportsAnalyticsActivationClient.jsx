"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, SectionHeader } from "../components/ProductUI";

function pct(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "–";
}

function priorityTone(score, maximum) {
  const ratio = maximum ? Number(score || 0) / maximum : 0;
  if (ratio >= 0.8) return "border-rose-400/30 bg-rose-400/10";
  if (ratio >= 0.55) return "border-amber-400/30 bg-amber-400/10";
  return "border-blue-400/25 bg-blue-400/10";
}

export default function SportsAnalyticsActivationClient() {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", plan: null });
  const [selectedSport, setSelectedSport] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/sports-analytics?hours=168&limit=500", { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Activation plan unavailable");
        setState({ loading: false, error: "", plan: payload.activationPlan || null });
        setSelectedSport(payload.activationPlan?.coverageMatrix?.[0]?.sport || "");
      })
      .catch((error) => { if (active) setState({ loading: false, error: error instanceof Error ? error.message : "Activation plan unavailable", plan: null }); });
    return () => { active = false; };
  }, []);

  const matrix = state.plan?.coverageMatrix || [];
  const priorities = state.plan?.priorities || [];
  const selectedCoverage = matrix.find((row) => row.sport === selectedSport) || matrix[0] || null;
  const selectedPriorities = useMemo(() => priorities.filter((row) => !selectedSport || row.sport === selectedSport).slice(0, 24), [priorities, selectedSport]);
  const maximumPriority = Math.max(...selectedPriorities.map((row) => Number(row.priorityScore || 0)), 1);

  if (state.loading) return <section className="sc-surface rounded-[1.65rem] p-6 text-sm text-[var(--sc-muted)]">Building automatic activation plan…</section>;
  if (state.error) return <section className="rounded-[1.65rem] border border-rose-400/30 bg-rose-400/10 p-6 text-sm text-rose-100">{state.error}</section>;
  if (!matrix.length) return null;

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Automatic activation plan"
        title={tr({ fi: "Mitä dataa Scorecasteriin kannattaa liittää seuraavaksi", en: "What data Scorecaster should activate next", es: "Qué datos activar a continuación" })}
        description={tr({ fi: "Prioriteetti huomioi lajin nykyiset tapahtumat, providerien määrän, dataperheen arvon ja puuttuvan kattavuuden. Lista ei osta dataa eikä muuta todennäköisyyksiä automaattisesti.", en: "Priority combines current events, provider count, family value and missing coverage. It never purchases data or changes probabilities automatically.", es: "La prioridad combina eventos, proveedores y cobertura faltante sin cambiar probabilidades." })}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {matrix.map((sport) => <button type="button" key={sport.sport} onClick={() => setSelectedSport(sport.sport)} className={`rounded-[1.2rem] border p-4 text-left transition ${selectedSport === sport.sport ? "border-[var(--sc-brand)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] hover:border-[var(--sc-brand-border)]"}`}><div className="font-black capitalize text-[var(--sc-text)]">{sport.sport.replaceAll("_", " ")}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--sc-muted)]"><span>{sport.events} events</span><span>{sport.providers} providers</span><span>{sport.availableMetrics}/{sport.requiredMetrics}</span><span>{pct(sport.coverage)}</span></div></button>)}
      </div>

      {selectedCoverage && <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{selectedCoverage.sport.replaceAll("_", " ")}</div><div className="mt-4 grid grid-cols-2 gap-3"><MetricTile label="Events" value={selectedCoverage.events} /><MetricTile label="Providers" value={selectedCoverage.providers} tone="green" /><MetricTile label="Available" value={selectedCoverage.availableMetrics} tone="blue" /><MetricTile label="Coverage" value={pct(selectedCoverage.coverage)} tone="purple" /></div></div>
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-sm font-black text-[var(--sc-text)]">Family coverage heatmap</div><div className="mt-5 grid gap-3 sm:grid-cols-2">{selectedCoverage.families.map((family) => <div key={family.family} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><span className="font-black capitalize text-[var(--sc-text)]">{family.family}</span><span className="text-xs font-black text-[var(--sc-muted)]">{family.available}/{family.required}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sc-surface-hover)]"><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width: `${Number(family.coverage || 0) * 100}%` }} /></div><div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{pct(family.coverage)} coverage</div></div>)}</div></div>
      </div>}

      <div className="space-y-3"><div className="text-sm font-black text-[var(--sc-text)]">Metric activation queue</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedPriorities.map((item, index) => <article key={`${item.sport}:${item.family}:${item.metric}`} className={`rounded-[1.25rem] border p-5 ${priorityTone(item.priorityScore, maximumPriority)}`}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">#{index + 1} · {item.family}</div><h3 className="mt-2 font-black">{item.metric}</h3></div><div className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-black">{Number(item.priorityScore).toFixed(2)}</div></div><p className="mt-3 text-sm leading-6 opacity-80">{item.reason}</p><div className="mt-4 rounded-xl bg-black/10 p-3 text-xs"><strong>Required:</strong> {item.requiredSourceType}</div></article>)}</div></div>

      <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-xs leading-6 text-[var(--sc-muted)]">Recommendation only · no automatic provider purchase · no automatic probability change · no invented missing data.</div>
    </section>
  );
}
