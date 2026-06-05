"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { calculateBankrollPlan } from "../../lib/bankroll-manager";

export default function BankrollPage() {
  const [plan, setPlan] =
    useState(null);

  useEffect(() => {
    async function load() {
      const res =
        await fetch(
          "/api/top-picks"
        );

      const data =
        await res.json();

      const bankrollPlan =
        calculateBankrollPlan({
          bankroll: 1000,
          picks:
            data.data || []
        });

      setPlan(bankrollPlan);
    }

    load();
  }, []);

  if (!plan)
    return (
      <div>Loading...</div>
    );

  return (
    <div className="space-y-6">
      <Panel
        title="Bankroll Manager"
        subtitle="AI Fund Allocation"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white/[0.04] p-4">
            Bankroll
            <div className="text-2xl font-black">
              €
              {plan.bankroll.toFixed(
                2
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4">
            Allocated
            <div className="text-2xl font-black text-emerald-300">
              €
              {plan.allocated.toFixed(
                2
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4">
            Remaining
            <div className="text-2xl font-black text-sky-300">
              €
              {plan.remaining.toFixed(
                2
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Recommended Bets"
        subtitle="Position Sizing"
      >
        <div className="space-y-3">
          {plan.recommendations.map(
            (bet) => (
              <div
                key={`${bet.match}-${bet.selection}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="font-bold">
                  {bet.match}
                </div>

                <div className="text-slate-400">
                  {bet.selection}
                </div>

                <div className="mt-2 text-emerald-300 font-bold">
                  €
                  {bet.stake.toFixed(
                    2
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </Panel>
    </div>
  );
}
