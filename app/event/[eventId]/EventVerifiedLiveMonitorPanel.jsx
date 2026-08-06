"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const formatClock = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "–";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
};

export default function EventVerifiedLiveMonitorPanel({ eventId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/verified-live-monitor?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Verified live evidence unavailable");
        if (active) setData(payload);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Verified live evidence unavailable"); });
    return () => { active = false; };
  }, [eventId]);

  const current = data?.current;
  return (
    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Verified Live Monitor</div>
          <h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">Live state integrity</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">Live score, clock, provider freshness and corrections are separate from the pre-match model. No stake or entry instruction is generated.</p>
        </div>
        <Link href={`/live-monitor?eventId=${encodeURIComponent(eventId)}`} className="sc-button-secondary">Open live audit</Link>
      </div>

      {error && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>}
      {!error && !data && <div className="mt-4 text-sm text-[var(--sc-muted)]">Loading verified live evidence…</div>}
      {data && !current && <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">No eligible live evidence has been captured for this event. Missing data stays missing.</div>}
      {current && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Status" value={data.status} warning={data.suspended} />
        <Metric label="Score" value={`${current.homeScore}–${current.awayScore}`} />
        <Metric label="Period" value={current.period ?? "–"} />
        <Metric label="Clock" value={formatClock(current.clockSeconds)} />
        <Metric label="Fresh providers" value={data.integrity?.freshProviderCount ?? 0} warning={(data.integrity?.freshProviderCount ?? 0) < 1} />
      </div>}
      {data?.alerts?.length > 0 && <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Latest integrity alert</div><div className="mt-1 font-black text-[var(--sc-text)]">{data.alerts[0].title}</div><div className="mt-1 text-sm text-[var(--sc-text-secondary)]">{data.alerts[0].message}</div></div>}
      <div className="mt-4 text-xs text-[var(--sc-muted)]">preMatchModelChanged=false · stakeSuggested=false · realMoneyExecution=false · paperOnly=true</div>
    </section>
  );
}

function Metric({ label, value, warning = false }) {
  return <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div><div className={`mt-1 text-xl font-black ${warning ? "text-amber-200" : "text-[var(--sc-text)]"}`}>{String(value)}</div></div>;
}
