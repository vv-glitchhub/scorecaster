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

function span(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  if (number < 1) return `${Math.round(number * 60)} min`;
  return `${number.toFixed(number < 10 ? 1 : 0)} h`;
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-1.5 text-xl font-black text-[var(--sc-text)]">{value}</div>
      {detail ? <div className="mt-1 text-xs text-[var(--sc-muted)]">{detail}</div> : null}
    </div>
  );
}

export default function TimelinePanel({ timeline, locale, labels }) {
  if (!timeline) return null;
  const summary = timeline.summary || {};
  const points = Array.isArray(timeline.points) ? timeline.points : [];
  const latest = points.at(-1) || null;
  const minimum = Number.isFinite(Number(summary.minimumOdds)) ? Number(summary.minimumOdds) : 1;
  const maximum = Number.isFinite(Number(summary.maximumOdds)) ? Number(summary.maximumOdds) : minimum + 1;
  const range = Math.max(0.01, maximum - minimum);

  return (
    <div className="space-y-5" data-market-activity-v2="true">
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Market Activity V2</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{labels.points} · {points.length}</h2>
          </div>
          <div className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">{summary.movement || "unknown"}</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={labels.initial} value={decimal(summary.initialOdds)} />
          <Metric label={labels.current} value={decimal(summary.currentOdds)} />
          <Metric label={labels.change} value={percent(summary.oddsChange)} detail={`Δ implied ${percent(summary.impliedProbabilityChange)}`} />
          <Metric label={labels.decisions} value={summary.decisionChanges ?? 0} detail={`Bookmaker Δ ${summary.bookmakerChanges ?? 0}`} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Metric label="Snapshots" value={summary.count ?? points.length} />
          <Metric label="Span" value={span(summary.spanHours)} />
          <Metric label="Latest model" value={latest?.consensusProbability == null ? "–" : percent(latest.consensusProbability)} detail={latest?.edge == null ? null : `Edge ${percent(latest.edge)}`} />
        </div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <div className="rounded-[1.15rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm font-bold leading-6 text-[var(--sc-text-secondary)]">{timeline.interpretation}</div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex h-56 min-w-max items-end gap-2 border-b border-[var(--sc-border)] px-1" role="img" aria-label={`${labels.points}: ${points.length}`}>
            {points.map((point) => {
              const height = 24 + ((Number(point.odds) - minimum) / range) * 150;
              return (
                <div key={point.id || `${point.capturedAt}-${point.odds}`} className="flex min-w-14 flex-col items-center justify-end">
                  <div className="text-[10px] font-black text-[var(--sc-text-secondary)]">{decimal(point.odds)}</div>
                  <div style={{ height }} className="mt-1 w-8 rounded-t-xl bg-[var(--sc-brand)] opacity-75" title={`${decimal(point.odds)} · ${new Date(point.capturedAt).toLocaleString(locale)}`} />
                  <div className="mt-2 text-[9px] text-[var(--sc-faint)]">{new Date(point.capturedAt).toLocaleDateString(locale, { day: "numeric", month: "numeric" })}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">Recent activity</div>
          <div className="mt-3 space-y-2">
            {points.slice().reverse().slice(0, 12).map((point) => (
              <div key={`row-${point.id || point.capturedAt}`} className="grid gap-2 rounded-[1.05rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3 text-sm sm:grid-cols-[150px_70px_90px_90px_1fr]">
                <div className="text-[var(--sc-muted)]">{new Date(point.capturedAt).toLocaleString(locale)}</div>
                <div className="font-black text-[var(--sc-text)]">{decimal(point.odds)}</div>
                <div className="font-bold text-[var(--sc-text-secondary)]">{point.decision}</div>
                <div className="text-[var(--sc-muted)]">{point.consensusProbability == null ? "model –" : percent(point.consensusProbability)}</div>
                <div className="truncate text-[var(--sc-muted)]">{point.bookmaker || point.source}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-muted)]">{timeline.limitation || labels.limitation || DEFAULT_LIMITATION}</div>
    </div>
  );
}
