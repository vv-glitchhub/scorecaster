"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
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

function Metric({ label, value, tone = "text-white" }) {
  return <div className="rounded-xl bg-white/[0.04] p-4"><div className="text-sm text-slate-400">{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div></div>;
}

export default function SimulatorClient() {
  const { tr, t, locale } = useLanguage();
  const [fixturesText, setFixturesText] = useState(defaultFixturesText);
  const [savedMessage, setSavedMessage] = useState("");
  const [rowPrice, setRowPrice] = useState(1);
  const [simulations, setSimulations] = useState(20000);
  const [seed, setSeed] = useState("scorecaster-2026");
  const currency = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

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
        // Invalid local settings are ignored.
      }
    }
  }, []);

  const parsed = useMemo(() => parseSimulatorFixtures(fixturesText, { maximumRows: 24 }), [fixturesText]);
  const preparedFixtures = useMemo(() => parsed.fixtures.map((fixture, index) => ({ ...fixture, simulations, seed: `${seed}:${index}:${fixture.seed}` })), [parsed.fixtures, simulations, seed]);
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
    setSavedMessage(tr({ fi: "Ottelut ja asetukset tallennettiin paikallisesti.", en: "Matches and settings were saved locally.", es: "Los partidos y ajustes se guardaron localmente." }));
  }
  function clearFixtures() {
    localStorage.removeItem(STORAGE_KEY);
    setFixturesText("");
    setSavedMessage(tr({ fi: "Ottelulista tyhjennettiin.", en: "The match list was cleared.", es: "Se borró la lista de partidos." }));
  }
  function loadExample() {
    setFixturesText(defaultFixturesText);
    setSavedMessage(tr({ fi: "Validoitu esimerkki ladattiin.", en: "A validated example was loaded.", es: "Se cargó un ejemplo validado." }));
  }
  async function copyText(value, label) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setSavedMessage(`${label} ${tr({ fi: "kopioitiin", en: "copied", es: "copiada" })}.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">Simulator Excellence · Seeded Poisson</div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{tr({ fi: "Toistettava ottelusimulaattori", en: "Reproducible Match Simulator", es: "Simulador de partidos reproducible" })}</h1>
        <p className="mt-3 max-w-4xl text-slate-300">{tr({ fi: "Syötteet validoidaan, sama siemen antaa saman tuloksen ja jokaiselle 1/X/2-arviolle näytetään Monte Carlo -epävarmuusväli. Tämä on skenaariotyökalu, ei varma ennuste.", en: "Inputs are validated, the same seed produces the same result and each 1/X/2 estimate includes a Monte Carlo uncertainty range. This is a scenario tool, not a certain prediction.", es: "Las entradas se validan, la misma semilla produce el mismo resultado y cada estimación 1/X/2 incluye un intervalo de incertidumbre Monte Carlo. Es una herramienta de escenarios, no una predicción segura." })}</p>
      </section>

      <Panel title={tr({ fi: "Simulaatioasetukset", en: "Simulation settings", es: "Ajustes de simulación" })} subtitle={tr({ fi: "Sama data + sama siemen = sama tulos", en: "Same data + same seed = same result", es: "Mismos datos + misma semilla = mismo resultado" })}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">{tr({ fi: "Simulaatioita per ottelu", en: "Simulations per match", es: "Simulaciones por partido" })}<input type="number" min="1000" max="100000" step="1000" value={simulations} onChange={(event) => { const value = Math.max(1000, Math.min(100000, Number(event.target.value || 20000))); setSimulations(value); persistSettings({ simulations: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">{tr({ fi: "Toistettava siemen", en: "Reproducible seed", es: "Semilla reproducible" })}<input value={seed} maxLength={80} onChange={(event) => { const value = event.target.value; setSeed(value); persistSettings({ seed: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">{tr({ fi: "Virtuaalinen rivihinta €", en: "Virtual row price €", es: "Precio virtual por fila €" })}<input type="number" min="0" max="1000" step="0.05" value={rowPrice} onChange={(event) => { const value = Math.max(0, Math.min(1000, Number(event.target.value || 0))); setRowPrice(value); persistSettings({ rowPrice: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
        </div>
      </Panel>

      <Panel title={tr({ fi: "Syötä ottelut", en: "Enter matches", es: "Introduce partidos" })} subtitle={tr({ fi: "Yksi pilkuilla eroteltu ottelu per rivi, enintään 24", en: "One comma-separated match per line, maximum 24", es: "Un partido separado por comas por línea, máximo 24" })}>
        <textarea value={fixturesText} onChange={(event) => { setFixturesText(event.target.value); setSavedMessage(""); }} className="min-h-64 w-full rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-sm text-slate-200 outline-none focus:border-sky-400/40" placeholder="Finland,Sweden,56,58,1,2,0,1,0,1,3" />
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Muoto: koti, vieras, ratingit, viime aikojen muoto, poissaolot, väsymys ja kotietu. Numerot validoidaan turvallisiin rajoihin.", en: "Format: home, away, ratings, recent form, absences, fatigue and home advantage. Numbers are validated to safe ranges.", es: "Formato: local, visitante, ratings, forma reciente, ausencias, fatiga y ventaja local. Los números se validan dentro de límites seguros." })}</div>
        {parsed.errors.length > 0 && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4"><div className="font-bold text-red-300">{tr({ fi: "Virheet", en: "Errors", es: "Errores" })}</div><ul className="mt-2 space-y-1 text-sm text-red-100">{parsed.errors.map((error) => <li key={error}>• {error}</li>)}</ul></div>}
        {parsed.warnings.length > 0 && <div className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4"><div className="font-bold text-yellow-300">{tr({ fi: "Rajatut arvot", en: "Clamped values", es: "Valores limitados" })}</div><ul className="mt-2 space-y-1 text-sm text-yellow-100">{parsed.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={saveFixtures} className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950">{tr({ fi: "Tallenna paikallisesti", en: "Save locally", es: "Guardar localmente" })}</button>
          <button onClick={loadExample} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-300">{tr({ fi: "Lataa esimerkki", en: "Load example", es: "Cargar ejemplo" })}</button>
          <button onClick={clearFixtures} className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 font-bold text-red-300">{tr({ fi: "Tyhjennä", en: "Clear", es: "Borrar" })}</button>
          <button onClick={() => void copyText(predictionRow, tr({ fi: "Perusrivi", en: "Basic row", es: "Fila básica" }))} disabled={!predictionRow || parsed.errors.length > 0} className="rounded-xl bg-sky-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">{tr({ fi: "Kopioi perusrivi", en: "Copy basic row", es: "Copiar fila básica" })}</button>
          <button onClick={() => void copyText(safeRow, tr({ fi: "Varmistusrivi", en: "Coverage row", es: "Fila de cobertura" }))} disabled={!safeRow || parsed.errors.length > 0} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-40">{tr({ fi: "Kopioi varmistusrivi", en: "Copy coverage row", es: "Copiar fila de cobertura" })}</button>
        </div>
        {savedMessage && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">{savedMessage}</div>}
      </Panel>

      <Panel title={tr({ fi: "Rivin yhteenveto", en: "Row summary", es: "Resumen de la fila" })} subtitle={tr({ fi: "Kustannus, varmistukset ja epävarmuus", en: "Cost, coverage and uncertainty", es: "Coste, cobertura e incertidumbre" })}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label={tr({ fi: "Otteluita", en: "Matches", es: "Partidos" })} value={predictions.length} />
          <Metric label={tr({ fi: "Riskitaso", en: "Risk level", es: "Nivel de riesgo" })} value={predictions.length ? summary.riskLevel : "–"} tone="text-yellow-300" />
          <Metric label={tr({ fi: "Vahvat", en: "Strong", es: "Fuertes" })} value={summary.strongCount || 0} tone="text-emerald-300" />
          <Metric label={tr({ fi: "Singlet / tuplat", en: "Singles / doubles", es: "Simples / dobles" })} value={`${singleCount} / ${doubleCount}`} />
          <Metric label={tr({ fi: "Järjestelmärivejä", en: "System rows", es: "Filas del sistema" })} value={systemCapped ? "≥1 000 000" : systemRows} tone="text-purple-300" />
          <Metric label={tr({ fi: "Arvioitu virtuaalihinta", en: "Estimated virtual cost", es: "Coste virtual estimado" })} value={systemCapped ? tr({ fi: "liian suuri", en: "too large", es: "demasiado alto" }) : currency(safeRowCost)} tone="text-red-300" />
        </div>
        {predictionRow && <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sky-200">{tr({ fi: "Perusrivi", en: "Basic row", es: "Fila básica" })}: <strong>{predictionRow}</strong> · {currency(basicRowCost)}</div><div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-yellow-200">{tr({ fi: "Varmistusrivi", en: "Coverage row", es: "Fila de cobertura" })}: <strong>{safeRow}</strong></div></div>}
        {systemRows > 256 && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{tr({ fi: "Järjestelmä kasvaa nopeasti. Suurempi kustannus ei lisää yksittäisen ottelun ennustetarkkuutta.", en: "The system grows quickly. Higher cost does not improve the prediction accuracy of an individual match.", es: "El sistema crece rápidamente. Un coste mayor no mejora la precisión de un partido individual." })}</div>}
      </Panel>

      <Panel title={tr({ fi: "Simuloidut ottelut", en: "Simulated matches", es: "Partidos simulados" })} subtitle={tr({ fi: "1 / X / 2 ja epävarmuusvälit", en: "1 / X / 2 and uncertainty ranges", es: "1 / X / 2 e intervalos de incertidumbre" })}>
        <div className="space-y-4">
          {predictions.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{tr({ fi: "Lisää vähintään yksi kelvollinen ottelu.", en: "Add at least one valid match.", es: "Añade al menos un partido válido." })}</div>}
          {predictions.map((game) => <article key={`${game.homeTeam}-${game.awayTeam}-${game.seed}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black">{game.homeTeam} vs {game.awayTeam}</h2><p className="mt-1 text-sm text-slate-400">{tr({ fi: "Projektio", en: "Projection", es: "Proyección" })} {game.projectedScore} · xG {game.expectedHomeGoals.toFixed(2)}–{game.expectedAwayGoals.toFixed(2)}</p></div><div className="flex gap-2"><span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm font-bold text-sky-300">{tr({ fi: "Merkki", en: "Pick", es: "Signo" })} {game.prediction}</span><span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-sm font-bold text-yellow-300">{game.safePick}</span></div></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3"><Metric label="1" value={`${formatPercent(game.homeWinProbability)} · ${intervalText(game.confidenceIntervals?.home)}`} /><Metric label="X" value={`${formatPercent(game.drawProbability)} · ${intervalText(game.confidenceIntervals?.draw)}`} /><Metric label="2" value={`${formatPercent(game.awayWinProbability)} · ${intervalText(game.confidenceIntervals?.away)}`} /></div>
          </article>)}
        </div>
      </Panel>

      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">{tr({ fi: "Simulaatio käyttää vain syötettyä numeerista dataa. Se ei tunne uutisia, kokoonpanoja tai loukkaantumisia, ellei niitä ole kuvattu syötteessä.", en: "The simulation uses only the numeric data you enter. It does not know news, lineups or injuries unless represented in the input.", es: "La simulación usa solo los datos numéricos introducidos. No conoce noticias, alineaciones ni lesiones salvo que estén representadas en la entrada." })}</div>
    </div>
  );
}
