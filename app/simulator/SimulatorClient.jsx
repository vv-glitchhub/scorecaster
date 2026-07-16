"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { formatPercent } from "../../lib/analysis-engine";
import { predictFixtures } from "../../lib/prediction-slip-engine";
import { summarizePredictionSlip } from "../../lib/prediction-summary-engine";
import { parseSimulatorFixtures } from "../../lib/simulator-input-engine.mjs";

const STORAGE_KEY = "scorecaster_prediction_fixtures_v2";
const SETTINGS_KEY = "scorecaster_simulator_settings_v2";

const defaultFixturesText = [
  "Brazil,Germany,60,58,1,0,0,1,0,0,3",
  "France,Argentina,61,60,1,1,0,0,0,0,3",
  "Spain,Netherlands,59,57,0,1,1,0,0,1,3"
].join("\n");

function intervalText(interval) {
  if (!interval) return "–";
  return `${formatPercent(interval.low)}–${formatPercent(interval.high)}`;
}

function safeSystemRows(predictions) {
  let rows = 1;
  for (const game of predictions) {
    rows *= Math.max(1, game.safePick.length);
    if (!Number.isFinite(rows) || rows > 1_000_000) return 1_000_000;
  }
  return predictions.length ? rows : 0;
}

export default function SimulatorClient() {
  const [fixturesText, setFixturesText] = useState(defaultFixturesText);
  const [savedMessage, setSavedMessage] = useState("");
  const [rowPrice, setRowPrice] = useState(1);
  const [simulations, setSimulations] = useState(20000);
  const [seed, setSeed] = useState("scorecaster-2026");

  useEffect(() => {
    const savedFixtures = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedFixtures) setFixturesText(savedFixtures);
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setRowPrice(Number(settings.rowPrice || 1));
        setSimulations(Number(settings.simulations || 20000));
        setSeed(String(settings.seed || "scorecaster-2026"));
      } catch {
        // Invalid local settings are ignored and safe defaults remain active.
      }
    }
  }, []);

  const parsed = useMemo(() => parseSimulatorFixtures(fixturesText, { maximumRows: 24 }), [fixturesText]);
  const preparedFixtures = useMemo(() => parsed.fixtures.map((fixture, index) => ({
    ...fixture,
    simulations,
    seed: `${seed}:${index}:${fixture.seed}`
  })), [parsed.fixtures, simulations, seed]);
  const predictions = useMemo(() => predictFixtures(preparedFixtures), [preparedFixtures]);
  const summary = useMemo(() => summarizePredictionSlip(predictions), [predictions]);

  const predictionRow = predictions.map((game) => game.prediction).join(" ");
  const safeRow = predictions.map((game) => game.safePick).join(" ");
  const singleCount = predictions.filter((game) => game.safePick.length === 1).length;
  const doubleCount = predictions.filter((game) => game.safePick.length === 2).length;
  const systemRows = safeSystemRows(predictions);
  const basicRowCost = predictions.length > 0 ? Math.max(0, Number(rowPrice || 0)) : 0;
  const safeRowCost = systemRows * Math.max(0, Number(rowPrice || 0));
  const systemCapped = systemRows >= 1_000_000;

  function persistSettings(next = {}) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ rowPrice, simulations, seed, ...next }));
  }

  function saveFixtures() {
    localStorage.setItem(STORAGE_KEY, fixturesText);
    persistSettings();
    setSavedMessage("Pelit ja simulaatioasetukset tallennettu paikallisesti.");
  }

  function clearFixtures() {
    localStorage.removeItem(STORAGE_KEY);
    setFixturesText("");
    setSavedMessage("Pelilista tyhjennetty.");
  }

  function loadExample() {
    setFixturesText(defaultFixturesText);
    setSavedMessage("Validoitu esimerkkilista ladattu.");
  }

  async function copyText(value, label) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setSavedMessage(`${label} kopioitu.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Simulator Excellence · Seeded Poisson
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Reproducible Match Simulator</h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Syötteet validoidaan, simulaatio käyttää toistettavaa siementä ja jokaiselle 1/X/2-todennäköisyydelle näytetään 95 prosentin Monte Carlo -epävarmuusväli. Tämä on skenaariotyökalu, ei varma ennuste.
        </p>
      </section>

      <Panel title="Simulaatioasetukset" subtitle="Sama data + sama siemen = sama tulos">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Simulaatioita per ottelu
            <input type="number" min="1000" max="100000" step="1000" value={simulations} onChange={(event) => { const value = Math.max(1000, Math.min(100000, Number(event.target.value || 20000))); setSimulations(value); persistSettings({ simulations: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Toistettava siemen
            <input value={seed} maxLength={80} onChange={(event) => { const value = event.target.value; setSeed(value); persistSettings({ seed: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Rivihinta €
            <input type="number" min="0" max="1000" step="0.05" value={rowPrice} onChange={(event) => { const value = Math.max(0, Math.min(1000, Number(event.target.value || 0))); setRowPrice(value); persistSettings({ rowPrice: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
        </div>
      </Panel>

      <Panel title="Syötä ottelut" subtitle="Yksi pilkuilla eroteltu ottelu per rivi, enintään 24">
        <textarea value={fixturesText} onChange={(event) => { setFixturesText(event.target.value); setSavedMessage(""); }} className="min-h-64 w-full rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-sm text-slate-200 outline-none focus:border-sky-400/40" placeholder="Finland,Sweden,56,58,1,2,0,1,0,1,3" />
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
          Muoto: koti, vieras, kotiRating 0–100, vierasRating 0–100, kotiForm −10–10, vierasForm, kotiLoukkaantumiset 0–10, vierasLoukkaantumiset, kotiFatigue 0–10, vierasFatigue, kotietu −15–15.
        </div>

        {parsed.errors.length > 0 && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4"><div className="font-bold text-red-300">Virheet</div><ul className="mt-2 space-y-1 text-sm text-red-100">{parsed.errors.map((error) => <li key={error}>• {error}</li>)}</ul></div>}
        {parsed.warnings.length > 0 && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4"><div className="font-bold text-yellow-300">Rajatut arvot</div><ul className="mt-2 space-y-1 text-sm text-yellow-100">{parsed.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={saveFixtures} className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950">Tallenna paikallisesti</button>
          <button onClick={loadExample} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300">Lataa esimerkki</button>
          <button onClick={clearFixtures} className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300">Tyhjennä</button>
          <button onClick={() => void copyText(predictionRow, "Perusrivi")} disabled={!predictionRow || parsed.errors.length > 0} className="rounded-xl bg-sky-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">Kopioi perusrivi</button>
          <button onClick={() => void copyText(safeRow, "Varmistusrivi")} disabled={!safeRow || parsed.errors.length > 0} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">Kopioi varmistusrivi</button>
        </div>
        {savedMessage && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">{savedMessage}</div>}
      </Panel>

      <Panel title="Rivin yhteenveto" subtitle="Kustannus, varmistukset ja epävarmuus">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Otteluita</div><div className="mt-1 text-2xl font-black">{predictions.length}</div></div>
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Riskitaso</div><div className="mt-1 text-2xl font-black text-yellow-300">{predictions.length ? summary.riskLevel : "–"}</div></div>
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Vahvat</div><div className="mt-1 text-2xl font-black text-emerald-300">{summary.strongCount || 0}</div></div>
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Singlet / tuplat</div><div className="mt-1 text-2xl font-black">{singleCount} / {doubleCount}</div></div>
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Järjestelmärivejä</div><div className="mt-1 text-2xl font-black text-purple-300">{systemCapped ? "≥1 000 000" : systemRows}</div></div>
          <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">Arvioitu hinta</div><div className="mt-1 text-2xl font-black text-red-300">{systemCapped ? "liian suuri" : `${safeRowCost.toFixed(2)}€`}</div></div>
        </div>

        {predictionRow && <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sky-200">Perusrivi: <strong>{predictionRow}</strong> · {basicRowCost.toFixed(2)}€</div><div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-200">Varmistusrivi: <strong>{safeRow}</strong></div></div>}
        {systemRows > 256 && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">Järjestelmä kasvaa nopeasti. Kustannus ei lisää yksittäisen ottelun ennustetarkkuutta; se vain kattaa useampia merkkiyhdistelmiä.</div>}
      </Panel>

      <Panel title="Simuloidut ottelut" subtitle="1 / X / 2 ja 95 % epävarmuusvälit">
        <div className="space-y-4">
          {predictions.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Lisää vähintään yksi kelvollinen ottelu.</div>}
          {predictions.map((game) => (
            <article key={`${game.homeTeam}-${game.awayTeam}-${game.seed}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">{game.homeTeam} vs {game.awayTeam}</h2>
                  <p className="mt-1 text-sm text-slate-400">Projektio {game.projectedScore} · odotetut maalit {game.expectedHomeGoals.toFixed(2)}–{game.expectedAwayGoals.toFixed(2)}</p>
                </div>
                <div className="flex gap-2"><span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm font-bold text-sky-300">Merkki {game.prediction}</span><span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-sm font-bold text-yellow-300">{game.safePick}</span></div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-sm text-slate-400">1 · {game.homeTeam}</div><div className="mt-1 text-2xl font-black">{formatPercent(game.homeWinProbability)}</div><div className="mt-1 text-xs text-slate-500">95 %: {intervalText(game.homeWinInterval)}</div></div>
                <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-sm text-slate-400">X · tasapeli</div><div className="mt-1 text-2xl font-black">{formatPercent(game.drawProbability)}</div><div className="mt-1 text-xs text-slate-500">95 %: {intervalText(game.drawInterval)}</div></div>
                <div className="rounded-xl bg-slate-950/60 p-4"><div className="text-sm text-slate-400">2 · {game.awayTeam}</div><div className="mt-1 text-2xl font-black">{formatPercent(game.awayWinProbability)}</div><div className="mt-1 text-xs text-slate-500">95 %: {intervalText(game.awayWinInterval)}</div></div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                Confidence <strong>{game.confidence}</strong> · suositus <strong>{game.recommendation}</strong> · {game.confidenceNote}
              </div>
              <div className="mt-2 text-xs text-slate-500">{game.simulations.toLocaleString("fi-FI")} ajoa · toistettava siemen tallennettu · malli {game.modelMode}</div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Mallin rajat" subtitle="Miten tuloksia pitää tulkita">
        <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-300">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">Ratingit, formi, loukkaantumiset ja fatigue ovat käyttäjän syöttämiä oletuksia. Väärä syöte tuottaa täsmällisen näköisen mutta väärän tuloksen.</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">95 prosentin väli kuvaa vain Monte Carlo -otantavirhettä. Se ei sisällä kaikkia mallivirheitä, uutisia tai urheilun yllätyksiä.</div>
        </div>
      </Panel>
    </div>
  );
}
