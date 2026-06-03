"use client";

import { useState } from "react";
import Panel from "../components/Panel";
import { formatPercent } from "../../lib/analysis-engine";
import { predictFixtures } from "../../lib/prediction-slip-engine";

const defaultFixtures = [
  { homeTeam: "Brazil", awayTeam: "Germany", homeRating: 60, awayRating: 58 },
  { homeTeam: "France", awayTeam: "Argentina", homeRating: 61, awayRating: 60 },
  { homeTeam: "Spain", awayTeam: "Netherlands", homeRating: 59, awayRating: 57 }
];

export default function SimulatorClient() {
  const [fixturesText, setFixturesText] = useState(
    defaultFixtures
      .map((game) => `${game.homeTeam},${game.awayTeam},${game.homeRating},${game.awayRating}`)
      .join("\n")
  );

  const fixtures = fixturesText
    .split("\n")
    .map((line) => line.split(",").map((item) => item.trim()))
    .filter((parts) => parts.length >= 2)
    .map(([homeTeam, awayTeam, homeRating = 55, awayRating = 55]) => ({
      homeTeam,
      awayTeam,
      homeRating: Number(homeRating),
      awayRating: Number(awayRating)
    }));

  const predictions = predictFixtures(fixtures);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          MM-kisat · Tulosveikkaus
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Match Prediction Slip
        </h1>

        <p className="mt-3 text-slate-300">
          Syötä ottelut muodossa: kotijoukkue,vierasjoukkue,kotirating,vierasrating.
        </p>
      </section>

      <Panel title="Syötä pelit" subtitle="Yksi peli per rivi">
        <textarea
          value={fixturesText}
          onChange={(event) => setFixturesText(event.target.value)}
          className="min-h-48 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none"
        />

        <div className="mt-3 text-sm text-slate-400">
          Esimerkki: Finland,Sweden,56,58
        </div>
      </Panel>

      <Panel title="Simuloidut merkit" subtitle="1 / X / 2 tulosveikkausta varten">
        <div className="space-y-4">
          {predictions.map((game) => (
            <div
              key={`${game.homeTeam}-${game.awayTeam}`}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xl font-black">
                    {game.homeTeam} vs {game.awayTeam}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Arvioitu tulos: {game.projectedScore}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 px-6 py-4 text-center">
                  <div className="text-sm text-slate-400">Merkki</div>
                  <div className="mt-1 text-4xl font-black text-emerald-300">
                    {game.prediction}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">1</div>
                  <div className="mt-2 text-xl font-black text-emerald-300">
                    {formatPercent(game.homeWinProbability)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">X</div>
                  <div className="mt-2 text-xl font-black text-yellow-300">
                    {formatPercent(game.drawProbability)}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4">
                  <div className="text-sm text-slate-400">2</div>
                  <div className="mt-2 text-xl font-black text-sky-300">
                    {formatPercent(game.awayWinProbability)}
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
