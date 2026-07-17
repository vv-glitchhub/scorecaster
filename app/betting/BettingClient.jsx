"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { SPORTS } from "../../lib/sports";
import { MARKETS } from "../../lib/markets";
import { addTrackedBet } from "../../lib/tracking-storage";
import { getSettings, saveSettings } from "../../lib/settings-storage";
import { formatPercent, formatMoney } from "../../lib/analysis-engine";
import { analyzeBetRisk } from "../../lib/risk-engine";
import { analyzeBettingGames } from "../../lib/betting-excellence-engine.mjs";
import { getOddsMovement, saveOddsSnapshots } from "../../lib/odds-movement";
import {
  saveMovementSnapshot,
  getSelectionMovementHistory,
  detectMovementSignal
} from "../../lib/movement-history";

function getGamesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.games)) return data.games;
  return [];
}

function movementShape(game) {
  return {
    id: game.id,
    home: game.homeTeam,
    away: game.awayTeam,
    market: game.marketKey,
    outcomes: game.selections.map((selection) => ({
      name: selection.selection,
      point: selection.point ?? null,
      odds: selection.odds,
      bookmaker: selection.bookmaker
    }))
  };
}

function decisionClass(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "CAUTION") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-red-400/30 bg-red-400/10 text-red-300";
}

function riskLabel(level) {
  if (level === "High") return "Korkea";
  if (level === "Medium") return "Keskitaso";
  return "Matala";
}

export default function BettingClient() {
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].group);
  const [selectedLeague, setSelectedLeague] = useState(SPORTS[0].leagues[0].key);
  const [selectedMarket, setSelectedMarket] = useState("h2h");
  const [rawGames, setRawGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("ei ladattu");
  const [reason, setReason] = useState("");
  const [selectedBet, setSelectedBet] = useState(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [bankroll, setBankroll] = useState(1000);
  const [kellyMode, setKellyMode] = useState("quarter");
  const [maxStakePercent, setMaxStakePercent] = useState(2);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setKellyMode(settings.kellyMode || "quarter");
    setMaxStakePercent(Number(settings.maxStakePercent || 2));
  }, []);

  const games = useMemo(() => analyzeBettingGames(rawGames, selectedMarket, {
    bankroll,
    kellyMode,
    maxStakePercent
  }), [rawGames, selectedMarket, bankroll, kellyMode, maxStakePercent]);

  useEffect(() => {
    void loadOdds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague, selectedMarket]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => void loadOdds(), 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedLeague, selectedMarket]);

  async function loadOdds() {
    setLoading(true);
    setReason("");
    setSelectedBet(null);
    setSavedMessage("");

    try {
      const res = await fetch(
        `/api/odds?sport=${encodeURIComponent(selectedLeague)}&markets=${encodeURIComponent(selectedMarket)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.reason || data?.error || "Kertoimia ei voitu ladata.");

      const nextRawGames = getGamesFromResponse(data);
      const nextGames = analyzeBettingGames(nextRawGames, selectedMarket, {
        bankroll,
        kellyMode,
        maxStakePercent
      });
      const movementGames = nextGames.map(movementShape);

      setRawGames(nextRawGames);
      setSource(data?.source || "api");
      setReason(data?.reason || "");
      setLastUpdated(new Date());

      setTimeout(() => {
        saveOddsSnapshots(movementGames);
        saveMovementSnapshot(movementGames);
      }, 750);
    } catch (error) {
      setRawGames([]);
      setSource("virhe");
      setReason(error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  function saveLocalSettings(nextSettings) {
    saveSettings({ ...getSettings(), ...nextSettings });
  }

  function handleSportChange(groupName) {
    const group = SPORTS.find((sport) => sport.group === groupName);
    setSelectedSport(groupName);
    if (group?.leagues?.length) setSelectedLeague(group.leagues[0].key);
  }

  function selectBet(game, selection) {
    const risk = analyzeBetRisk({
      stake: selection.suggestedStake,
      bankroll,
      edge: selection.edge,
      ev: selection.ev,
      kellyMode
    });
    const shapedMatch = movementShape(game);
    const shapedOutcome = shapedMatch.outcomes.find((item) => item.name === selection.selection && item.point === (selection.point ?? null));
    const history = shapedOutcome ? getSelectionMovementHistory(shapedMatch, shapedOutcome) : [];
    const movementSignal = detectMovementSignal(history);

    setSelectedBet({ game, selection, risk, movementSignal });
    setSavedMessage("");
  }

  function handleAddToTracking() {
    if (!selectedBet || selectedBet.selection.decision === "SKIP") return;
    const { game, selection, risk, movementSignal } = selectedBet;

    addTrackedBet({
      eventId: game.id,
      match: `${game.homeTeam} vs ${game.awayTeam}`,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      selection: selection.selection,
      odds: selection.odds,
      bookmaker: selection.bookmaker,
      sportKey: game.sportKey,
      marketKey: game.marketKey,
      edge: selection.edge,
      ev: selection.ev,
      confidence: selection.confidence,
      modelProbability: selection.consensusProbability,
      marketProbability: selection.marketProbability,
      fairOdds: selection.fairOdds,
      stake: selection.suggestedStake,
      bankroll,
      kellyMode,
      movementSignal: movementSignal.signal,
      riskLevel: risk.level,
      riskWarnings: risk.warnings,
      decision: selection.decision,
      decisionReason: selection.decisionReason,
      source: "scorecaster-betting-consensus",
      modelMode: selection.modelMode,
      edgeType: selection.edgeType,
      paperOnly: true
    });

    setSavedMessage("Kohde lisättiin paikalliseen paperiseurantaan. Oikeaa vetoa ei asetettu.");
  }

  const currentLeagues = SPORTS.find((sport) => sport.group === selectedSport)?.leagues || [];
  const allSelections = games.flatMap((game) => game.selections);
  const playCount = allSelections.filter((selection) => selection.decision === "PLAY").length;
  const cautionCount = allSelections.filter((selection) => selection.decision === "CAUTION").length;
  const skipCount = allSelections.filter((selection) => selection.decision === "SKIP").length;
  const riskColor = selectedBet?.risk?.level === "High"
    ? "text-red-300"
    : selectedBet?.risk?.level === "Medium"
      ? "text-yellow-300"
      : "text-emerald-300";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm font-black text-sky-300">
          Kohteet · no-vig-konsensus
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Päivän kohteet</h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Valitse laji, liiga ja markkina. Avaa sitten yksi kerroin nähdäksesi hinnan, päätöksen ja riskit selkeästi.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold text-slate-300">
            Laji
            <select aria-label="Valitse laji" value={selectedSport} onChange={(event) => handleSportChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {SPORTS.map((sport) => <option key={sport.group} value={sport.group}>{sport.group}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-300">
            Liiga
            <select aria-label="Valitse liiga" value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {currentLeagues.map((league) => <option key={league.key} value={league.key}>{league.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-300">
            Markkina
            <select aria-label="Valitse markkina" value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {MARKETS.map((market) => <option key={market.key} value={market.key}>{market.title}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 lg:flex-row lg:items-center lg:justify-between">
          <div>
            PLAY <span className="font-black text-emerald-300">{playCount}</span> · CAUTION <span className="font-black text-yellow-300">{cautionCount}</span> · SKIP <span className="font-black text-red-300">{skipCount}</span>
            {lastUpdated && <span className="ml-2 text-slate-500">Päivitetty {lastUpdated.toLocaleTimeString("fi-FI")}</span>}
            {reason && <div className="mt-2 text-yellow-300">{reason}</div>}
          </div>
          <button onClick={() => void loadOdds()} disabled={loading} className="rounded-xl bg-sky-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">
            {loading ? "Ladataan…" : "Päivitä kohteet"}
          </button>
        </div>

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer font-black text-slate-200">Edistyneet paperiasetukset</summary>
          <p className="mt-2 text-sm text-slate-400">Näitä ei tarvitse muuttaa ensimmäisellä käyttökerralla. Kaikki summat ovat virtuaalisia.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-bold text-slate-300">
              Panosmalli
              <select value={kellyMode} onChange={(event) => { setKellyMode(event.target.value); saveLocalSettings({ kellyMode: event.target.value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
                <option value="conservative">Erittäin varovainen</option>
                <option value="quarter">Neljännes-Kelly</option>
                <option value="half">Puoli-Kelly</option>
                <option value="full">Täysi Kelly</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-300">
              Virtuaalinen pelikassa (€)
              <input type="number" min="0" value={bankroll} onChange={(event) => { const value = Number(event.target.value || 0); setBankroll(value); saveLocalSettings({ bankroll: value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100" />
            </label>
            <label className="text-sm font-bold text-slate-300">
              Enimmäispanos (%)
              <input type="number" min="0.1" max="10" step="0.1" value={maxStakePercent} onChange={(event) => { const value = Number(event.target.value || 2); setMaxStakePercent(value); saveLocalSettings({ maxStakePercent: value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100" />
            </label>
          </div>
          <button onClick={() => setAutoRefresh((value) => !value)} className={`mt-4 rounded-xl border px-4 py-2 font-bold ${autoRefresh ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-300"}`}>
            Automaattinen päivitys {autoRefresh ? "päällä" : "pois"}
          </button>
        </details>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {!loading && games.length === 0 && (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">
              Tästä liigasta tai markkinasta ei löytynyt vähintään kahden vedonvälittäjän analysoitavaa aineistoa. Kokeile toista liigaa tai hyväksy SKIP.
            </div>
          )}
          {games.map((game) => {
            const shapedMatch = movementShape(game);
            return (
              <article key={game.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black">{game.homeTeam} vs {game.awayTeam}</h2>
                    <p className="mt-1 text-sm text-slate-400">{game.sportTitle} · {game.marketKey} · {game.bookmakerCount} vedonvälittäjää</p>
                  </div>
                  {game.commenceTime && <time className="text-sm text-slate-500">{new Date(game.commenceTime).toLocaleString("fi-FI")}</time>}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {game.selections.map((selection) => {
                    const shapedOutcome = shapedMatch.outcomes.find((item) => item.name === selection.selection && item.point === (selection.point ?? null));
                    const movement = shapedOutcome ? getOddsMovement({ match: shapedMatch, outcome: shapedOutcome }) : { direction: "none", previousOdds: null };
                    const history = shapedOutcome ? getSelectionMovementHistory(shapedMatch, shapedOutcome) : [];
                    const signal = detectMovementSignal(history);
                    const selected = selectedBet?.game?.id === game.id && selectedBet?.selection?.selection === selection.selection && selectedBet?.selection?.point === selection.point;
                    return (
                      <button
                        key={`${selection.selection}-${selection.point ?? ""}`}
                        onClick={() => selectBet(game, selection)}
                        aria-pressed={selected}
                        className={`rounded-2xl border p-4 text-left transition ${selected ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/[0.04] hover:border-sky-400/40 hover:bg-sky-400/10"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold">{selection.selection}</div>
                            <div className="mt-1 text-2xl font-black">{selection.odds.toFixed(2)}</div>
                          </div>
                          <span className={`rounded-full border px-2 py-1 text-xs font-black ${decisionClass(selection.decision)}`}>{selection.decision}</span>
                        </div>
                        <div className="mt-2 text-xs text-emerald-300">{selection.bookmaker || "Paras hinta"}</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <span>Konsensus {formatPercent(selection.consensusProbability)}</span>
                          <span>Reilu kerroin {selection.fairOdds.toFixed(2)}</span>
                          <span>Edge {formatPercent(selection.edge)}</span>
                          <span>EV {formatPercent(selection.ev)}</span>
                          <span>Datan luottamus {formatPercent(selection.confidence)}</span>
                          <span>{selection.bookmakerCount} lähdettä</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Data {selection.freshnessLabel} · liike {signal.signal} ({history.length}){movement.previousOdds ? ` · ${movement.previousOdds} → ${selection.odds}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Panel title="Paperivalinta" subtitle="Yksi analysoitu kohde kerrallaan">
            {!selectedBet ? (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">Valitse vasemmalta yksi kerroin. Näet tässä päätöksen, perustelun, paperipanoksen ja riskivaroitukset.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="font-bold">{selectedBet.game.homeTeam} vs {selectedBet.game.awayTeam}</div>
                  <div className="mt-1 text-sm text-slate-300">{selectedBet.selection.selection} @ {selectedBet.selection.odds.toFixed(2)}</div>
                  <div className="mt-2 text-sm text-emerald-300">{selectedBet.selection.bookmaker}</div>
                  <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-black ${decisionClass(selectedBet.selection.decision)}`}>{selectedBet.selection.decision}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Konsensus</div><div className="mt-1 text-xl font-black">{formatPercent(selectedBet.selection.consensusProbability)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Reilu kerroin</div><div className="mt-1 text-xl font-black">{selectedBet.selection.fairOdds.toFixed(2)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Edge / EV</div><div className="mt-1 text-lg font-black text-emerald-300">{formatPercent(selectedBet.selection.edge)} / {formatPercent(selectedBet.selection.ev)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Paperipanos</div><div className="mt-1 text-xl font-black text-sky-300">{formatMoney(selectedBet.selection.suggestedStake)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Datan luottamus</div><div className="mt-1 text-xl font-black">{formatPercent(selectedBet.selection.confidence)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Riskitaso</div><div className={`mt-1 text-xl font-black ${riskColor}`}>{riskLabel(selectedBet.risk.level)}</div></div>
                </div>

                <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-slate-200">{selectedBet.selection.decisionReason}</div>
                <div className="text-xs leading-5 text-slate-400">Hintaliike: {selectedBet.movementSignal.signal}. Liike ei ole varma tieto ottelun lopputuloksesta.</div>

                {selectedBet.risk.warnings.length > 0 && (
                  <ul className="space-y-1 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-slate-300">
                    {selectedBet.risk.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                  </ul>
                )}

                <button onClick={handleAddToTracking} disabled={selectedBet.selection.decision === "SKIP" || selectedBet.selection.suggestedStake <= 0} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                  Lisää paperiseurantaan
                </button>
                {selectedBet.selection.decision === "SKIP" && <p className="text-sm text-red-300">SKIP-kohdetta ei tallenneta. Valitse toinen kohde tai odota parempaa dataa.</p>}
                {savedMessage && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">{savedMessage}</div>}
              </div>
            )}
          </Panel>

          <Panel title="Tuotteen raja" subtitle="Mitä tällä sivulla ei tapahdu">
            <div className="space-y-2 text-sm leading-6 text-slate-300">
              <p>• Ei oikean rahan vetoa eikä siirtymistä vedonvälittäjälle.</p>
              <p>• Ei varmaa ennustetta tai tuottolupausta.</p>
              <p>• Ei pankki-, kortti- tai vedonvälittäjätietoja.</p>
              <p>• Kaikki panokset ovat virtuaalista paperiseurantaa.</p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
