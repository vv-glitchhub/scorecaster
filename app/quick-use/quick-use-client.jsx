"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBetSlipItem, calculateBetSlipTotals } from "../../lib/bet-slip-engine";
import { evaluatePickRisk } from "../../lib/production-risk-rules";

const storageKey = "scorecaster.quickUse.bets";

export default function QuickUseClient() {
  const [bets, setBets] = useState([]);
  const [bankroll, setBankroll] = useState("1000");
  const [match, setMatch] = useState("");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [edge, setEdge] = useState("0.03");
  const [confidence, setConfidence] = useState("0.60");

  useEffect(() => {
    try {
      const value = localStorage.getItem(storageKey);
      setBets(value ? JSON.parse(value) : []);
    } catch {
      setBets([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(bets));
  }, [bets]);

  const settings = useMemo(() => ({ bankroll: Number(bankroll || 1000) }), [bankroll]);
  const totals = useMemo(() => calculateBetSlipTotals(bets), [bets]);
  const risk = useMemo(
    () => evaluatePickRisk(
      {
        stake: Number(stake || 0),
        edge: Number(edge || 0),
        confidence: Number(confidence || 0)
      },
      settings
    ),
    [stake, edge, confidence, settings]
  );

  function addBet() {
    if (!match.trim() || !selection.trim() || !odds) return;

    const item = createBetSlipItem({
      match: match.trim(),
      selection: selection.trim(),
      odds: Number(odds),
      stake: Number(stake || 0),
      edge: Number(edge || 0),
      confidence: Number(confidence || 0),
      sport: "manual",
      league: "manual"
    }, Number(stake || 0));

    setBets((current) => [{ ...item, localRisk: evaluatePickRisk(item, settings) }, ...current]);
    setMatch("");
    setSelection("");
    setOdds("");
    setStake("");
  }

  function clearAll() {
    localStorage.removeItem(storageKey);
    setBets([]);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Scorecaster Quick Use
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          Add manual picks and test risk instantly.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Vedot tallentuvat ensin tähän selaimeen. Kirjautumisen jälkeen voit siirtää ne Cloud Sync -sivulta käyttäjäkohtaisesti suojattuun Supabase-tietokantaan.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/cloud-sync" className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Cloud Sync</Link>
          <Link href="/profile" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 font-black text-emerald-100">Profile</Link>
          <Link href="/" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Dashboard</Link>
          <Link href="/risk" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Risk Control</Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Add manual pick</h2>
          <div className="mt-5 grid gap-3">
            <input className="quick-input" value={bankroll} onChange={(event) => setBankroll(event.target.value)} placeholder="Bankroll" inputMode="decimal" />
            <input className="quick-input" value={match} onChange={(event) => setMatch(event.target.value)} placeholder="Match, e.g. Team A vs Team B" />
            <input className="quick-input" value={selection} onChange={(event) => setSelection(event.target.value)} placeholder="Selection" />
            <input className="quick-input" value={odds} onChange={(event) => setOdds(event.target.value)} placeholder="Odds, e.g. 2.10" inputMode="decimal" />
            <input className="quick-input" value={stake} onChange={(event) => setStake(event.target.value)} placeholder="Stake" inputMode="decimal" />
            <input className="quick-input" value={edge} onChange={(event) => setEdge(event.target.value)} placeholder="Edge decimal, e.g. 0.03" inputMode="decimal" />
            <input className="quick-input" value={confidence} onChange={(event) => setConfidence(event.target.value)} placeholder="Confidence decimal, e.g. 0.60" inputMode="decimal" />
            <button onClick={addBet} className="rounded-2xl bg-emerald-400 px-5 py-4 font-black text-slate-950">Add to local slip</button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-2xl font-black">Risk preview</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl bg-slate-950/70 p-4">Decision: <strong>{risk.decision}</strong></div>
            <div className="rounded-2xl bg-slate-950/70 p-4">Total bets: <strong>{bets.length}</strong></div>
            <div className="rounded-2xl bg-slate-950/70 p-4">Total stake: <strong>€{totals.stake.toFixed(2)}</strong></div>
            <div className="rounded-2xl bg-slate-950/70 p-4">Potential return: <strong>€{totals.potentialReturn.toFixed(2)}</strong></div>
            <Link href="/cloud-sync" className="block w-full rounded-2xl border border-sky-400/30 bg-sky-400/10 px-5 py-4 text-center font-black text-sky-100">
              Sync {bets.length} bet{bets.length === 1 ? "" : "s"} to cloud
            </Link>
            <button onClick={clearAll} className="w-full rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 font-black text-red-100">Clear local slip</button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {bets.map((bet) => (
          <article key={bet.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">{bet.market} · {bet.localRisk?.decision}</div>
            <h3 className="mt-3 text-2xl font-black">{bet.match}</h3>
            <p className="mt-2 text-slate-300">{bet.selection} @ {bet.odds}</p>
            <p className="mt-2 text-slate-400">Stake €{bet.stake} · Edge {(bet.edge * 100).toFixed(1)}% · Confidence {(bet.confidence * 100).toFixed(1)}%</p>
          </article>
        ))}
      </section>

      <style jsx>{`
        .quick-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(2,6,23,0.72);
          color: white;
          padding: 0.95rem 1rem;
          outline: none;
        }
        .quick-input:focus { border-color: rgba(52,211,153,0.65); }
      `}</style>
    </div>
  );
}
