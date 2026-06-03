"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { getTrackedBets } from "../../lib/tracking-storage";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

function calculateOpenStats(bets) {
  const openBets = bets.filter((bet) => bet.result === "pending");

  const exposure = openBets.reduce(
    (sum, bet) => sum + Number(bet.stake || 0),
    0
  );

  const potentialReturn = openBets.reduce(
    (sum, bet) => sum + Number(bet.stake || 0) * Number(bet.odds || 0),
    0
  );

  const averageEdge =
    openBets.length > 0
      ? openBets.reduce((sum, bet) => sum + Number(bet.edge || 0), 0) /
        openBets.length
      : 0;

  return {
    openCount: openBets.length,
    exposure,
    potentialReturn,
    potentialProfit: potentialReturn - exposure,
    averageEdge,
    openBets
  };
}

export default function OpenBetsPage() {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    setBets(getTrackedBets());
  }, []);

  const stats = calculateOpenStats(bets);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Open Bets Center
        </div>

        <h1 className="text-4xl font-black tracking-tight">Open Bets</h1>

        <p className="mt-3 text-slate-300">
          Näe kaikki avoimet vedot, kokonaisriski, mahdollinen palautus ja
          odotettu edge yhdessä näkymässä.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Open Bets</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {stats.openCount}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Exposure</div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {formatMoney(stats.exposure)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Potential Profit</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(stats.potentialProfit)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Average Edge</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {formatPercent(stats.averageEdge)}
          </div>
        </div>
      </section>

      <Panel title="Active Positions" subtitle="Currently open tracked bets">
        <div className="space-y-4">
          {stats.openBets.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Ei avoimia vetoja. Lisää veto Betting- tai Agent-sivulta.
            </div>
          )}

          {stats.openBets.map((bet) => {
            const stake = Number(bet.stake || 0);
            const odds = Number(bet.odds || 0);
            const potentialReturn = stake * odds;
            const potentialProfit = potentialReturn - stake;

            return (
              <div
                key={bet.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xl font-black">{bet.match}</div>

                    <div className="mt-2 text-sm text-slate-400">
                      {bet.selection} @ {bet.odds}
                    </div>

                    {bet.bookmaker && (
                      <div className="mt-1 text-sm text-emerald-300">
                        Bookmaker: {bet.bookmaker}
                      </div>
                    )}

                    {bet.source && (
                      <div className="mt-1 text-xs text-slate-500">
                        Source: {bet.source}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                    <div className="text-sm text-slate-400">Stake</div>
                    <div className="mt-1 text-xl font-black text-red-300">
                      {formatMoney(stake)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Edge</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatPercent(bet.edge)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">EV</div>
                    <div className="mt-2 text-xl font-black text-sky-300">
                      {formatPercent(bet.ev)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Return</div>
                    <div className="mt-2 text-xl font-black">
                      {formatMoney(potentialReturn)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Potential Profit</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatMoney(potentialProfit)}
                    </div>
                  </div>
                </div>

                {bet.movementSignal && (
                  <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4 text-sm text-slate-300">
                    Movement signal:{" "}
                    <span className="font-bold text-sky-300">
                      {bet.movementSignal}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
