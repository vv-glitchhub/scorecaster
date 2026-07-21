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
  const money = (value) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value || 0));
  const riskLabel = (level) => level === "High"
    ? tr({ fi: "Korkea", en: "High", es: "Alto" })
    : level === "Medium"
      ? tr({ fi: "Keskitaso", en: "Medium", es: "Medio" })
      : tr({ fi: "Matala", en: "Low", es: "Bajo" });

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
        eyebrow={tr({ fi: "Live-markkinat", en: "Live markets", es: "Mercados en vivo" })}
        title={tr({ fi: "Vertaa hinta, laatu ja riski yhdellä silmäyksellä", en: "Compare price, quality and risk at a glance", es: "Compara cuota, calidad y riesgo de un vistazo" })}
        description={tr({
          fi: "Valitse liiga ja markkina. Scorecaster poistaa vedonvälittäjän marginaalin, vertailee parhaat hinnat ja näyttää päätöksen ilman turhaa teknistä melua.",
          en: "Choose a league and market. Scorecaster removes bookmaker margin, compares the best prices and shows the decision without unnecessary technical noise.",
          es: "Elige liga y mercado. Scorecaster elimina el margen, compara las mejores cuotas y muestra la decisión sin ruido técnico innecesario."
        })}
        actions={
          <button onClick={() => void loadOdds()} disabled={loading} className="sc-button-primary">
            {loading ? t("common.loading") : tr({ fi: "Päivitä live-kohteet", en: "Refresh live picks", es: "Actualizar pronósticos" })}
          </button>
        }
        aside={heroAside}
      />

      <Panel
        title={tr({ fi: "Rajaa markkina", en: "Filter the market", es: "Filtrar mercado" })}
        subtitle={tr({ fi: "Kolme valintaa riittää. Muut asetukset ovat Advanced-osiossa.", en: "Three choices are enough. Other settings are under Advanced.", es: "Tres opciones son suficientes. El resto está en Avanzado." })}
      >
        <div className="grid gap-4 md:grid-cols-3">
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
        </div>

        <TrustBar className="mt-5" items={[
          { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source },
          { label: tr({ fi: "Ottelut", en: "Games", es: "Partidos" }), value: games.length, tone: "info" },
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <SectionHeader
            eyebrow={tr({ fi: "Valitse hinta", en: "Choose a price", es: "Elige una cuota" })}
            title={tr({ fi: "Ottelut ja parhaat kertoimet", en: "Games and best prices", es: "Partidos y mejores cuotas" })}
            description={tr({ fi: "Avaa yksi valinta nähdäksesi konsensuksen, EV:n, riskin ja paperipanoksen.", en: "Open one selection to see consensus, EV, risk and virtual stake.", es: "Abre una selección para ver consenso, EV, riesgo e importe simulado." })}
          />

          <div className="space-y-4">
            {!loading && games.length === 0 && (
              <EmptyState
                title={tr({ fi: "Markkinasta ei löytynyt käyttökelpoisia kohteita", en: "No usable picks were found", es: "No se encontraron pronósticos utilizables" })}
                description={tr({ fi: "Kokeile toista liigaa tai markkinaa. SKIP on hyväksytty tulos.", en: "Try another league or market. SKIP is a valid outcome.", es: "Prueba otra liga o mercado. SKIP es válido." })}
              />
            )}
            {games.map((game) => {
              const shapedMatch = movementShape(game);
              return (
                <article key={game.id} className="rounded-3xl border border-white/10 bg-slate-950/52 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">{game.sportTitle || game.sportKey}</div>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{game.homeTeam} vs {game.awayTeam}</h2>
                      <p className="mt-1 text-sm text-slate-500">{game.marketKey} · {game.bookmakerCount} {tr({ fi: "vedonvälittäjää", en: "bookmakers", es: "casas" })}</p>
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
                          <div className="mt-2 truncate text-xs font-bold text-emerald-300">{selection.bookmaker || tr({ fi: "Paras hinta", en: "Best price", es: "Mejor cuota" })}</div>
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
          <Panel title={tr({ fi: "Valittu paperikohde", en: "Selected paper pick", es: "Pronóstico simulado elegido" })} subtitle={tr({ fi: "Yksi päätös kerrallaan", en: "One decision at a time", es: "Una decisión cada vez" })}>
            {!selectedBet ? (
              <EmptyState
                title={tr({ fi: "Valitse kerroin vasemmalta", en: "Choose a price on the left", es: "Elige una cuota a la izquierda" })}
                description={tr({ fi: "Näet tässä päätöksen, riskin ja paperipanoksen.", en: "The decision, risk and virtual stake will appear here.", es: "Aquí aparecerán decisión, riesgo e importe simulado." })}
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

                <div className="rounded-2xl border border-sky-300/20 bg-sky-300/8 p-4 text-sm leading-6 text-slate-200">{selectedBet.selection.decisionReason}</div>
                <TrustBar items={[
                  { label: tr({ fi: "Hintaliike", en: "Movement", es: "Movimiento" }), value: selectedBet.movementSignal.signal, tone: "info" },
                  { label: tr({ fi: "Lähteet", en: "Sources", es: "Fuentes" }), value: selectedBet.selection.bookmakerCount || 0 },
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
              <p>✓ {tr({ fi: "Tallentaa vain virtuaaliseen paperisalkkuun.", en: "Saves only to a virtual paper portfolio.", es: "Guarda solo en una cartera simulada." })}</p>
              <p>✕ {tr({ fi: "Ei siirrä rahaa eikä aseta oikeaa vetoa.", en: "Does not move money or place a real bet.", es: "No mueve dinero ni realiza apuestas reales." })}</p>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}
