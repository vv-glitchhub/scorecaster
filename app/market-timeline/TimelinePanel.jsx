"use client";

const DEFAULT_LIMITATION = "Price movement is descriptive market history, not outcome evidence.";

function decimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "–";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-slate-950/60 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black text-white">{value}</div></div>;
}

export default function TimelinePanel({ timeline, locale, labels }) {
  if (!timeline) return null;
  const summary = timeline.summary || {};
  const points = timeline.points || [];
  const minimum = Number.isFinite(Number(summary.minimumOdds)) ? Number(summary.minimumOdds) : 1;
  const maximum = Number.isFinite(Number(summary.maximumOdds)) ? Number(summary.maximumOdds) : minimum + 1;
  const range = Math.max(0.01, maximum - minimum);

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={labels.initial} value={decimal(summary.initialOdds)} />
      <Metric label={labels.current} value={decimal(summary.currentOdds)} />
      <Metric label={labels.change} value={percent(summary.oddsChange)} />
      <Metric label={labels.decisions} value={summary.decisionChanges || 0} />
    </section>
    <div className="rounded-2xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm font-bold text-purple-100">{timeline.interpretation}</div>
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-black">{labels.points} · {points.length}</h2>
      <div className="mt-5 flex h-48 items-end gap-2 overflow-x-auto border-b border-white/10 pb-2">
        {points.map((point) => {
          const height = 20 + ((Number(point.odds) - minimum) / range) * 140;
          return <div key={point.id || `${point.capturedAt}-${point.odds}`} className="flex min-w-12 flex-col items-center justify-end"><div className="text-[10px] font-bold text-slate-400">{decimal(point.odds)}</div><div style={{ height }} className="mt-1 w-7 rounded-t-lg bg-purple-400/70" /><div className="mt-2 text-[9px] text-slate-500">{new Date(point.capturedAt).toLocaleDateString(locale, { day: "numeric", month: "numeric" })}</div></div>;
        })}
      </div>
      <div className="mt-5 space-y-2">{points.slice().reverse().slice(0, 12).map((point) => <div key={`row-${point.id || point.capturedAt}`} className="grid gap-2 rounded-xl bg-slate-950/60 p-3 text-sm sm:grid-cols-[150px_80px_100px_1fr]"><div className="text-slate-400">{new Date(point.capturedAt).toLocaleString(locale)}</div><div className="font-black">{decimal(point.odds)}</div><div>{point.decision}</div><div className="text-slate-400">{point.bookmaker || point.source}</div></div>)}</div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">{timeline.limitation || labels.limitation || DEFAULT_LIMITATION}</div>
  </div>;
}
