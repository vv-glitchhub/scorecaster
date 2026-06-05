"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

function toRows(data = {}) {
  return Object.entries(data).map(([key, value]) => ({
    key,
    ...value
  }));
}

export default function AgentMemoryPage() {
  const [learning, setLearning] = useState(null);

  useEffect(() => {
    const bets = getTrackedBets();
    setLearning(calculateAgentPerformance(bets));
  }, []);

  const sports = toRows(learning?.bySport || {}).sort(
    (a, b) => Number(b.profit || 0) - Number(a.profit || 0)
  );

  const markets = toRows(learning?.byMarket || {}).sort(
    (a, b) => Number(b.profit || 0) - Number(a.profit || 0)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Agent Memory
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Learning Insights
        </h1>

        <p className="mt-3 text-slate-300">
          Näyttää missä lajeissa ja markkinoissa agentti on onnistunut tai
          epäonnistunut tracking-historian perusteella.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Settled Bets</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {learning?.sampleSize || 0}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Sports Learned</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {sports.length}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Markets Learned</div>
          <div className="mt-2 text-3xl font-black text-purple-300">
            {markets.length}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="By Sport" subtitle="Agent performance by league/sport">
          <div className="space-y-3">
            {sports.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei vielä tarpeeksi ratkaistuja vetoja.
              </div>
            )}

            {sports.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold">{item.key}</div>
                  <div
                    className={`font-bold ${
                      Number(item.profit || 0) >= 0
                        ? "text-emerald-300"
                        : "text-red-300"
                    }`}
                  >
                    {formatMoney(item.profit || 0)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-slate-500">Bets</div>
                    <div className="font-bold">{item.bets}</div>
                  </div>

                  <div>
                    <div className="text-slate-500">Wins</div>
                    <div className="font-bold">{item.wins}</div>
                  </div>

                  <div>
                    <div className="text-slate-500">Win Rate</div>
                    <div className="font-bold text-sky-300">
                      {formatPercent(item.winRate || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="By Market" subtitle="Agent performance by market type">
          <div className="space-y-3">
            {markets.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei vielä tarpeeksi ratkaistuja markkinoita.
              </div>
            )}

            {markets.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold">{item.key}</div>
                  <div
                    className={`font-bold ${
                      Number(item.profit || 0) >= 0
                        ? "text-emerald-300"
                        : "text-red-300"
                    }`}
                  >
                    {formatMoney(item.profit || 0)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-slate-500">Bets</div>
                    <div className="font-bold">{item.bets}</div>
                  </div>

                  <div>
                    <div className="text-slate-500">Wins</div>
                    <div className="font-bold">{item.wins}</div>
                  </div>

                  <div>
                    <div className="text-slate-500">Win Rate</div>
                    <div className="font-bold text-sky-300">
                      {formatPercent(item.winRate || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
