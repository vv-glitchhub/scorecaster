"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function Badge({ children, tone = "neutral" }) {
  const classes = {
    good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    bad: "border-rose-400/40 bg-rose-400/10 text-rose-100",
    info: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
    neutral: "border-white/15 bg-white/5 text-slate-200"
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function Stat({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value ?? "—"}</div>
      {detail ? <div className="mt-1 text-xs text-slate-500">{detail}</div> : null}
    </div>
  );
}

function Sparkline({ points = [] }) {
  const values = points.map((point) => Number(point.records || 0));
  const max = Math.max(1, ...values);
  const coordinates = values.map((value, index) => {
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 34 - (value / max) * 30;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 38" className="h-20 w-full" role="img" aria-label="Collectorin havaintomäärän trendi">
      <line x1="0" y1="34" x2="100" y2="34" stroke="currentColor" strokeOpacity="0.18" />
      {coordinates ? <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2.3" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)} %`;
}

function toneForGrade(grade) {
  if (grade === "A" || grade === "B") return "good";
  if (grade === "C" || grade === "D") return "warn";
  return "bad";
}

function incidentTone(severity) {
  if (severity === "critical") return "bad";
  if (severity === "warning") return "warn";
  return "info";
}

export default function DataCollectorClient() {
  const [sources, setSources] = useState(null);
  const [health, setHealth] = useState(null);
  const [payload, setPayload] = useState({ records: [], insights: null });
  const [hours, setHours] = useState("168");
  const [sport, setSport] = useState("");
  const [metric, setMetric] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ hours, limit: "1000", bucketMinutes: hours === "24" ? "30" : "60", eventLimit: "100" });
      if (sport) query.set("sport", sport);
      if (metric) query.set("metric", metric);
      if (sourceId) query.set("sourceId", sourceId);
      const [sourceResponse, healthResponse, dataResponse] = await Promise.all([
        fetch("/api/collector/sources", { cache: "no-store" }),
        fetch("/api/collector/health", { cache: "no-store" }),
        fetch(`/api/collector?${query.toString()}`, { cache: "no-store" })
      ]);
      const [sourcePayload, healthPayload, dataPayload] = await Promise.all([
        sourceResponse.json(),
        healthResponse.json(),
        dataResponse.json()
      ]);
      setSources(sourcePayload);
      setHealth(healthPayload);
      setPayload({
        records: Array.isArray(dataPayload.records) ? dataPayload.records : [],
        insights: dataPayload.insights || null
      });
      if (!sourcePayload.ok) setError(sourcePayload.error || "Source registry unavailable");
      else if (!dataPayload.ok) setError(dataPayload.error || "Collector data unavailable");
    } catch {
      setError("Collector data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [hours, sport, metric, sourceId]);

  useEffect(() => { load(); }, [load]);

  const records = payload.records;
  const insights = payload.insights;
  const coverage = insights?.coverage || { totals: {}, sports: [] };
  const sourceQuality = insights?.sourceQuality || [];
  const incidents = insights?.incidents || [];
  const events = insights?.events || [];
  const timeSeries = insights?.timeSeries || [];
  const healthTone = health?.status === "healthy" ? "good" : health?.status === "not-activated" ? "warn" : "bad";
  const sports = useMemo(() => [...new Set(records.map((row) => row.sport).filter(Boolean))].sort(), [records]);
  const metrics = useMemo(() => [...new Set(records.map((row) => row.metric).filter(Boolean))].sort(), [records]);
  const sourceIds = useMemo(() => [...new Set(records.map((row) => row.sourceId).filter(Boolean))].sort(), [records]);
  const selectedEvent = useMemo(() => events.find((event) => event.eventId === selectedEventId) || events[0] || null, [events, selectedEventId]);
  const selectedRecords = useMemo(() => selectedEvent ? records.filter((row) => row.eventId === selectedEvent.eventId) : [], [records, selectedEvent]);
  const exportQuery = useMemo(() => {
    const query = new URLSearchParams({ hours, limit: "10000" });
    if (sport) query.set("sport", sport);
    if (metric) query.set("metric", metric);
    if (sourceId) query.set("sourceId", sourceId);
    return query.toString();
  }, [hours, sport, metric, sourceId]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Scorecaster Collector V2</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">Datalaatu, kattavuus ja tapahtumahistoria</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              V2 mittaa lähteiden tuoreuden, luottamuksen, confidence-tason ja kenttien täydellisyyden. Incidentit syntyvät automaattisesti, mutta data ei edelleenkään muuta tuotantotodennäköisyyksiä tai paperipäätöksiä.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={healthTone}>{health?.status || (loading ? "loading" : "unknown")}</Badge>
            <Badge tone="good">paper-only</Badge>
            <Badge tone="neutral">publishable-only API</Badge>
          </div>
        </div>
        <div className="mt-7 text-cyan-300"><Sparkline points={timeSeries} /></div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{error}</div> : null}

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aikaväli
            <select value={hours} onChange={(event) => setHours(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white">
              <option value="24">24 tuntia</option><option value="168">7 päivää</option><option value="720">30 päivää</option><option value="2160">90 päivää</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Laji
            <select value={sport} onChange={(event) => setSport(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white">
              <option value="">Kaikki</option>{sports.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mittari
            <select value={metric} onChange={(event) => setMetric(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white">
              <option value="">Kaikki</option>{metrics.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lähde
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white">
              <option value="">Kaikki</option>{sourceIds.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={load} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">Päivitä analyysi</button>
          <a href={`/api/collector/export?${exportQuery}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">Lataa CSV</a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Havainnot" value={coverage.totals?.records} />
        <Stat label="Tapahtumat" value={coverage.totals?.events} />
        <Stat label="Lajit" value={coverage.totals?.sports} />
        <Stat label="Mittarit" value={coverage.totals?.metrics} />
        <Stat label="Lähteet" value={coverage.totals?.sources} />
        <Stat label="24 h ajot" value={health?.last24Hours?.runs} detail={`${health?.last24Hours?.records ?? 0} riviä`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-white">Automaattiset incidentit</h2>
          <p className="mt-1 text-sm text-slate-400">Tuoreus-, trust-, confidence- ja yhden lähteen riippuvuushälytykset.</p>
          <div className="mt-5 space-y-3">
            {incidents.map((incident) => <article key={incident.code} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={incidentTone(incident.severity)}>{incident.severity}</Badge><h3 className="font-semibold text-white">{incident.title}</h3></div><p className="mt-2 text-sm leading-6 text-slate-300">{incident.detail}</p></article>)}
            {!incidents.length ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">Ei aktiivisia Collector-incidenttejä.</div> : null}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-white">Lähteiden laatupisteet</h2>
          <p className="mt-1 text-sm text-slate-400">35 % tuoreus, 25 % trust, 20 % confidence, 20 % täydellisyys.</p>
          <div className="mt-5 space-y-3">
            {sourceQuality.map((source) => <article key={source.sourceId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{source.sourceId}</h3><p className="mt-1 text-xs text-slate-500">{source.records} riviä · {source.events} tapahtumaa · {source.metrics} mittaria</p></div><Badge tone={toneForGrade(source.grade)}>{source.grade} · {source.score}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-300"><div>Trust<br /><strong className="text-white">{percent(source.trust)}</strong></div><div>Confidence<br /><strong className="text-white">{percent(source.confidence)}</strong></div><div>Tuoreus<br /><strong className="text-white">{source.ageMinutes ?? "—"} min</strong></div></div></article>)}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-white">Lajikohtainen kattavuus</h2>
        <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Laji</th><th className="px-3 py-3">Rivit</th><th className="px-3 py-3">Tapahtumat</th><th className="px-3 py-3">Mittarit</th><th className="px-3 py-3">Lähteet</th><th className="px-3 py-3">Uusin</th></tr></thead><tbody className="divide-y divide-white/5">{(coverage.sports || []).map((item) => <tr key={item.sport} className="text-slate-300"><td className="px-3 py-3 font-semibold text-white">{item.sport}</td><td className="px-3 py-3">{item.records}</td><td className="px-3 py-3">{item.events}</td><td className="px-3 py-3">{item.metrics}</td><td className="px-3 py-3">{item.sources}</td><td className="whitespace-nowrap px-3 py-3">{item.latestAt ? new Date(item.latestAt).toLocaleString("fi-FI") : "—"}</td></tr>)}</tbody></table></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-white">Tapahtumat</h2>
          <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">{events.map((event) => <button key={event.eventId} onClick={() => setSelectedEventId(event.eventId)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedEvent?.eventId === event.eventId ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><div className="font-semibold text-white">{event.eventId}</div><div className="mt-1 text-xs text-slate-400">{event.sport} · {event.records} riviä · {event.metrics} mittaria · {event.sources} lähdettä</div></button>)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Tapahtuman drilldown</h2><p className="mt-1 max-w-xl truncate text-sm text-slate-400">{selectedEvent?.eventId || "Valitse tapahtuma"}</p></div>{selectedEvent ? <a href={`/api/collector/event/${encodeURIComponent(selectedEvent.eventId)}?hours=${hours}`} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">Avaa JSON</a> : null}</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Rivit" value={selectedEvent?.records} /><Stat label="Mittarit" value={selectedEvent?.metrics} /><Stat label="Lähteet" value={selectedEvent?.sources} /></div>
          <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Aika</th><th className="px-3 py-3">Mittari</th><th className="px-3 py-3">Arvo</th><th className="px-3 py-3">Lähde</th><th className="px-3 py-3">Confidence</th></tr></thead><tbody className="divide-y divide-white/5">{selectedRecords.slice(0, 100).map((row, index) => <tr key={`${row.metric}-${row.observedAt}-${index}`} className="text-slate-300"><td className="whitespace-nowrap px-3 py-3">{row.observedAt ? new Date(row.observedAt).toLocaleString("fi-FI") : "—"}</td><td className="px-3 py-3 font-medium text-white">{row.metric}</td><td className="px-3 py-3">{row.value ?? "—"} {row.unit || ""}</td><td className="px-3 py-3">{row.sourceId}</td><td className="px-3 py-3">{percent(row.confidence)}</td></tr>)}</tbody></table></div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-white">Lähde- ja lisenssirekisteri</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">{(sources?.sources || []).map((source) => { const production = source.accessMode === "production" && source.commercialUseAllowed && source.enabled; return <article key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{source.name}</h3><p className="mt-1 text-xs text-slate-500">{source.id} · {source.type}</p></div><Badge tone={production ? "good" : source.accessMode === "research" ? "warn" : "neutral"}>{production ? "production" : source.accessMode}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><Badge tone={source.commercialUseAllowed ? "good" : "bad"}>commercial {source.commercialUseAllowed ? "yes" : "no"}</Badge><Badge tone={source.modelTrainingAllowed ? "good" : "warn"}>training {source.modelTrainingAllowed ? "yes" : "no"}</Badge><Badge tone="neutral">{source.license}</Badge></div><p className="mt-4 text-sm leading-6 text-slate-300">{source.notes}</p></article>; })}</div>
      </section>

      <section className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
        Collector V2 ei kierrä maksumuureja, kirjautumisia, robots-suojauksia tai rajapintojen käyttörajoja. Laatupisteet arvioivat datavirtaa, eivät anna lupaa käyttää lisenssiltään epäselvää aineistoa eivätkä muuta Scorecasterin päätöksiä.
      </section>
    </main>
  );
}
