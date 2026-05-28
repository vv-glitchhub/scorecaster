"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { getTrackedBets } from "../../lib/tracking-storage";
import { formatPercent, formatMoney } from "../../lib/analysis-engine";

export default function TrackingPage() {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    setBets(getTrackedBets());
  }, []);

  const totalStake = bets.reduce(
    (sum, bet) => sum + Number(bet.stake || 0),
    0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Bet Tracking
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Tracking Center
        </h1>

        <p className="mt-3 text-slate-300">
          Seuraa vetoja, panoksia, edgeä ja AI-suosituksia.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Tracked Bets</div>
          <div className="mt-2 text-3xl font-black">
            {bets.length}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Total Stake</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(totalStake)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Mode</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            Local
          </div>
        </div>
      </section>

      <Panel title="Tracked Bets" subtitle="Saved betting ideas">
        <div className="space-y-4">
          {bets.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              No tracked bets yet.
            </div>
          )}

          {bets.map((bet) => (
            <div
              key={bet.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xl font-black">
                    {bet.match}
                  </div>

                  <div className="mt-2 text-sm text-slate-400">
                    {bet.selection} @ {bet.odds}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 px-4 py-3">
                  <div className="text-sm text-slate-400">
                    Suggested Stake
                  </div>

                  <div className="mt-1 text-xl font-black text-emerald-300">
                    {formatMoney(bet.stake)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">
                    Edge
                  </div>

                  <div className="mt-2 text-xl font-black text-emerald-300">
                    {formatPercent(bet.edge)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">
                    EV
                  </div>

                  <div className="mt-2 text-xl font-black text-sky-300">
                    {formatPercent(bet.ev)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
