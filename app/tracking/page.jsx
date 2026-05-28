"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";

import {
  getTrackedBets,
  settleTrackedBet,
  deleteTrackedBet,
  clearTrackedBets,
  updateClosingOdds
} from "../../lib/tracking-storage";

import {
  calculateTrackingStats,
  calculateProfitLoss,
  calculateCLV
} from "../../lib/tracking-engine";

import { formatPercent, formatMoney } from "../../lib/analysis-engine";

export default function TrackingPage() {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setBets(getTrackedBets());
  }

  function settleBet(id, result) {
    settleTrackedBet(id, result);
    refresh();
  }

  function deleteBet(id) {
    deleteTrackedBet(id);
    refresh();
  }

  function clearAll() {
    clearTrackedBets();
    refresh();
  }

  function changeClosingOdds(id, value) {
    updateClosingOdds(id, value);
    refresh();
  }

  const stats = calculateTrackingStats(bets);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Bet Tracking
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Performance Tracking
        </h1>

        <p className="mt-3 text-slate-300">
          Track ROI, bankroll, win rate, profit and CLV.
        </p>

        {bets.length > 0 && (
          <button
            onClick={clearAll}
            className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300 hover:bg-red-400/20"
          >
            Clear All Local Bets
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Tracked Bets</div>
          <div className="mt-2 text-3xl font-black">{stats.totalBets}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">ROI</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(stats.roi)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Profit</div>
          <div
            className={`mt-2 text-3xl font-black ${
              stats.totalProfit >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatMoney(stats.totalProfit)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Win Rate</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {formatPercent(stats.winRate)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Avg CLV</div>
          <div
            className={`mt-2 text-3xl font-black ${
              stats.averageCLV >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatPercent(stats.averageCLV)}
          </div>
        </div>
      </section>

      <Panel title="Tracked Bets" subtitle="Performance history with CLV">
        <div className="space-y-4">
          {bets.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              No tracked bets yet.
            </div>
          )}

          {bets.map((bet) => {
            const profit = calculateProfitLoss({
              stake: bet.stake,
              odds: bet.odds,
              result: bet.result
            });

            const clv = calculateCLV({
              odds: bet.odds,
              closingOdds: bet.closingOdds
            });

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

                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(bet.createdAt).toLocaleString("fi-FI")}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                    <div className="text-sm text-slate-400">Stake</div>
                    <div className="mt-1 text-xl font-black text-emerald-300">
                      {formatMoney(bet.stake)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
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
                    <div className="text-sm text-slate-400">Closing Odds</div>
                    <input
                      value={bet.closingOdds || ""}
                      onChange={(event) =>
                        changeClosingOdds(bet.id, event.target.value)
                      }
                      placeholder="1.95"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">CLV</div>
                    <div
                      className={`mt-2 text-xl font-black ${
                        clv >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {formatPercent(clv)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Profit</div>
                    <div
                      className={`mt-2 text-xl font-black ${
                        profit >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {formatMoney(profit)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {bet.result === "pending" && (
                    <>
                      <button
                        onClick={() => settleBet(bet.id, "win")}
                        className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950 hover:bg-emerald-300"
                      >
                        Mark Win
                      </button>

                      <button
                        onClick={() => settleBet(bet.id, "loss")}
                        className="rounded-xl bg-red-400 px-4 py-2 font-bold text-slate-950 hover:bg-red-300"
                      >
                        Mark Loss
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => deleteBet(bet.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300 hover:bg-white/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
