"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function Badge({ children, tone = "neutral" }) {
  const classes = {
    good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    bad: "border-rose-400/40 bg-rose-400/10 text-rose-100",
    neutral: "border-white/15 bg-white/5 text-slate-200"
  };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value ?? "—"}</div>
    </div>
  );
}

export default function DataCollectorClient() {
  const [sources, setSources] = useState(null);
  const [health, setHealth] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sourceResponse, healthResponse, dataResponse] = await Promise.all([
        fetch("/api/collector/sources", { cache: "no-store" }),
        fetch("/api/collector/health", { cache: "no-store" }),
        fetch("/api/collector?hours=168&limit=100", { cache: "no-store" })
      ]);
      const [sourcePayload, healthPayload, dataPayload] = await Promise.all([
        sourceResponse.json(),
        healthResponse.json(),
        dataResponse.json()
      ]);
      setSources(sourcePayload);
      setHealth(healthPayload);
      setRecords(Array.isArray(dataPayload.records) ? dataPayload.records : []);
      if (!sourcePayload.ok) setError(sourcePayload.error || "Source registry unavailable");
    } catch {
      setError("Collector data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uniqueEvents = useMemo(() => new Set(records.map((row) => row.eventId)).size, [records]);
  const uniqueSources = useMemo(() => new Set(records.map((row) => row.sourceId)).size, [records]);
  const healthTone = health?.status === "healthy" ? "good" : health?.status === "not-activated" ? "warn" : "bad";

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Scorecaster Collector V1</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">Oma, oikeustietoinen urheiludatakerros</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Collector yhdistää sallitut lähteet, normalisoi ja deduplikoi havainnot sekä estää tutkimus- tai lisenssiltään epäselvän datan julkaisemisen tuotannossa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={healthTone}>{health?.status || (loading ? "loading" : "unknown")}</Badge>
            <Badge tone="good">paper-only</Badge>
            <Badge tone="neutral">fail-closed licensing</Badge>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Lähteet" value={sources?.summary?.total} />
        <Stat label="Tuotantoon hyväksytyt" value={sources?.summary?.productionApproved} />
        <Stat label="24 h ajot" value={health?.last24Hours?.runs} />
        <Stat label="24 h havainnot" value={health?.last24Hours?.records} />
        <Stat label="Tapahtumat näkymässä" value={uniqueEvents} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Lähde- ja lisenssirekisteri</h2>
            <p className="mt-1 text-sm text-slate-400">Tuotantokeräys käynnistyy vain, kun lähde ja kaupalliset oikeudet on hyväksytty.</p>
          </div>
          <button onClick={load} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">Päivitä</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(sources?.sources || []).map((source) => {
            const production = source.accessMode === "production" && source.commercialUseAllowed && source.enabled;
            return (
              <article key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{source.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{source.id} · {source.type}</p>
                  </div>
                  <Badge tone={production ? "good" : source.accessMode === "research" ? "warn" : "neutral"}>{production ? "production" : source.accessMode}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={source.commercialUseAllowed ? "good" : "bad"}>commercial {source.commercialUseAllowed ? "yes" : "no"}</Badge>
                  <Badge tone={source.modelTrainingAllowed ? "good" : "warn"}>training {source.modelTrainingAllowed ? "yes" : "no"}</Badge>
                  <Badge tone="neutral">{source.license}</Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{source.notes}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Julkaistavat havainnot</h2>
            <p className="mt-1 text-sm text-slate-400">Research-only-rivit suodatetaan pois jo palvelinrajapinnassa.</p>
          </div>
          <Badge tone="neutral">{records.length} riviä · {uniqueSources} lähdettä</Badge>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-3">Aika</th><th className="px-3 py-3">Laji</th><th className="px-3 py-3">Tapahtuma</th><th className="px-3 py-3">Mittari</th><th className="px-3 py-3">Arvo</th><th className="px-3 py-3">Lähde</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {records.slice(0, 100).map((row, index) => (
                <tr key={`${row.eventId}-${row.metric}-${row.observedAt}-${index}`} className="text-slate-300">
                  <td className="whitespace-nowrap px-3 py-3">{row.observedAt ? new Date(row.observedAt).toLocaleString("fi-FI") : "—"}</td>
                  <td className="px-3 py-3">{row.sport}</td>
                  <td className="max-w-[240px] truncate px-3 py-3" title={row.eventId}>{row.eventId}</td>
                  <td className="px-3 py-3 font-medium text-white">{row.metric}</td>
                  <td className="px-3 py-3">{row.value ?? "—"} {row.unit || ""}</td>
                  <td className="px-3 py-3">{row.sourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && records.length === 0 ? <p className="py-8 text-center text-slate-400">Ei vielä tallennettuja julkaistavia havaintoja. Migraatio ja ensimmäinen worker-ajo tarvitaan.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
        Collector ei kierrä maksumuureja, kirjautumisia, robots-suojauksia tai rajapintojen käyttörajoja. Tuntematon lähde hylätään, ja kaupallisesti vahvistamaton data pysyy tutkimusympäristössä.
      </section>
    </main>
  );
}
