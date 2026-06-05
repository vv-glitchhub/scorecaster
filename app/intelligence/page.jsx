"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { buildIntelligenceSummary } from "../../lib/intelligence-summary-engine";
import { formatPercent } from "../../lib/analysis-engine";

export default function IntelligencePage() {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await res.json();
        setPicks(Array.isArray(data.data) ? data.data : []);
      } catch {
        setPicks([]);
      }
    }

    load();
  }, []);

  const summary = buildIntelligenceSummary(picks);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Intelligence Dashboard
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Intelligence Layer
        </h1>

        <p className="mt-3 text-slate-300">
          Näyttää agentin signaalit: positiiviset uutiset, riskit, puuttuvat
          tiedot ja lähteiden luottamuksen.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Picks</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {summary.totalPicks}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Positive Signals</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {summary.positiveSignals.length}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Negative Signals</div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {summary.negativeSignals.length}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Average Trust</div>
          <div className="mt-2 text-3xl font-black text-purple-300">
            {formatPercent(summary.averageTrust)}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="Positive Signals" subtitle="Agentia tukevat signaalit">
          <div className="space-y-3">
            {summary.positiveSignals.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei positiivisia signaaleja vielä.
              </div>
            )}

            {summary.positiveSignals.slice(0, 20).map((item, index) => (
              <div
                key={`${item.match}-${index}`}
                className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm"
              >
                <div className="font-bold text-emerald-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Negative Signals" subtitle="Riskit ja varoitukset">
          <div className="space-y-3">
            {summary.negativeSignals.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei negatiivisia signaaleja vielä.
              </div>
            )}

            {summary.negativeSignals.slice(0, 20).map((item, index) => (
              <div
                key={`${item.match}-${index}`}
                className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm"
              >
                <div className="font-bold text-red-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Missing Data" subtitle="Mitä agentti vielä tarvitsee">
          <div className="space-y-3">
            {summary.missingData.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei puuttuvia tietoja.
              </div>
            )}

            {summary.missingData.slice(0, 20).map((item, index) => (
              <div
                key={`${item.match}-${item.item}-${index}`}
                className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm"
              >
                <div className="font-bold text-yellow-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.item}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
