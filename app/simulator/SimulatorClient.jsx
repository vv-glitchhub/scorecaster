"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { formatPercent } from "../../lib/analysis-engine";
import { predictFixtures } from "../../lib/prediction-slip-engine";
import { summarizePredictionSlip } from "../../lib/prediction-summary-engine";

const STORAGE_KEY = "scorecaster_prediction_fixtures";

const defaultFixturesText = [
  "Brazil,Germany,60,58,1,0,0,1,0,0,0",
  "France,Argentina,61,60,1,1,0,0,0,0,0",
  "Spain,Netherlands,59,57,0,1,1,0,0,1,0"
].join("\n");

function parseFixtures(text) {
  return text
    .split("\n")
    .map((line) => line.split(",").map((item) => item.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
    .map(
      ([
        homeTeam,
        awayTeam,
        homeBaseRating = 55,
        awayBaseRating = 55,
        homeForm = 0,
        awayForm = 0,
        homeInjuries = 0,
        awayInjuries = 0,
        homeFatigue = 0,
        awayFatigue = 0,
        homeAdvantage = 0
      ]) => ({
        homeTeam,
        awayTeam,
        homeBaseRating: Number(homeBaseRating || 55),
        awayBaseRating: Number(awayBaseRating || 55),
        homeForm: Number(homeForm || 0),
        awayForm: Number(awayForm || 0),
        homeInjuries: Number(homeInjuries || 0),
        awayInjuries: Number(awayInjuries || 0),
        homeFatigue: Number(homeFatigue || 0),
        awayFatigue: Number(awayFatigue || 0),
        homeAdvantage: Number(homeAdvantage || 0)
      })
    );
}

export default function SimulatorClient() {
  const [fixturesText, setFixturesText] = useState(defaultFixturesText);
  const [savedMessage, setSavedMessage] = useState("");
  const [rowPrice, setRowPrice] = useState(1);

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
  const summary = summarizePredictionSlip(predictions);

  const predictionRow = predictions.map((game) => game.prediction).join(" ");
  const safeRow = predictions.map((game) => game.safePick).join(" ");

  const singleCount = predictions.filter((game) => game.safePick.length === 1)
    .length;
  const doubleCount = predictions.filter((game) => game.safePick.length === 2)
    .length;

  const systemRows =
    predictions.length > 0
      ? predictions.reduce((total, game) => total * game.safePick.length, 1)
      : 0;

  const basicRowCost = predictions.length > 0 ? Number(rowPrice || 0) : 0;
  const safeRowCost = systemRows * Number(rowPrice || 0);

  function copyPredictionRow() {
    navigator.clipboard.writeText(predictionRow);
    setSavedMessage("Perusrivi kopioitu.");
  }

  function copySafeRow() {
    navigator.clipboard.writeText(safeRow);
    setSavedMessage("Varmistusrivi kopioitu.");
  }

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
          koti,vieras,kotiRating,vierasRating,kotiForm,vierasForm,kotiLoukkaantumiset,vierasLoukkaantumiset,kotiFatigue,vierasFatigue,kotietu.
        </p>
      </section>

      <Panel title="AI Row Summary" subtitle="Rivin kokonaisanalyysi">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Risk Level</div>
            <div className="mt-2 text-2xl font-black text-yellow-300">
              {summary.riskLevel}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Strong Picks</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {summary.strongCount}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Low Confidence</div>
            <div className="mt-2 text-2xl font-black text-red-300">
              {summary.lowCount}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Doubles</div>
            <div className="mt-2 text-2xl font-black text-sky-300">
              {summary.doubleCount}
            </div>
          </div>
        </div>

        {summary.strongestPick && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-slate-300">
            Vahvin kohde:{" "}
            <span className="font-bold text-emerald-300">
              {summary.strongestPick.homeTeam} vs {summary.strongestPick.awayTeam}
            </span>{" "}
            — merkki {summary.strongestPick.prediction}.
          </div>
        )}

        {summary.weakestPick && (
          <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-slate-300">
            Heikoin kohde:{" "}
            <span className="font-bold text-yellow-300">
              {summary.weakestPick.homeTeam} vs {summary.weakestPick.awayTeam}
            </span>{" "}
            — harkitse varmistusta {summary.weakestPick.safePick}.
          </div>
        )}
      </Panel>

      <Panel title="Syötä pelit" subtitle="Yksi peli per rivi">
        <textarea
          value={fixturesText}
          onChange={(event) => {
            setFixturesText(event.target.value);
            setSavedMessage("");
          }}
          className="min-h-56 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none"
          placeholder="Finland,Sweden,56,58,1,2,0,1,0,1,0"
        />

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
          Esimerkki: Finland,Sweden,56,58,1,2,0,1,0,1,0
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Rivihinta €
          </div>

          <input
            type="number"
            min="0"
            step="0.05"
            value={rowPrice}
            onChange={(event) => setRowPrice(Number(event.target.value || 0))}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
          />
        </div>

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

          <button
            onClick={copyPredictionRow}
            disabled={!predictionRow}
            className="rounded-xl bg-sky-400 px-4 py-2 font-bold text-slate-950 hover:bg-sky-300 disabled:opacity-50"
          >
            Copy Basic Row
          </button>

          <button
            onClick={copySafeRow}
            disabled={!safeRow}
            className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-slate-950 hover:bg-yellow-300 disabled:opacity-50"
          >
            Copy Safe Row
          </button>
        </div>

        {predictionRow && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-300">
                Perusrivi: <span className="font-bold">{predictionRow}</span>
              </div>

              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-300">
                Varmistusrivi: <span className="font-bold">{safeRow}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">
                Singlet: <span className="font-bold">{singleCount}</span>
              </div>

              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-300">
                Varmistukset: <span className="font-bold">{doubleCount}</span>
              </div>

              <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-purple-300">
                Rivimäärä: <span className="font-bold">{systemRows}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-300">
                Perusrivin hinta:{" "}
                <span className="font-bold">{basicRowCost.toFixed(2)}€</span>
              </div>

              <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
                Varmistusrivin hinta:{" "}
                <span className="font-bold">{safeRowCost.toFixed(2)}€</span>
              </div>
            </div>
          </>
        )}

        {savedMessage && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            {savedMessage}
          </div>
        )}
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xl font-black">
                    {game.homeTeam} vs {game.awayTeam}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    Arvioitu tulos: {game.projectedScore}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    Rating:{" "}
                    <span className="font-bold text-emerald-300">
                      {game.homeRating.toFixed(1)} ({game.homeLabel})
                    </span>{" "}
                    vs{" "}
                    <span className="font-bold text-sky-300">
                      {game.awayRating.toFixed(1)} ({game.awayLabel})
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    Rating difference:{" "}
                    <span className="font-bold text-purple-300">
                      {game.ratingDifference.toFixed(1)}
                    </span>
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

                  <div className="mt-1 text-sm text-slate-400">
                    Varmistus:{" "}
                    <span className="font-bold text-yellow-300">
                      {game.safePick}
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

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-950 p-4 text-sm">
                  <div className="text-slate-400">Home form</div>
                  <div className="mt-1 font-bold">{game.factors.homeForm}</div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4 text-sm">
                  <div className="text-slate-400">Away form</div>
                  <div className="mt-1 font-bold">{game.factors.awayForm}</div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4 text-sm">
                  <div className="text-slate-400">Injuries</div>
                  <div className="mt-1 font-bold">
                    {game.factors.homeInjuries} / {game.factors.awayInjuries}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950 p-4 text-sm">
                  <div className="text-slate-400">Fatigue</div>
                  <div className="mt-1 font-bold">
                    {game.factors.homeFatigue} / {game.factors.awayFatigue}
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
