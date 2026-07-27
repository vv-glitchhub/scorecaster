"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function Card({ title, children }) {
  return <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7"><h2 className="text-xl font-semibold text-white">{title}</h2><div className="mt-5">{children}</div></section>;
}

function Badge({ children, tone = "neutral" }) {
  const map = { good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100", warn: "border-amber-400/30 bg-amber-400/10 text-amber-100", bad: "border-rose-400/30 bg-rose-400/10 text-rose-100", neutral: "border-white/15 bg-white/5 text-slate-200" };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export default function IntelligenceV4Client() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iterations, setIterations] = useState(5000);
  const [bankroll, setBankroll] = useState(1000);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/intelligence-v4?hours=720&iterations=${iterations}&bankroll=${bankroll}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "V4 unavailable");
      setData(payload);
    } catch (err) { setError(err.message || "V4 unavailable"); }
    finally { setLoading(false); }
  }, [iterations, bankroll]);
  useEffect(() => { load(); }, [load]);
  const maxTitle = useMemo(() => Math.max(0.01, ...(data?.digitalTwin?.teams || []).map((row) => row.titleProbability)), [data]);

  return <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Scorecaster Intelligence V4</p>
      <h1 className="mt-3 text-3xl font-bold text-white sm:text-5xl">Digital Twin & Model Lab</h1>
      <p className="mt-4 max-w-3xl text-slate-300">Kausi- ja matchup-simulaatio, mallirekisteri, paperistrategioiden backtest ja yhdistetty riskisignaalikerros nykyisestä julkaistavasta Collector-datasta.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Badge tone="good">paper-only</Badge><Badge>publishable-only</Badge><Badge>no official schedule claim</Badge></div>
    </section>

    <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <label className="text-sm">Simulaatiot<input className="ml-2 rounded-lg bg-white/10 px-3 py-2" type="number" min="500" max="50000" value={iterations} onChange={(event) => setIterations(Number(event.target.value))} /></label>
      <label className="text-sm">Paperikassa €<input className="ml-2 rounded-lg bg-white/10 px-3 py-2" type="number" min="100" max="1000000" value={bankroll} onChange={(event) => setBankroll(Number(event.target.value))} /></label>
      <button onClick={load} className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-950">Laske uudelleen</button>
    </section>

    {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4">{error}</div> : null}
    {loading ? <div className="text-slate-400">Lasketaan Intelligence V4 -näkymää…</div> : null}

    {data ? <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Tapahtumat', data.eventCount], ['Joukkueet', data.matchupGraph.nodes.length], ['Otteluparit', data.matchupGraph.edges.length], ['Simulaatiot', data.digitalTwin.iterations]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-xs uppercase tracking-wider text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}</div></div>)}
      </section>

      <Card title="Digital Twin - mestaruusjakauma">
        <div className="space-y-3">{data.digitalTwin.teams.slice(0, 12).map((row) => <div key={row.team}><div className="flex justify-between text-sm"><span>{row.team}</span><span>{(row.titleProbability * 100).toFixed(1)} %</span></div><div className="mt-1 h-3 rounded-full bg-white/5"><div className="h-3 rounded-full bg-cyan-300" style={{ width: `${Math.max(2, row.titleProbability / maxTitle * 100)}%` }} /></div></div>)}</div>
        <p className="mt-4 text-xs text-slate-500">{data.digitalTwin.caveat}</p>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Mallirekisteri"><div className="space-y-3">{data.modelRegistry.map((model) => <article key={model.id} className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between"><strong>{model.label}</strong><Badge tone={model.grade === 'A' || model.grade === 'B' ? 'good' : model.grade === 'E' ? 'bad' : 'warn'}>{model.grade}</Badge></div><p className="mt-2 text-sm text-slate-400">Coverage {(model.coverage * 100).toFixed(0)} % · confidence {(model.confidence * 100).toFixed(0)} % · stability {(model.stability * 100).toFixed(0)} %</p></article>)}</div></Card>
        <Card title="Riskisignaalit"><div className="space-y-3">{data.riskSignals.map((signal) => <article key={signal.code} className="rounded-2xl border border-white/10 p-4"><div className="flex items-center gap-2"><Badge tone={signal.severity === 'critical' ? 'bad' : signal.severity === 'warning' ? 'warn' : 'good'}>{signal.severity}</Badge><strong>{signal.code}</strong></div><p className="mt-2 text-sm text-slate-300">{signal.message}</p></article>)}</div></Card>
      </div>

      <Card title="Paper-strategioiden backtest"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-slate-500"><tr><th className="px-3 py-2 text-left">Strategia</th><th>Tilaisuudet</th><th>Loppukassa</th><th>Tuotto</th><th>ROI panokselle</th></tr></thead><tbody>{data.backtest.map((row) => <tr key={row.id} className="border-t border-white/5"><td className="px-3 py-3 font-medium">{row.label}</td><td className="text-center">{row.opportunities}</td><td className="text-center">{row.endingExpectedBankroll.toLocaleString('fi-FI')} €</td><td className="text-center">{row.expectedProfit.toLocaleString('fi-FI')} €</td><td className="text-center">{(row.roiOnStake * 100).toFixed(2)} %</td></tr>)}</tbody></table></div></Card>

      <Card title="Matchup-verkosto"><div className="grid gap-3 md:grid-cols-2">{data.matchupGraph.edges.slice(0, 12).map((edge) => <article key={edge.eventId} className="rounded-2xl border border-white/10 p-4"><div className="font-medium">{edge.home} – {edge.away}</div><p className="mt-2 text-sm text-slate-400">Koti {(edge.homeProbability * 100).toFixed(1)} % · vieras {(edge.awayProbability * 100).toFixed(1)} %</p></article>)}</div></Card>
    </> : null}
  </main>;
}
