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
import {
  BOOKMAKER_ALL,
  analyzeBettingGames,
  rankBettingSelections,
  sortBettingGames
} from "../../lib/betting-excellence-engine.mjs";
import { getBookmakerCatalog } from "../../lib/market-consensus-engine.mjs";
import { getOddsMovement, saveOddsSnapshots } from "../../lib/odds-movement";
import { saveMovementSnapshot, getSelectionMovementHistory, detectMovementSignal } from "../../lib/movement-history";
import {
  DecisionBadge,
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

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

export default function BettingClient() {
  const { tr, t, locale } = useLanguage();
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].group);
  const [selectedLeague, setSelectedLeague] = useState(SPORTS[0].leagues[0].key);
  const [selectedMarket, setSelectedMarket] = useState("h2h");
  const [selectedBookmaker, setSelectedBookmaker] = useState(BOOKMAKER_ALL);
  const [sortMode, setSortMode] = useState("ev");
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
    setSelectedBookmaker(settings.bookmakerKey || BOOKMAKER_ALL);
    setSortMode(settings.bookmakerSort || "ev");
  }, []);

  const bookmakerCatalog = useMemo(
    () => getBookmakerCatalog(rawGames, selectedMarket),
    [rawGames, selectedMarket]
  );

  const games = useMemo(() => analyzeBettingGames(rawGames, selectedMarket, {
    bankroll,
    kellyMode,
    maxStakePercent,
    bookmakerKey: selectedBookmaker
  }), [rawGames, selectedMarket, bankroll, kellyMode, maxStakePercent, selectedBookmaker]);

  const sortedGames = useMemo(
    () => sortBettingGames(games, sortMode),
    [games, sortMode]
  );

  const rankedSelections = useMemo(
    () => rankBettingSelections(games, sortMode),
    [games, sortMode]
  );

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

  useEffect(() => {
    if (selectedBookmaker === BOOKMAKER_ALL || rawGames.length === 0) return;
    if (!bookmakerCatalog.some((bookmaker) => bookmaker.key === selectedBookmaker)) {
      setSelectedBookmaker(BOOKMAKER_ALL);
      saveLocalSettings({ bookmakerKey: BOOKMAKER_ALL });
    }
  }, [bookmakerCatalog, rawGames.length, selectedBookmaker]);

  useEffect(() => {
    setSelectedBet(null);
    setSavedMessage("");
  }, [selectedBookmaker, sortMode]);

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
      const nextGames = analyzeBettingGames(nextRawGames, selectedMarket, {
        bankroll,
        kellyMode,
        maxStakePercent,
        bookmakerKey: selectedBookmaker
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

  function handleBookmakerChange(bookmakerKey) {
    setSelectedBookmaker(bookmakerKey);
    saveLocalSettings({ bookmakerKey });
  }

  function handleSortChange(nextSortMode) {
    setSortMode(nextSortMode);
    saveLocalSettings({ bookmakerSort: nextSortMode });
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
      bookmakerKey: selection.bookmakerKey,
      bestMarketOdds: selection.bestMarketOdds,
      bestMarketBookmaker: selection.bestMarketBookmaker,
      priceGapToBest: selection.priceGapToBest,
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
      fi: "Kohde lisättiin paperisalkkuun. Oikeaa vetoa ei asetettu.",
      en: "The pick was added to the paper portfolio. No real bet was placed.",
      es: "El pronóstico se añadió a la cartera simulada. No se realizó ninguna apuesta real."
    }));
  }

  const currentLeagues = SPORTS.find((sport) => sport.group === selectedSport)?.leagues || [];
  const allSelections = games.flatMap((game) => game.selections);
  const playCount = allSelections.filter((selection) => selection.decision === "PLAY").length;
  const cautionCount = allSelections.filter((selection) => selection.decision === "CAUTION").length;
  const skipCount = allSelections.filter((selection) => selection.decision === "SKIP").length;
  const currentBookmaker = bookmakerCatalog.find((bookmaker) => bookmaker.key === selectedBookmaker);
  const providerLabel = selectedBookmaker === BOOKMAKER_ALL
    ? tr({ fi: "Kaikki yhtiöt – paras kerroin", en: "All bookmakers – best price", es: "Todas las casas – mejor cuota" })
    : currentBookmaker?.title || selectedBookmaker;
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const riskLabel = (level) => level === "High"
    ? tr({ fi: "Korkea", en: "High", es: "Alto" })
    : level === "Medium"
      ? tr({ fi: "Keskitaso", en: "Medium", es: "Medio" })
      : tr({ fi: "Matala", en: "Low", es: "Bajo" });

  const sortLabel = sortMode === "edge"
    ? t("term.edge")
    : sortMode === "confidence"
      ? t("term.confidence")
      : sortMode === "odds"
        ? tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })
        : sortMode === "kickoff"
          ? tr({ fi: "Alkamisaika", en: "Kickoff", es: "Hora de inicio" })
          : t("term.ev");

  const heroAside = (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{tr({ fi: "Markkinan yhteenveto", en: "Market summary", es: "Resumen del mercado" })}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricTile compact label="PLAY" value={playCount} tone="green" />
        <MetricTile compact label="CAUTION" value={cautionCount} tone="yellow" />
        <MetricTile compact label="SKIP" value={skipCount} tone="red" />
      </div>
    </div>
  );

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow={tr({ fi: "Bookmaker Hub", en: "Bookmaker Hub", es: "Centro de casas" })}
        title={tr({ fi: "Valitse peliyhtiö tai etsi paras hinta koko markkinasta", en: "Choose a bookmaker or find the best price across the market", es: "Elige una casa o encuentra la mejor cuota del mercado" })}
        description={tr({
          fi: "Scorecaster laskee markkinakonsensuksen kaikista saatavilla olevista yhtiöistä, mutta arvioi EV:n ja päätöksen juuri sillä hinnalla, jonka käyttäjä on valinnut.",
          en: "Scorecaster calculates consensus from every available bookmaker while evaluating EV and the decision at the exact price the user selected.",
          es: "Scorecaster calcula el consenso con todas las casas disponibles y evalúa el EV y la decisión con la cuota exacta elegida."
        })}
        actions={
          <button onClick={() => void loadOdds()} disabled={loading} className="sc-button-primary">
            {loading ? t("common.loading") : tr({ fi: "Päivitä live-kohteet", en: "Refresh live picks", es: "Actualizar pronósticos" })}
          </button>
        }
        aside={heroAside}
      />

      <Panel
        title={tr({ fi: "Rajaa ja järjestä markkina", en: "Filter and rank the market", es: "Filtrar y ordenar el mercado" })}
        subtitle={tr({ fi: "Valitse laji, liiga, markkina, peliyhtiö ja järjestys. Valinta tallennetaan tähän laitteeseen.", en: "Choose sport, league, market, bookmaker and ranking. The choice is saved on this device.", es: "Elige deporte, liga, mercado, casa y orden. La selección se guarda en este dispositivo." })}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-black text-slate-300">{tr({ fi: "Laji", en: "Sport", es: "Deporte" })}
            <select aria-label={tr({ fi: "Valitse laji", en: "Choose sport", es: "Elegir deporte" })} value={selectedSport} onChange={(event) => handleSportChange(event.target.value)} className="sc-input mt-2">
              {SPORTS.map((sport) => <option key={sport.group} value={sport.group}>{sport.group}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-slate-300">{tr({ fi: "Liiga", en: "League", es: "Liga" })}
            <select aria-label={tr({ fi: "Valitse liiga", en: "Choose league", es: "Elegir liga" })} value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)} className="sc-input mt-2">
              {currentLeagues.map((league) => <option key={league.key} value={league.key}>{league.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-slate-300">{tr({ fi: "Markkina", en: "Market", es: "Mercado" })}
            <select aria-label={tr({ fi: "Valitse markkina", en: "Choose market", es: "Elegir mercado" })} value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)} className="sc-input mt-2">
              {MARKETS.map((market) => <option key={market.key} value={market.key}>{market.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-slate-300">{tr({ fi: "Peliyhtiö", en: "Bookmaker", es: "Casa" })}
            <select aria-label={tr({ fi: "Valitse peliyhtiö", en: "Choose bookmaker", es: "Elegir casa" })} value={selectedBookmaker} onChange={(event) => handleBookmakerChange(event.target.value)} className="sc-input mt-2">
              <option value={BOOKMAKER_ALL}>{tr({ fi: "Kaikki – paras kerroin", en: "All – best price", es: "Todas – mejor cuota" })}</option>
              {bookmakerCatalog.map((bookmaker) => <option key={bookmaker.key} value={bookmaker.key}>{bookmaker.title} ({bookmaker.eventCount})</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-slate-300">{tr({ fi: "Järjestä", en: "Rank by", es: "Ordenar por" })}
            <select aria-label={tr({ fi: "Valitse järjestys", en: "Choose ranking", es: "Elegir orden" })} value={sortMode} onChange={(event) => handleSortChange(event.target.value)} className="sc-input mt-2">
              <option value="ev">{tr({ fi: "Paras EV", en: "Best EV", es: "Mejor EV" })}</option>
              <option value="edge">{tr({ fi: "Suurin edge", en: "Largest edge", es: "Mayor ventaja" })}</option>
              <option value="confidence">{tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })}</option>
              <option value="odds">{tr({ fi: "Korkein kerroin", en: "Highest odds", es: "Cuota más alta" })}</option>
              <option value="kickoff">{tr({ fi: "Alkamisaika", en: "Kickoff", es: "Hora de inicio" })}</option>
            </select>
          </label>
        </div>

        <TrustBar className="mt-5" items={[
          { label: tr({ fi: "Hintatila", en: "Price mode", es: "Modo de cuota" }), value: providerLabel, tone: "info" },
          { label: tr({ fi: "Saatavilla olevat yhtiöt", en: "Available bookmakers", es: "Casas disponibles" }), value: bookmakerCatalog.length, tone: "info" },
          { label: tr({ fi: "Järjestys", en: "Ranking", es: "Orden" }), value: sortLabel },
          { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: lastUpdated ? lastUpdated.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "–", tone: "info" },
          { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "paper only", en: "paper only", es: "solo simulación" }), tone: "warning" }
        ]} />
        {reason && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm text-amber-100">{reason}</div>}

        <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-300">{tr({ fi: "Advanced: paperikassa ja automaattipäivitys", en: "Advanced: paper bankroll and refresh", es: "Avanzado: banca simulada y actualización" })}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-slate-400">{tr({ fi: "Panosmalli", en: "Stake model", es: "Modelo de importe" })}
              <select value={kellyMode} onChange={(event) => { setKellyMode(event.target.value); saveLocalSettings({ kellyMode: event.target.value }); }} className="sc-input mt-2">
                <option value="conservative">{tr({ fi: "Erittäin varovainen", en: "Very conservative", es: "Muy conservador" })}</option>
                <option value="quarter">Quarter Kelly</option>
                <option value="half">Half Kelly</option>
                <option value="full">Full Kelly</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-400">{t("term.bankroll")} (€)
              <input type="number" min="0" value={bankroll} onChange={(event) => { const value = Number(event.target.value || 0); setBankroll(value); saveLocalSettings({ bankroll: value }); }} className="sc-input mt-2" />
            </label>
            <label className="text-sm font-bold text-slate-400">{tr({ fi: "Enimmäispanos (%)", en: "Maximum stake (%)", es: "Importe máximo (%)" })}
              <input type="number" min="0.1" max="10" step="0.1" value={maxStakePercent} onChange={(event) => { const value = Number(event.target.value || 2); setMaxStakePercent(value); saveLocalSettings({ maxStakePercent: value }); }} className="sc-input mt-2" />
            </label>
          </div>
          <button onClick={() => setAutoRefresh((value) => !value)} className={`mt-4 rounded-xl border px-4 py-2 text-sm font-black ${autoRefresh ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
            {tr({ fi: "Automaattipäivitys", en: "Automatic refresh", es: "Actualización automática" })}: {autoRefresh ? tr({ fi: "päällä", en: "on", es: "activada" }) : tr({ fi: "pois", en: "off", es: "desactivada" })}
          </button>
        </details>
      </Panel>

      <Panel
        title={tr({ fi: "Parhaat kohteet valitulla peliyhtiöllä", en: "Best picks at the selected bookmaker", es: "Mejores pronósticos en la casa elegida" })}
        subtitle={tr({ fi: `Järjestetty mittarilla: ${sortLabel}. Konsensus käyttää silti koko markkinaa.`, en: `Ranked by ${sortLabel}. Consensus still uses the whole market.`, es: `Ordenado por ${sortLabel}. El consenso sigue usando todo el mercado.` })}
      >
        {rankedSelections.length === 0 ? (
          <EmptyState
            title={tr({ fi: "Valitulta yhtiöltä ei löytynyt koko markkinaa", en: "No complete market was found at this bookmaker", es: "No se encontró un mercado completo en esta casa" })}
            description={tr({ fi: "Valitse toinen peliyhtiö tai Kaikki – paras kerroin. Scorecaster ei keksi puuttuvia hintoja.", en: "Choose another bookmaker or All – best price. Scorecaster does not invent missing prices.", es: "Elige otra casa o Todas – mejor cuota. Scorecaster no inventa cuotas faltantes." })}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rankedSelections.slice(0, 9).map(({ game, selection }, index) => (
              <button
                key={`${game.id}-${selection.selection}-${selection.point ?? ""}`}
                type="button"
                onClick={() => selectBet(game, selection)}
                className="sc-card-hover rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">#{index + 1} · {selection.bookmaker}</div>
                  <DecisionBadge decision={selection.decision} />
                </div>
                <div className="mt-3 text-sm font-black text-white">{game.homeTeam} vs {game.awayTeam}</div>
                <div className="mt-1 text-sm text-slate-300">{selection.selection}</div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-3xl font-black tracking-[-0.04em] text-white">{selection.odds.toFixed(2)}</div>
                  <div className="text-right text-xs leading-5 text-slate-400">EV {formatPercent(selection.ev)}<br />Edge {formatPercent(selection.edge)}</div>
                </div>
                {!selection.isBestMarketPrice && (
                  <div className="mt-3 text-xs leading-5 text-amber-200">
                    {tr({ fi: "Markkinan paras", en: "Market best", es: "Mejor del mercado" })}: {selection.bestMarketOdds.toFixed(2)} · {selection.bestMarketBookmaker}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <SectionHeader
            eyebrow={tr({ fi: "Valitse hinta", en: "Choose a price", es: "Elige una cuota" })}
            title={tr({ fi: "Ottelut ja valitun tarjoajan hinnat", en: "Games and selected-provider prices", es: "Partidos y cuotas del proveedor elegido" })}
            description={tr({ fi: "Jokainen valinta käyttää valitun yhtiön todellista hintaa ja koko markkinan no-vig-konsensusta.", en: "Every selection uses the selected bookmaker's real price and the whole market's no-vig consensus.", es: "Cada selección usa la cuota real de la casa elegida y el consenso sin margen de todo el mercado." })}
          />

          <div className="space-y-4">
            {!loading && sortedGames.length === 0 && (
              <EmptyState
                title={tr({ fi: "Markkinasta ei löytynyt käyttökelpoisia kohteita", en: "No usable picks were found", es: "No se encontraron pronósticos utilizables" })}
                description={tr({ fi: "Kokeile toista peliyhtiötä, liigaa tai markkinaa. SKIP ja puuttuva hinta ovat hyväksyttyjä tuloksia.", en: "Try another bookmaker, league or market. SKIP and a missing price are valid outcomes.", es: "Prueba otra casa, liga o mercado. SKIP y una cuota ausente son resultados válidos." })}
              />
            )}
            {sortedGames.map((game) => {
              const shapedMatch = movementShape(game);
              return (
                <article key={game.id} className="rounded-3xl border border-white/10 bg-slate-950/52 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">{game.sportTitle || game.sportKey}</div>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{game.homeTeam} vs {game.awayTeam}</h2>
                      <p className="mt-1 text-sm text-slate-500">{game.marketKey} · {game.bookmakerCount} {tr({ fi: "yhtiötä konsensuksessa", en: "bookmakers in consensus", es: "casas en el consenso" })}</p>
                    </div>
                    {game.commenceTime && <time className="text-xs font-bold text-slate-500">{new Date(game.commenceTime).toLocaleString(locale)}</time>}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {game.selections.map((selection) => {
                      const shapedOutcome = shapedMatch.outcomes.find((item) => item.name === selection.selection && item.point === (selection.point ?? null));
                      const movement = shapedOutcome ? getOddsMovement({ match: shapedMatch, outcome: shapedOutcome }) : { previousOdds: null };
                      const history = shapedOutcome ? getSelectionMovementHistory(shapedMatch, shapedOutcome) : [];
                      const signal = detectMovementSignal(history);
                      const selected = selectedBet?.game?.id === game.id && selectedBet?.selection?.selection === selection.selection && selectedBet?.selection?.point === selection.point;

                      return (
                        <button key={`${selection.selection}-${selection.point ?? ""}`} onClick={() => selectBet(game, selection)} aria-pressed={selected} className={`sc-card-hover rounded-2xl border p-4 text-left ${selected ? "border-sky-300/50 bg-sky-300/10 shadow-[0_0_0_1px_rgba(125,211,252,0.08)]" : "border-white/10 bg-white/[0.03]"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-white">{selection.selection}</div>
                              <div className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">{selection.odds.toFixed(2)}</div>
                            </div>
                            <DecisionBadge decision={selection.decision} />
                          </div>
                          <div className="mt-2 truncate text-xs font-bold text-emerald-300">{selection.bookmaker}</div>
                          {!selection.isBestMarketPrice && (
                            <div className="mt-2 rounded-xl border border-amber-300/15 bg-amber-300/7 px-3 py-2 text-xs leading-5 text-amber-100">
                              {tr({ fi: "Paras muualla", en: "Better elsewhere", es: "Mejor en otra casa" })}: {selection.bestMarketOdds.toFixed(2)} · {selection.bestMarketBookmaker}
                            </div>
                          )}
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <MetricTile compact label={t("term.edge")} value={formatPercent(selection.edge)} tone={Number(selection.edge || 0) > 0 ? "green" : "default"} />
                            <MetricTile compact label={t("term.ev")} value={formatPercent(selection.ev)} tone={Number(selection.ev || 0) > 0 ? "green" : "default"} />
                            <MetricTile compact label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={formatPercent(selection.consensusProbability)} />
                            <MetricTile compact label={t("term.confidence")} value={formatPercent(selection.confidence)} />
                          </div>
                          <div className="mt-3 text-xs leading-5 text-slate-500">{selection.freshnessLabel} · {signal.signal}{movement.previousOdds ? ` · ${movement.previousOdds} → ${selection.odds}` : ""}</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
          <Panel title={tr({ fi: "Valittu paperikohde", en: "Selected paper pick", es: "Pronóstico simulado elegido" })} subtitle={providerLabel}>
            {!selectedBet ? (
              <EmptyState
                title={tr({ fi: "Valitse kerroin tai ranking-kortti", en: "Choose a price or ranking card", es: "Elige una cuota o tarjeta del ranking" })}
                description={tr({ fi: "Näet tässä päätöksen, riskin, hintavertailun ja paperipanoksen.", en: "The decision, risk, price comparison and virtual stake will appear here.", es: "Aquí aparecerán decisión, riesgo, comparación de cuota e importe simulado." })}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{selectedBet.game.homeTeam} vs {selectedBet.game.awayTeam}</div>
                      <div className="mt-1 text-sm text-slate-300">{selectedBet.selection.selection} <span className="font-black text-emerald-200">@ {selectedBet.selection.odds.toFixed(2)}</span></div>
                      <div className="mt-1 text-xs text-slate-500">{selectedBet.selection.bookmaker}</div>
                    </div>
                    <DecisionBadge decision={selectedBet.selection.decision} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MetricTile label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={formatPercent(selectedBet.selection.consensusProbability)} />
                  <MetricTile label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={selectedBet.selection.fairOdds.toFixed(2)} />
                  <MetricTile label={`${t("term.edge")} / ${t("term.ev")}`} value={`${formatPercent(selectedBet.selection.edge)} / ${formatPercent(selectedBet.selection.ev)}`} tone="green" />
                  <MetricTile label={t("term.paperStake")} value={money(selectedBet.selection.suggestedStake)} tone="blue" />
                  <MetricTile label={t("term.confidence")} value={formatPercent(selectedBet.selection.confidence)} />
                  <MetricTile label={tr({ fi: "Riskitaso", en: "Risk level", es: "Nivel de riesgo" })} value={riskLabel(selectedBet.risk.level)} tone={selectedBet.risk.level === "High" ? "red" : selectedBet.risk.level === "Medium" ? "yellow" : "green"} />
                </div>

                {!selectedBet.selection.isBestMarketPrice && (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100">
                    {tr({ fi: "Valittu yhtiö ei tarjoa markkinan parasta hintaa.", en: "The selected bookmaker does not offer the market's best price.", es: "La casa elegida no ofrece la mejor cuota del mercado." })}<br />
                    {selectedBet.selection.bestMarketBookmaker}: <strong>{selectedBet.selection.bestMarketOdds.toFixed(2)}</strong>
                  </div>
                )}

                <div className="rounded-2xl border border-sky-300/20 bg-sky-300/8 p-4 text-sm leading-6 text-slate-200">{selectedBet.selection.decisionReason}</div>
                <TrustBar items={[
                  { label: tr({ fi: "Hintaliike", en: "Movement", es: "Movimiento" }), value: selectedBet.movementSignal.signal, tone: "info" },
                  { label: tr({ fi: "Konsensuslähteet", en: "Consensus sources", es: "Fuentes de consenso" }), value: selectedBet.selection.bookmakerCount || 0 },
                  { label: tr({ fi: "Hintalähde", en: "Price source", es: "Fuente de cuota" }), value: selectedBet.selection.bookmaker, tone: "info" },
                  { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper only", tone: "warning" }
                ]} />

                {selectedBet.risk.warnings.length > 0 && <ul className="space-y-1 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-6 text-slate-300">{selectedBet.risk.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}
                <button onClick={handleAddToTracking} disabled={selectedBet.selection.decision === "SKIP" || selectedBet.selection.suggestedStake <= 0} className="sc-button-primary w-full disabled:opacity-40">{tr({ fi: "Lisää paperisalkkuun", en: "Add to paper portfolio", es: "Añadir a cartera simulada" })}</button>
                {selectedBet.selection.decision === "SKIP" && <p className="text-sm leading-6 text-rose-300">{tr({ fi: "SKIP-kohdetta ei tallenneta. Odota parempaa hintaa tai dataa.", en: "A SKIP pick is not saved. Wait for a better price or data.", es: "Un SKIP no se guarda. Espera una cuota o datos mejores." })}</p>}
                {savedMessage && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-3 text-sm text-emerald-200">{savedMessage}</div>}
              </div>
            )}
          </Panel>

          <Panel title={tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite del producto" })}>
            <div className="space-y-3 text-sm leading-6 text-slate-400">
              <p>✓ {tr({ fi: "Vertaa julkisia live-kertoimia.", en: "Compares public live odds.", es: "Compara cuotas públicas en vivo." })}</p>
              <p>✓ {tr({ fi: "Peliyhtiön valinta muuttaa vain arvioitavaa hintaa.", en: "Bookmaker selection changes only the evaluated price.", es: "Elegir una casa solo cambia la cuota evaluada." })}</p>
              <p>✓ {tr({ fi: "Konsensus lasketaan kaikista saatavilla olevista yhtiöistä.", en: "Consensus is calculated from every available bookmaker.", es: "El consenso se calcula con todas las casas disponibles." })}</p>
              <p>✓ {tr({ fi: "Tallentaa vain virtuaaliseen paperisalkkuun.", en: "Saves only to a virtual paper portfolio.", es: "Guarda solo en una cartera simulada." })}</p>
              <p>✕ {tr({ fi: "Ei kirjaudu peliyhtiöön, siirrä rahaa tai aseta oikeaa vetoa.", en: "Does not log in to a bookmaker, move money or place a real bet.", es: "No inicia sesión en una casa, mueve dinero ni realiza apuestas reales." })}</p>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
