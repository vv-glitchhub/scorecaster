"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { calculateBankrollPlan } from "../../lib/bankroll-manager";
import { getSavedBankroll, saveBankroll } from "../../lib/bankroll-storage";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

export default function BankrollPage() {
  const [bankroll, setBankroll] = useState(1000);
  const [plan, setPlan] = useState(null);
  const [source, setSource] = useState("loading");

  useEffect(() => {
    setBankroll(getSavedBankroll(1000));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/top-picks?view=summary", { cache: "no-store" });
        const data = await res.json();

        setPlan(
          calculateBankrollPlan({
            bankroll,
            picks: data.data || []
          })
        );

        setSource(data.source || "api");
      } catch {
        setSource("error");
        setPlan(calculateBankrollPlan({ bankroll, picks: [] }));
      }
    }

    load();
  }, [bankroll]);

  function updateBankroll(value) {
    setBankroll(value);
    saveBankroll(value);
  }

  if (!plan) {
    return <div className="text-slate-400">Loading bankroll manager...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Bankroll Manager V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          AI Bankroll Manager
        </h1>

        <p className="mt-3 text-slate-300">
          Hallitsee panoskokoa, kokonaisriskiä ja agentin parhaiden kohteiden
          allokaatiota.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          Source: <span className="font-bold text-emerald-300">{source}</span>
        </div>
      </section>

      <Panel title="Bankroll Settings" subtitle="Tallennettu localStorageen">
        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Bankroll €
          </div>

          <input
            type="number"
            min="1"
            value={bankroll}
            onChange={(event) =>
              updateBankroll(Number(event.target.value || 0))
            }
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
          />
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Bankroll</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatMoney(plan.bankroll)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Allocated</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(plan.allocated)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Remaining</div>
          <div className="mt-2 text-3xl font-black text-purple-300">
            {formatMoney(plan.remaining)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Exposure</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {formatPercent(plan.exposurePercent)}
          </div>
        </div>
      </section>

      <Panel title="Risk Rules" subtitle="Built-in bankroll protection">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-300">
            Max total exposure:{" "}
            <span className="font-bold text-yellow-300">
              {formatMoney(plan.maxTotalExposure)}
            </span>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-300">
            Max single bet:{" "}
            <span className="font-bold text-emerald-300">
              {formatMoney(plan.maxSingleBet)}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="Recommended Positions" subtitle="BET / model candidates">
        <div className="space-y-3">
          {plan.recommendations.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Ei sopivia kohteita juuri nyt.
            </div>
          )}

          {plan.recommendations.map((bet) => (
            <div
              key={`${bet.match}-${bet.selection}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xl font-black">{bet.match}</div>

                  <div className="mt-1 text-sm text-slate-400">
                    {bet.selection} @ {bet.odds}
                  </div>

                  {bet.bookmaker && (
                    <div className="mt-1 text-sm text-emerald-300">
                      Bookmaker: {bet.bookmaker}
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-emerald-400/10 px-5 py-4 text-right">
                  <div className="text-sm text-slate-400">Stake</div>
                  <div className="mt-1 text-2xl font-black text-emerald-300">
                    {formatMoney(bet.stake)}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Decision</div>
                  <div className="mt-2 text-xl font-black text-sky-300">
                    {bet.decision}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Edge</div>
                  <div className="mt-2 text-xl font-black text-emerald-300">
                    {formatPercent(bet.edge)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">EV</div>
                  <div className="mt-2 text-xl font-black text-purple-300">
                    {formatPercent(bet.ev)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">Score</div>
                  <div className="mt-2 text-xl font-black text-yellow-300">
                    {formatPercent(bet.finalScore)}
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
