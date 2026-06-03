"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { formatPercent } from "../../lib/analysis-engine";
import { predictFixtures } from "../../lib/prediction-slip-engine";

const STORAGE_KEY = "scorecaster_prediction_fixtures";

const defaultFixturesText = [
  "Brazil,Germany,60,58",
  "France,Argentina,61,60",
  "Spain,Netherlands,59,57"
].join("\n");

function parseFixtures(text) {
  return text
    .split("\n")
    .map((line) => line.split(",").map((item) => item.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
    .map(([homeTeam, awayTeam, homeRating = 55, awayRating = 55]) => ({
      homeTeam,
      awayTeam,
      homeRating: Number(homeRating || 55),
      awayRating: Number(awayRating || 55)
    }));
}

export default function SimulatorClient() {
  const [fixturesText, setFixturesText] = useState(defaultFixturesText);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setFixturesText(saved);
  }, []);

  function saveFixtures() {
    localStorage.setItem(STORAGE_KEY, fixturesText);
    setSavedMessage("Pelit tallennettu.");
  }

  function clearFixtures() {
    localStorage.removeItem(STORAGE_KEY);
    setFixturesText("");
    setSavedMessage("Pelilista tyhjennetty.");
  }

  function loadExample() {
    setFixturesText(defaultFixturesText);
    setSavedMessage("Esimerkkipelit ladattu.");
  }

  const fixtures = parseFixtures(fixturesText);
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
          Syötä ottelut muodossa:
          kotijoukkue,vierasjoukkue,kotirating,vierasrating.
        </p>
      </section>

      <Panel title="Syötä pelit" subtitle="Yksi peli per rivi">
        <textarea
          value={fixturesText}
          onChange={(event) => {
            setFixturesText(event.target.value);
            setSavedMessage("");
          }}
          className="min-h-48 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none"
          placeholder="Finland,Sweden,56,58"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={saveFixtures}
            className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950 hover:bg-emerald-300"
          >
            Save Fixtures
          </button>

          <button
            onClick={loadExample}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300 hover:bg-white/10"
          >
            Load Example
          </button>

          <button
            onClick={clearFixtures}
            className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300 hover:bg-red-400/20"
          >
            Clear
          </button>
        </div>

        {savedMessage && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            {savedMessage}
          </div>
        )}

        <div className="mt-3 text-sm text-slate-400">
          Esimerkki: Finland,Sweden,56,58
        </div>
      </Panel>

      <Panel
        title="Simuloidut merkit"
        subtitle="1 / X / 2 tulosveikkausta varten"
      >
        <div className="space-y-4">
          {predictions.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Ei pelejä. Lisää ottelut yllä olevaan kenttään.
            </div>
          )}

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

                  <div className="mt-1 text-sm text-slate-400">
                    Confidence:{" "}
                    <span className="font-bold text-sky-300">
                      {game.confidence}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    Recommendation:{" "}
                    <span className="font-bold text-emerald-300">
                      {game.recommendation}
                    </span>
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

              <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-slate-300">
                {game.confidenceNote}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
