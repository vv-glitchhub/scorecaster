"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MetricTile, PageHero, SectionHeader, TrustBar } from "../../../components/ProductUI";

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(0)}%` : "–";
}

function valueText(value, unit) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(3)}${unit ? ` ${unit}` : ""}` : "–";
}

function dateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("fi-FI", { dateStyle: "short", timeStyle: "short" }).format(date) : "–";
}

export default function SportsAnalyticsEventClient({ eventId }) {
  const [state, setState] = useState({ loading: true, error: "", payload: null });

  useEffect(() => {
    let active = true;
    fetch(`/api/sports-analytics?eventId=${encodeURIComponent(eventId)}&hours=720&limit=500`, { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Event analytics unavailable");
        setState({ loading: false, error: "", payload });
      })
      .catch((error) => { if (active) setState({ loading: false, error: error instanceof Error ? error.message : "Event analytics unavailable", payload: null }); });
    return () => { active = false; };
  }, [eventId]);

  const event = state.payload?.insights?.events?.find((row) => row.eventId === eventId) || state.payload?.insights?.events?.[0] || null;
  const observations = useMemo(() => (state.payload?.observations || []).filter((row) => row.eventId === eventId), [state.payload, eventId]);
  const participants = useMemo(() => [...new Set(observations.map((row) => row.participantId).filter(Boolean))], [observations]);
  const providers = useMemo(() => [...new Set(observations.map((row) => row.provider).filter(Boolean))], [observations]);
  const families = useMemo(() => [...new Set(observations.map((row) => row.family).filter(Boolean))], [observations]);

  return (
    <div className="space-y-8">
      <PageHero
        tone="purple"
        eyebrow="Event analytics"
        title={event?.match || "Tapahtuman analytiikka"}
        description={event ? `${event.league || event.sport} · ${dateTime(event.commenceTime)}` : "Kaikki tapahtumalle kerätyt provider-, osallistuja-, mittari- ja laatutiedot."}
        actions={<><Link className="sc-button-secondary" href="/sports-analytics">Takaisin datakeskukseen</Link><Link className="sc-button-ghost" href={`/api/sports-analytics?eventId=${encodeURIComponent(eventId)}&hours=720&limit=500`}>API JSON</Link><Link className="sc-button-ghost" href={`/api/sports-analytics/export?eventId=${encodeURIComponent(eventId)}&hours=720&limit=500`}>CSV</Link></>}
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label="Havaintoja" value={observations.length} /><MetricTile compact label="Mittareita" value={new Set(observations.map((row) => row.metric)).size} tone="purple" /><MetricTile compact label="Providereita" value={providers.length} tone="green" /><MetricTile compact label="Kattavuus" value={pct(event?.coverageScore)} tone="blue" /></div>}
      />

      <TrustBar items={[
        { label: "Tila", value: state.loading ? "loading" : state.error ? "error" : "ready", tone: state.error ? "warning" : "good" },
        { label: "Osallistujat", value: String(participants.length), tone: "info" },
        { label: "Dataperheet", value: String(families.length), tone: "info" },
        { label: "Todennäköisyys", value: "no-vig market consensus", tone: "info" },
        { label: "Käyttö", value: "paper-only", tone: "warning" }
      ]} />

      {state.error && <div className="rounded-[1.2rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-100">{state.error}</div>}

      {event && <section className="grid gap-5 lg:grid-cols-2">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow="Coverage" title="Tapahtuman datakattavuus" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{(event.familyCoverage || []).map((family) => <div key={family.family} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex justify-between gap-3"><strong className="capitalize">{family.family}</strong><span className="text-sm text-[var(--sc-muted)]">{family.availableMetricCount || 0}/{family.requiredMetricCount || 0}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sc-surface-hover)]"><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width: `${Number(family.coverage || 0) * 100}%` }} /></div></div>)}</div></div>
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><SectionHeader eyebrow="Providers" title="Tapahtuman datalähteet" /><div className="mt-5 flex flex-wrap gap-2">{providers.map((provider) => <span key={provider} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">{provider}</span>)}</div><div className="mt-6 text-sm text-[var(--sc-muted)]">Viimeisin snapshot: {dateTime(event.capturedAt)}</div></div>
      </section>}

      <section className="sc-surface overflow-hidden rounded-[1.65rem]"><div className="p-5 sm:p-6"><SectionHeader eyebrow="Observations" title="Kaikki tapahtuman mittarit" description="Rivit sisältävät osallistujan, dataperheen, arvon, providerin, luottamuksen ja confidence-arvon." /></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-y border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]"><tr><th className="px-5 py-3">Aika</th><th className="px-5 py-3">Osallistuja</th><th className="px-5 py-3">Perhe</th><th className="px-5 py-3">Mittari</th><th className="px-5 py-3">Arvo</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Trust</th><th className="px-5 py-3">Confidence</th></tr></thead><tbody>{observations.map((row, index) => <tr key={`${row.metric}:${row.observedAt}:${index}`} className="border-b border-[var(--sc-border)] text-[var(--sc-muted)]"><td className="px-5 py-3">{dateTime(row.observedAt)}</td><td className="px-5 py-3 text-[var(--sc-text)]">{row.participantId || "–"}</td><td className="px-5 py-3 capitalize">{row.family}</td><td className="px-5 py-3 font-bold text-[var(--sc-text)]">{row.metric}</td><td className="px-5 py-3 font-mono">{valueText(row.value, row.unit)}</td><td className="px-5 py-3">{row.provider}</td><td className="px-5 py-3">{pct(row.sourceTrust)}</td><td className="px-5 py-3">{pct(row.confidence)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
