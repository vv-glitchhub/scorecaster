"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { getCLVHistory, clearCLVHistory } from "../../lib/clv-storage";
import { formatPercent } from "../../lib/analysis-engine";

export default function CLVPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setHistory(getCLVHistory());
  }

  function clearAll() {
    clearCLVHistory();
    refresh();
  }

  const total = history.length;
  const positive = history.filter((item) => item.positive).length;
  const negative = total - positive;

  const averageCLV =
    total > 0
      ? history.reduce((sum, item) => sum + Number(item.clv || 0), 0) / total
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          CLV Center
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Closing Line Value
        </h1>

        <p className="mt-3 text-slate-300">
          CLV kertoo, saiko agentti paremman kertoimen kuin markkinan
          sulkeutuessa. Pitkällä aikavälillä tämä on tärkeä laatumittari.
        </p>

        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300 hover:bg-red-400/20"
          >
            Clear CLV History
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Records</div>
          <div className="mt-2 text-3xl font-black text-sky-300">{total}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Positive CLV</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {positive}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Negative CLV</div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {negative}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Average CLV</div>
          <div className="mt-2 text-3xl font-black text-purple-300">
            {formatPercent(averageCLV)}
          </div>
        </div>
      </section>

      <Panel title="CLV History" subtitle="Tracked closing line value records">
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Ei CLV-historiaa vielä.
            </div>
          )}

          {history.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xl font-black">{item.match}</div>

                  <div className="mt-2 text-sm text-slate-400">
                    {item.selection}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("fi-FI")
                      : "Unknown date"}
                  </div>
                </div>

                <div
                  className={`rounded-xl px-4 py-3 text-right ${
                    item.positive
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-red-400/10 text-red-300"
                  }`}
                >
                  <div className="text-sm">CLV</div>
                  <div className="mt-1 text-xl font-black">
                    {formatPercent(item.clv || 0)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Bet Odds</div>
                  <div className="mt-2 text-xl font-black">{item.betOdds}</div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Closing Odds</div>
                  <div className="mt-2 text-xl font-black">
                    {item.closingOdds}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Note</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {item.note || "-"}
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
