"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { useLanguage } from "../components/LanguageProvider";
import { SPORTS } from "../../lib/sports";
import { MARKETS } from "../../lib/markets";
import { addTrackedBet } from "../../lib/tracking-storage";
import { getSettings, saveSettings } from "../../lib/settings-storage";
import { formatPercent } from "../../lib/analysis-engine";
import { analyzeBetRisk } from "../../lib/risk-engine";
import { analyzeBettingGames } from "../../lib/betting-excellence-engine.mjs";
import { getOddsMovement, saveOddsSnapshots } from "../../lib/odds-movement";
import { saveMovementSnapshot, getSelectionMovementHistory, detectMovementSignal } from "../../lib/movement-history";

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

export default function BettingClient() {
  const { tr, t, locale } = useLanguage();
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].group);
  const [selectedLeague, setSelectedLeague] = useState(SPORTS[0].leagues[0].key);
  const [selectedMarket, setSelectedMarket] = useState("h2h");
  const [rawGames, setRawGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("not-loaded");
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
      const res = await fetch(`/api/odds?sport=${encodeURIComponent(selectedLeague)}&markets=${encodeURIComponent(selectedMarket)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.reason || data?.error || tr({ fi: "Kertoimia ei voitu ladata.", en: "Odds could not be loaded.", es: "No se pudieron cargar las cuotas." }));

      const nextRawGames = getGamesFromResponse(data);
      const nextGames = analyzeBettingGames(nextRawGames, selectedMarket, { bankroll, kellyMode, maxStakePercent });
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
      setSource("error");
      setReason(error instanceof Error ? error.message : tr({ fi: "Tuntematon virhe", en: "Unknown error", es: "Error desconocido" }));
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
    const risk = analyzeBetRisk({ stake: selection.suggestedStake, bankroll, edge: selection.edge, ev: selection.ev, kellyMode });
    const shapedMatch = movementShape(game);
    const shapedOutcome = shapedMatch.outcomes.find((item) => item.name === selection.selection && item.point === (selection.point ?? null));
    const history = shapedOutcome ? getSelectionMovementHistory(shapedMatch, shapedOutcome) : [];
    setSelectedBet({ game, selection, risk, movementSignal: detectMovementSignal(history) });
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

    setSavedMessage(tr({
      fi: "Kohde lisättiin paikalliseen paperiseurantaan. Oikeaa vetoa ei asetettu.",
      en: "The pick was added to local paper tracking. No real bet was placed.",
      es: "El pronóstico se añadió al seguimiento simulado local. No se realizó ninguna apuesta real."
    }));
  }

  const currentLeagues = SPORTS.find((sport) => sport.group === selectedSport)?.leagues || [];
  const allSelections = games.flatMap((game) => game.selections);
  const playCount = allSelections.filter((selection) => selection.decision === "PLAY").length;
  const cautionCount = allSelections.filter((selection) => selection.decision === "CAUTION").length;
  const skipCount = allSelections.filter((selection) => selection.decision === "SKIP").length;
  const riskColor = selectedBet?.risk?.level === "High" ? "text-red-300" : selectedBet?.risk?.level === "Medium" ? "text-yellow-300" : "text-emerald-300";
  const riskLabel = (level) => level === "High"
    ? tr({ fi: "Korkea", en: "High", es: "Alto" })
    : level === "Medium"
      ? tr({ fi: "Keskitaso", en: "Medium", es: "Medio" })
      : tr({ fi: "Matala", en: "Low", es: "Bajo" });
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm font-black text-sky-300">{t("nav.picks")} · no-vig</div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{tr({ fi: "Päivän kohteet", en: "Today's picks", es: "Pronósticos de hoy" })}</h1>
        <p className="mt-3 max-w-4xl text-slate-300">{tr({
          fi: "Valitse laji, liiga ja markkina. Avaa sitten yksi kerroin nähdäksesi hinnan, päätöksen ja riskit selkeästi.",
          en: "Choose a sport, league and market. Then open one price to see the value, decision and risks clearly.",
          es: "Elige deporte, liga y mercado. Después abre una cuota para ver claramente el valor, la decisión y los riesgos."
        })}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Laji", en: "Sport", es: "Deporte" })}
            <select aria-label={tr({ fi: "Valitse laji", en: "Choose sport", es: "Elegir deporte" })} value={selectedSport} onChange={(event) => handleSportChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {SPORTS.map((sport) => <option key={sport.group} value={sport.group}>{sport.group}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Liiga", en: "League", es: "Liga" })}
            <select aria-label={tr({ fi: "Valitse liiga", en: "Choose league", es: "Elegir liga" })} value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {currentLeagues.map((league) => <option key={league.key} value={league.key}>{league.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-300">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}
            <select aria-label={tr({ fi: "Valitse markkina", en: "Choose market", es: "Elegir mercado" })} value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
              {MARKETS.map((market) => <option key={market.key} value={market.key}>{market.title}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 lg:flex-row lg:items-center lg:justify-between">
          <div>
            PLAY <span className="font-black text-emerald-300">{playCount}</span> · CAUTION <span className="font-black text-yellow-300">{cautionCount}</span> · SKIP <span className="font-black text-red-300">{skipCount}</span>
            {lastUpdated && <span className="ml-2 text-slate-500">{tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })} {lastUpdated.toLocaleTimeString(locale)}</span>}
            {reason && <div className="mt-2 text-yellow-300">{reason}</div>}
          </div>
          <button onClick={() => void loadOdds()} disabled={loading} className="rounded-xl bg-sky-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">{loading ? t("common.loading") : tr({ fi: "Päivitä kohteet", en: "Refresh picks", es: "Actualizar pronósticos" })}</button>
        </div>

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer font-black text-slate-200">{tr({ fi: "Edistyneet paperiasetukset", en: "Advanced paper settings", es: "Ajustes simulados avanzados" })}</summary>
          <p className="mt-2 text-sm text-slate-400">{tr({ fi: "Näitä ei tarvitse muuttaa ensimmäisellä käyttökerralla. Kaikki summat ovat virtuaalisia.", en: "You do not need to change these during your first session. All amounts are virtual.", es: "No necesitas cambiar estos valores en la primera sesión. Todos los importes son virtuales." })}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-bold text-slate-300">{tr({ fi: "Panosmalli", en: "Stake model", es: "Modelo de importe" })}
              <select value={kellyMode} onChange={(event) => { setKellyMode(event.target.value); saveLocalSettings({ kellyMode: event.target.value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100">
                <option value="conservative">{tr({ fi: "Erittäin varovainen", en: "Very conservative", es: "Muy conservador" })}</option>
                <option value="quarter">Quarter Kelly</option>
                <option value="half">Half Kelly</option>
                <option value="full">Full Kelly</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-300">{t("term.bankroll")} (€)
              <input type="number" min="0" value={bankroll} onChange={(event) => { const value = Number(event.target.value || 0); setBankroll(value); saveLocalSettings({ bankroll: value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100" />
            </label>
            <label className="text-sm font-bold text-slate-300">{tr({ fi: "Enimmäispanos (%)", en: "Maximum stake (%)", es: "Importe máximo (%)" })}
              <input type="number" min="0.1" max="10" step="0.1" value={maxStakePercent} onChange={(event) => { const value = Number(event.target.value || 2); setMaxStakePercent(value); saveLocalSettings({ maxStakePercent: value }); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100" />
            </label>
          </div>
          <button onClick={() => setAutoRefresh((value) => !value)} className={`mt-4 rounded-xl border px-4 py-2 font-bold ${autoRefresh ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-slate-300"}`}>
            {tr({ fi: "Automaattinen päivitys", en: "Automatic refresh", es: "Actualización automática" })} {autoRefresh ? tr({ fi: "päällä", en: "on", es: "activada" }) : tr({ fi: "pois", en: "off", es: "desactivada" })}
          </button>
        </details>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {!loading && games.length === 0 && <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-yellow-100">{tr({ fi: "Tästä liigasta tai markkinasta ei löytynyt riittävää aineistoa. Kokeile toista liigaa tai hyväksy SKIP.", en: "This league or market does not have enough data. Try another league or accept SKIP.", es: "Esta liga o mercado no tiene datos suficientes. Prueba otra liga o acepta SKIP." })}</div>}
          {games.map((game) => {
            const shapedMatch = movementShape(game);
            return (
              <article key={game.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div><h2 className="text-xl font-black">{game.homeTeam} vs {game.awayTeam}</h2><p className="mt-1 text-sm text-slate-400">{game.sportTitle} · {game.marketKey} · {game.bookmakerCount} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })}</p></div>
                  {game.commenceTime && <time className="text-sm text-slate-500">{new Date(game.commenceTime).toLocaleString(locale)}</time>}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {game.selections.map((selection) => {
                    const shapedOutcome = shapedMatch.outcomes.find((item) => item.name === selection.selection && item.point === (selection.point ?? null));
                    const movement = shapedOutcome ? getOddsMovement({ match: shapedMatch, outcome: shapedOutcome }) : { previousOdds: null };
                    const history = shapedOutcome ? getSelectionMovementHistory(shapedMatch, shapedOutcome) : [];
                    const signal = detectMovementSignal(history);
                    const selected = selectedBet?.game?.id === game.id && selectedBet?.selection?.selection === selection.selection && selectedBet?.selection?.point === selection.point;
                    return (
                      <button key={`${selection.selection}-${selection.point ?? ""}`} onClick={() => selectBet(game, selection)} aria-pressed={selected} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/[0.04] hover:border-sky-400/40 hover:bg-sky-400/10"}`}>
                        <div className="flex items-start justify-between gap-3"><div><div className="font-bold">{selection.selection}</div><div className="mt-1 text-2xl font-black">{selection.odds.toFixed(2)}</div></div><span className={`rounded-full border px-2 py-1 text-xs font-black ${decisionClass(selection.decision)}`}>{selection.decision}</span></div>
                        <div className="mt-2 text-xs text-emerald-300">{selection.bookmaker || tr({ fi: "Paras hinta", en: "Best price", es: "Mejor cuota" })}</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                          <span>{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} {formatPercent(selection.consensusProbability)}</span>
                          <span>{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} {selection.fairOdds.toFixed(2)}</span>
                          <span>{t("term.edge")} {formatPercent(selection.edge)}</span><span>{t("term.ev")} {formatPercent(selection.ev)}</span>
                          <span>{t("term.confidence")} {formatPercent(selection.confidence)}</span><span>{selection.bookmakerCount} {tr({ fi: "lähdettä", en: "sources", es: "fuentes" })}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{tr({ fi: "Data", en: "Data", es: "Datos" })} {selection.freshnessLabel} · {tr({ fi: "liike", en: "movement", es: "movimiento" })} {signal.signal} ({history.length}){movement.previousOdds ? ` · ${movement.previousOdds} → ${selection.odds}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Panel title={tr({ fi: "Paperivalinta", en: "Paper selection", es: "Selección simulada" })} subtitle={tr({ fi: "Yksi analysoitu kohde kerrallaan", en: "One analyzed pick at a time", es: "Un pronóstico analizado cada vez" })}>
            {!selectedBet ? <div className="rounded-xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">{tr({ fi: "Valitse vasemmalta yksi kerroin. Näet päätöksen, perustelun, paperipanoksen ja riskit.", en: "Choose one price on the left to see the decision, reasoning, paper stake and risks.", es: "Elige una cuota a la izquierda para ver la decisión, los motivos, el importe simulado y los riesgos." })}</div> : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.04] p-4"><div className="font-bold">{selectedBet.game.homeTeam} vs {selectedBet.game.awayTeam}</div><div className="mt-1 text-sm text-slate-300">{selectedBet.selection.selection} @ {selectedBet.selection.odds.toFixed(2)}</div><div className="mt-2 text-sm text-emerald-300">{selectedBet.selection.bookmaker}</div><div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-black ${decisionClass(selectedBet.selection.decision)}`}>{selectedBet.selection.decision}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })}</div><div className="mt-1 text-xl font-black">{formatPercent(selectedBet.selection.consensusProbability)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })}</div><div className="mt-1 text-xl font-black">{selectedBet.selection.fairOdds.toFixed(2)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{t("term.edge")} / {t("term.ev")}</div><div className="mt-1 text-lg font-black text-emerald-300">{formatPercent(selectedBet.selection.edge)} / {formatPercent(selectedBet.selection.ev)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{t("term.paperStake")}</div><div className="mt-1 text-xl font-black text-sky-300">{money(selectedBet.selection.suggestedStake)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{t("term.confidence")}</div><div className="mt-1 text-xl font-black">{formatPercent(selectedBet.selection.confidence)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">{tr({ fi: "Riskitaso", en: "Risk level", es: "Nivel de riesgo" })}</div><div className={`mt-1 text-xl font-black ${riskColor}`}>{riskLabel(selectedBet.risk.level)}</div></div>
                </div>
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-6 text-slate-200">{selectedBet.selection.decisionReason}</div>
                <div className="text-xs leading-5 text-slate-400">{tr({ fi: "Hintaliike ei ole varma tieto ottelun lopputuloksesta.", en: "Price movement is not certain information about the match result.", es: "El movimiento de la cuota no es información segura sobre el resultado." })}</div>
                {selectedBet.risk.warnings.length > 0 && <ul className="space-y-1 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-slate-300">{selectedBet.risk.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
                <button onClick={handleAddToTracking} disabled={selectedBet.selection.decision === "SKIP" || selectedBet.selection.suggestedStake <= 0} className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{tr({ fi: "Lisää paperiseurantaan", en: "Add to paper tracking", es: "Añadir al seguimiento simulado" })}</button>
                {selectedBet.selection.decision === "SKIP" && <p className="text-sm text-red-300">{tr({ fi: "SKIP-kohdetta ei tallenneta. Valitse toinen kohde tai odota parempaa dataa.", en: "A SKIP pick is not saved. Choose another pick or wait for better data.", es: "Un pronóstico SKIP no se guarda. Elige otro o espera mejores datos." })}</p>}
                {savedMessage && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-300">{savedMessage}</div>}
              </div>
            )}
          </Panel>

          <Panel title={tr({ fi: "Tuotteen raja", en: "Product boundary", es: "Límite del producto" })} subtitle={tr({ fi: "Mitä tällä sivulla ei tapahdu", en: "What does not happen on this page", es: "Lo que no ocurre en esta página" })}>
            <div className="space-y-2 text-sm leading-6 text-slate-300">
              <p>• {tr({ fi: "Ei oikean rahan vetoa eikä siirtymistä vedonvälittäjälle.", en: "No real-money bet and no bookmaker redirect.", es: "Sin apuestas con dinero real ni redirección a casas de apuestas." })}</p>
              <p>• {tr({ fi: "Ei varmaa ennustetta tai tuottolupausta.", en: "No certain prediction or profit promise.", es: "Sin predicción segura ni promesa de beneficios." })}</p>
              <p>• {tr({ fi: "Ei pankki-, kortti- tai vedonvälittäjätietoja.", en: "No bank, card or bookmaker account data.", es: "Sin datos bancarios, de tarjeta ni cuentas de apuestas." })}</p>
              <p>• {tr({ fi: "Kaikki panokset ovat virtuaalista paperiseurantaa.", en: "All stakes are virtual paper tracking.", es: "Todos los importes pertenecen al seguimiento simulado." })}</p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
