"use client";

import { useEffect, useState } from "react";

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export default function SimulatorPanel() {
  const [data, setData] = useState(null);
  const [iterations, setIterations] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSimulation(customIterations = iterations) {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/simulator?iterations=${customIterations}`);
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Simulaattoria ei saatu haettua.");
        setData(null);
        return;
      }

      setData(json);
    } catch (err) {
      setError("Simulaattoria ei saatu haettua.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSimulation(iterations);
  }, []); // initial only

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg">
        <h2 className="mb-5 text-4xl font-extrabold text-white">
          Simulator 2.0
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-base font-bold text-slate-300">
              Iterations
            </label>
            <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-4 text-white outline-none"
            />
          </div>

          <button
            onClick={() => loadSimulation(Number(iterations))}
            className="rounded-2xl bg-blue-600 px-6 py-4 text-xl font-bold text-white transition hover:bg-blue-500"
          >
            Aja simulaatio
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 text-slate-300">
          Ajetaan simulaatiota...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-red-700 bg-[#5C0A0A] p-6 text-red-100">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg">
            <h3 className="mb-4 text-3xl font-extrabold text-white">
              Top 5 mestarisuosikkia
            </h3>

            <div className="space-y-3">
              {data.top5?.map((team, index) => (
                <div
                  key={team.team_name}
                  className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4"
                >
                  <div className="text-white">
                    <div className="text-lg font-bold">
                      #{index + 1} {team.team_name}
                    </div>
                    <div className="text-sm text-slate-300">
                      Overall {team.overall_rating}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-extrabold text-white">
                      {formatPct(team.championship_pct)}
                    </div>
                    <div className="text-sm text-slate-300">
                      mestaruus
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg">
            <h3 className="mb-4 text-3xl font-extrabold text-white">
              Championship table
            </h3>

            <div className="space-y-3">
              {data.championshipTable?.map((team) => (
                <div
                  key={team.team_name}
                  className="grid gap-3 rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4 md:grid-cols-5"
                >
                  <div className="font-bold text-white">{team.team_name}</div>
                  <div className="text-slate-200">Overall: {team.overall_rating}</div>
                  <div className="text-slate-200">Top 4: {formatPct(team.top4_pct)}</div>
                  <div className="text-slate-200">Final: {formatPct(team.finals_pct)}</div>
                  <div className="text-slate-200">Champion: {formatPct(team.championship_pct)}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
