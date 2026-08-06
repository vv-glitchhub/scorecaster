"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const formatClock = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "–";
  return `${Math.floor(Math.max(0, value) / 60)}:${String(Math.floor(Math.max(0, value) % 60)).padStart(2, "0")}`;
};
const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
const timestamp = (value) => value ? new Date(value).toLocaleString("fi-FI") : "–";

function Metric({ label, value, warning = false }) {
  return <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{label}</div><div className={`mt-1 text-2xl font-black ${warning ? "text-amber-200" : "text-[var(--sc-text)]"}`}>{value}</div></div>;
}

export default function VerifiedLiveEventClient({ eventId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/verified-live-monitor?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Verified live evidence unavailable");
        if (active) setData(payload);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Verified live evidence unavailable"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  const probabilities = useMemo(() => Object.entries(data?.liveProbability?.probabilities || {}), [data]);
  const current = data?.current || null;

  return <div className="space-y-7">
    <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Verified Live Event Audit · paper-only</div>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{current ? `${current.homeTeam || "Home"} – ${current.awayTeam || "Away"}` : "Live event integrity"}</h1>
      <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">Event ID: <span className="font-mono text-[var(--sc-text)]">{eventId}</span>. Live evidence is kept separate from all pre-match model inputs and decisions.</p>
      <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">stakeSuggested=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">preMatchAuditChanged=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">realMoneyExecution=false</span></div>
    </section>

    {loading && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-[var(--sc-muted)]">Loading verified provider evidence…</div>}
    {error && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-amber-100">{error}</div>}

    {data && <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Status" value={data.status} warning={data.suspended} />
        <Metric label="Score" value={current ? `${current.homeScore}–${current.awayScore}` : "–"} />
        <Metric label="Period" value={current?.period ?? "–"} />
        <Metric label="Clock" value={formatClock(current?.clockSeconds)} />
        <Metric label="Fresh providers" value={data.integrity?.freshProviderCount ?? 0} warning={(data.integrity?.freshProviderCount ?? 0) === 0} />
      </section>

      {data.suspended && <section className="rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 p-5"><div className="text-xs font-black uppercase tracking-[0.15em] text-rose-200">Live interpretation suspended</div><div className="mt-2 text-xl font-black text-white">{data.suspensionReason || "provider evidence unavailable"}</div><p className="mt-2 text-sm leading-6 text-rose-100">A delayed, missing or conflicting feed cannot produce a confident signal.</p></section>}

      {probabilities.length > 0 && <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black text-[var(--sc-text)]">Live-only provider consensus</h2><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">not usable in pre-match features</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{probabilities.map(([label, value]) => <Metric key={label} label={label} value={percent(value)} />)}</div></section>}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-2xl font-black text-[var(--sc-text)]">Providers</h2><div className="mt-4 space-y-3">{(data.providers || []).map((provider) => <article key={provider.providerId} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-[var(--sc-text)]">{provider.providerId}</strong><span className="text-xs text-[var(--sc-muted)]">{provider.freshness}</span></div><div className="mt-2 text-sm text-[var(--sc-text-secondary)]">{provider.status} · {provider.homeScore}–{provider.awayScore} · period {provider.period ?? "–"} · {formatClock(provider.clockSeconds)}</div><div className="mt-1 text-xs text-[var(--sc-faint)]">Updated {timestamp(provider.providerUpdatedAt)} · age {provider.freshnessSeconds ?? "–"} s</div></article>)}{!data.providers?.length && <div className="text-sm text-[var(--sc-muted)]">No eligible provider state.</div>}</div></div>
        <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-2xl font-black text-[var(--sc-text)]">Integrity alerts</h2><div className="mt-4 space-y-3">{(data.alerts || []).map((alert) => <article key={`${alert.id}:${alert.generatedAt}`} className={`rounded-xl border p-4 ${alert.severity === "high" ? "border-rose-400/25 bg-rose-400/10" : alert.severity === "medium" ? "border-amber-400/25 bg-amber-400/10" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{alert.severity} · {alert.id}</div><div className="mt-2 font-black text-[var(--sc-text)]">{alert.title}</div><div className="mt-1 text-sm leading-6 text-[var(--sc-text-secondary)]">{alert.message}</div><div className="mt-2 text-xs text-[var(--sc-faint)]">Evidence {timestamp(alert.evidenceObservedAt)} · {(alert.providers || []).join(", ") || "no provider"}</div></article>)}{!data.alerts?.length && <div className="text-sm text-[var(--sc-muted)]">No verified live change alert.</div>}</div></div>
      </section>

      <details className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><summary className="cursor-pointer list-none text-xl font-black text-[var(--sc-text)]">Immutable live timeline and corrections</summary><div className="mt-4 space-y-3">{(data.timeline || []).map((row) => <article key={row.id} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[var(--sc-text)]">{row.providerId} · {row.status}</strong><span className="text-xs text-[var(--sc-muted)]">{timestamp(row.observedAt)}</span></div><div className="mt-2 text-sm text-[var(--sc-text-secondary)]">{row.homeScore}–{row.awayScore} · period {row.period ?? "–"} · {formatClock(row.clockSeconds)} · {row.freshness}</div>{row.correction && <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">Visible correction: {row.correctionReason} · supersedes {row.supersedesId}</div>}</article>)}</div></details>

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-xl font-black text-[var(--sc-text)]">Audit boundaries</h2><pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)] p-4 text-xs leading-6 text-[var(--sc-text-secondary)]">{JSON.stringify(data.boundaries, null, 2)}</pre></section>
    </>}

    <div className="flex flex-wrap gap-3"><Link href="/live-monitor" className="sc-button-secondary">Live Monitor dashboard</Link><Link href="/events" className="sc-button-secondary">Events</Link><a href={`/api/verified-live-monitor?eventId=${encodeURIComponent(eventId)}`} className="sc-button-primary">Audit JSON</a></div>
  </div>;
}
