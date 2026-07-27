"use client";

import { useEffect, useMemo, useState } from "react";

function Card({ title, children }) {
  return <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7"><h2 className="text-xl font-black text-white">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-black text-white">{value ?? "—"}</div></div>;
}

function pct(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "—";
}

export default function IntelligenceV3Client() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [iterations, setIterations] = useState(20000);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/collector?hours=720&limit=500", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const rows = Array.isArray(data?.records) ? data.records : [];
        const ids = [...new Set(rows.map((row) => row.eventId).filter(Boolean))];
        setEvents(ids);
        if (ids[0]) setEventId(ids[0]);
      }).catch(() => null);
  }, []);

  async function analyze() {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/intelligence-v3?eventId=${encodeURIComponent(eventId)}&iterations=${iterations}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Analysis failed");
      setPayload(data);
    } catch (err) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (eventId) analyze(); }, [eventId]);

  const bundle = payload?.bundle;
  const scout = bundle?.scout;
  const simulation = bundle?.simulator;
  const dna = bundle?.dna;
  const lab = bundle?.bettingLab;
  const coach = bundle?.coach;
  const maxBucket = useMemo(() => Math.max(1, ...(simulation?.distribution || []).map((bucket) => bucket.count || 0)), [simulation]);

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-7 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Scorecaster Intelligence V3</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Scout, simulator, DNA, lab ja coach</h1>
        <p className="mt-4 max-w-4xl leading-7 text-slate-300">Yksi läpinäkyvä analyysikerros käyttää vain Collectorissa julkaistavaksi hyväksyttyä dataa. Puuttuvat havainnot jäävät näkyviksi eikä tuotantotodennäköisyyttä muuteta.</p>
      </section>

      <section className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-5 md:grid-cols-[1fr_180px_auto]">
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white">
          <option value="">Valitse tapahtuma</option>
          {events.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <select value={iterations} onChange={(event) => setIterations(Number(event.target.value))} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white">
          <option value={5000}>5 000 ajoa</option><option value={20000}>20 000 ajoa</option><option value={50000}>50 000 ajoa</option><option value={100000}>100 000 ajoa</option>
        </select>
        <button onClick={analyze} disabled={!eventId || loading} className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? "Analysoidaan…" : "Aja V3"}</button>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Scout score" value={scout?.intelligenceScore} />
        <Stat label="Datan laatu" value={scout?.dataQuality?.score} />
        <Stat label="Markkina" value={pct(scout?.marketProbability)} />
        <Stat label="Simuloitu" value={pct(simulation?.simulatedProbability)} />
        <Stat label="Edge" value={pct(lab?.edge)} />
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <Card title="AI Scout">
          <div className="space-y-3">{(scout?.factors || []).map((factor) => <div key={factor.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3"><span>{factor.label}</span><span className="font-black">{factor.available ? pct(factor.value) : "puuttuu"}</span></div>)}</div>
          <p className="mt-4 text-sm text-slate-400">Riski: <strong className="text-white">{scout?.risk || "—"}</strong> · puuttuvat: {(scout?.missing || []).join(", ") || "ei kriittisiä"}</p>
        </Card>

        <Card title="Skenaariosimulaattori">
          <div className="flex h-48 items-end gap-2">{(simulation?.distribution || []).map((bucket) => <div key={bucket.from} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-cyan-300/70" style={{ height: `${Math.max(3, (bucket.count / maxBucket) * 150)}px` }} /><span className="text-[10px] text-slate-500">{Math.round(bucket.from * 100)}</span></div>)}</div>
          <p className="mt-3 text-sm text-slate-400">{simulation?.iterations?.toLocaleString("fi-FI") || "—"} determinististä paperiskenaariota · volatiliteetti {pct(simulation?.volatility)}</p>
        </Card>

        <Card title="Team & Player DNA">
          <div className="grid grid-cols-2 gap-3"><Stat label="Team DNA" value={dna?.team?.score} /><Stat label="Kattavuus" value={pct(dna?.team?.coverage)} /><Stat label="Hyökkäys" value={pct(dna?.team?.attack)} /><Stat label="Puolustus" value={pct(dna?.team?.defense)} /></div>
          <div className="mt-4 space-y-2">{(dna?.players || []).slice(0, 8).map((player) => <div key={player.entityId} className="flex justify-between rounded-xl bg-white/[0.04] px-4 py-3"><span className="truncate">{player.entityId}</span><strong>{player.score}</strong></div>)}</div>
          {(dna?.limitations || []).map((item) => <p key={item} className="mt-3 text-sm text-amber-200">{item}</p>)}
        </Card>

        <Card title="Paper Betting Lab">
          <div className="space-y-3">{(lab?.strategies || []).map((strategy) => <div key={strategy.id} className="rounded-xl bg-white/[0.04] p-4"><div className="flex justify-between"><strong>{strategy.name}</strong><span>{pct(strategy.stakeFraction)}</span></div><div className="mt-1 text-xs text-slate-400">Odotusarvo {pct(strategy.expectedReturn)} · {strategy.allowed ? "paper-testattava" : "estetty"}</div></div>)}</div>
          <p className="mt-4 text-xs text-slate-500">Ei rahansiirtoja, ei automaattisia vetoja, enintään 5 % laskennallinen paperiraja.</p>
        </Card>
      </div>

      <Card title="AI Coach">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="text-2xl font-black text-white">{coach?.verdict || "—"}</div><p className="mt-2 leading-7 text-slate-300">{coach?.summary || "Valitse tapahtuma."}</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{(coach?.reasons || []).map((reason) => <div key={reason.id} className="rounded-xl border border-white/10 p-4"><strong>{reason.label}</strong><div className="mt-1 text-sm text-slate-400">Arvo {pct(reason.value)} · vaikutus {pct(reason.impact)}</div></div>)}</div>
        <p className="mt-4 text-sm text-slate-400">Käytetyt rivit: {coach?.transparency?.recordsUsed ?? 0} · keksitty data: {coach?.transparency?.inventedData ? "kyllä" : "ei"} · tuotantotodennäköisyys muutettu: {coach?.transparency?.productionProbabilityChanged ? "kyllä" : "ei"}</p>
      </Card>
    </main>
  );
}
