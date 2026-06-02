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

function StatBox({ title, value, subtitle, tone = "default" }) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "red"
      ? "text-red-300"
      : tone === "blue"
      ? "text-sky-300"
      : tone === "yellow"
      ? "text-yellow-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`mt-2 text-3xl font-black ${color}`}>{value}</div>
      {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
    </div>
  );
}

export default function TrackingPage() {
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

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

  const filteredBets = bets
    .filter((bet) => {
      if (filter === "all") return true;
      if (filter === "open") return bet.result === "pending";
      if (filter === "settled") return bet.result !== "pending";
      if (filter === "wins") return bet.result === "win";
      if (filter === "losses") return bet.result === "loss";
      if (filter === "pushes") return bet.result === "push";
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();

      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Tracking System V2
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Performance Tracking
        </h1>

        <p className="mt-3 text-slate-300">
          Seuraa ROI:ta, profitia, CLV:tä, edgeä, EV:tä, streakkejä ja mallin
          onnistumista.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatBox
          title="Total Bets"
          value={stats.totalBets}
          subtitle={`${stats.openBets} open`}
        />
        <StatBox title="ROI" value={formatPercent(stats.roi)} tone="blue" />
        <StatBox
          title="Profit"
          value={formatMoney(stats.totalProfit)}
          tone={stats.totalProfit >= 0 ? "green" : "red"}
        />
        <StatBox
          title="Win Rate"
          value={formatPercent(stats.winRate)}
          tone="yellow"
        />

        <StatBox
          title="Average Edge"
          value={formatPercent(stats.averageEdge)}
          tone="green"
        />
        <StatBox
          title="Average EV"
          value={formatPercent(stats.averageEV)}
          tone="blue"
        />
        <StatBox
          title="Average CLV"
          value={formatPercent(stats.averageCLV)}
          tone={stats.averageCLV >= 0 ? "green" : "red"}
        />
        <StatBox title="Average Odds" value={stats.averageOdds.toFixed(2)} />

        <StatBox title="Wins" value={stats.wins} tone="green" />
        <StatBox title="Losses" value={stats.losses} tone="red" />
        <StatBox title="Pushes" value={stats.pushes} />
        <StatBox title="Current Streak" value={stats.currentStreak} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
          >
            <option value="all">All Bets</option>
            <option value="open">Open Bets</option>
            <option value="settled">Settled Bets</option>
            <option value="wins">Wins</option>
            <option value="losses">Losses</option>
            <option value="pushes">Pushes</option>
          </select>

          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </section>

      <Panel title="Tracked Bets" subtitle="Bet history, settlement and CLV">
        <div className="space-y-4">
          {filteredBets.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              No tracked bets found with current filters.
            </div>
          )}

          {filteredBets.map((bet) => {
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
                      {bet.createdAt
                        ? new Date(bet.createdAt).toLocaleString("fi-FI")
                        : "No date"}
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

                {bet.riskWarnings?.length > 0 && (
                  <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                    <div className="font-bold text-yellow-300">
                      Risk Warnings
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {bet.riskWarnings.map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

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

                      <button
                        onClick={() => settleBet(bet.id, "push")}
                        className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-slate-950 hover:bg-yellow-300"
                      >
                        Mark Push
                      </button>
                    </>
                  )}

                  {bet.result !== "pending" && (
                    <button
                      onClick={() => settleBet(bet.id, "pending")}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300 hover:bg-white/10"
                    >
                      Reopen
                    </button>
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
