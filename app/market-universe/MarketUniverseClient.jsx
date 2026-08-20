"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import Panel from "../components/Panel";
import { DecisionBadge, EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";
import { SPORTS } from "../../lib/sports";
import { getSafeMarketUniverseGroups } from "../../lib/market-universe-sport-catalog.mjs";
import { addTrackedBet } from "../../lib/tracking-storage";

function gamesFrom(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function pct(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function odds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 1 ? number.toFixed(2) : "–";
}

function eventLabel(event) {
  return `${event.home_team || "Home"} – ${event.away_team || "Away"}`;
}

function decisionTone(decision) {
  if (decision === "PLAY") return "green";
  if (decision === "CAUTION") return "yellow";
  if (decision === "SKIP") return "red";
  return "blue";
}

export default function MarketUniverseClient() {
  const { tr } = useLanguage();
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].group);
  const [selectedLeague, setSelectedLeague] = useState(SPORTS[0].leagues[0].key);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("featured");
  const [universe, setUniverse] = useState(null);
  const [source, setSource] = useState("not-loaded");
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingUniverse, setLoadingUniverse] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const currentLeagues = SPORTS.find((sport) => sport.group === selectedSport)?.leagues || [];
  const groupOptions = useMemo(() => getSafeMarketUniverseGroups(selectedLeague), [selectedLeague]);
  const selectedEvent = events.find((event) => String(event.id) === String(selectedEventId)) || null;

  useEffect(() => {
    const preferred = groupOptions.some((group) => group.key === "goals") ? "goals" : groupOptions[0]?.key;
    if (preferred && !groupOptions.some((group) => group.key === selectedGroup)) setSelectedGroup(preferred);
  }, [groupOptions, selectedGroup]);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      setLoadingEvents(true);
      setUniverse(null);
      setError("");
      try {
        const response = await fetch(`/api/odds?sport=${encodeURIComponent(selectedLeague)}&markets=h2h`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.reason || "Events unavailable");
        const rows = gamesFrom(payload);
        if (cancelled) return;
        setEvents(rows);
        setSelectedEventId(rows[0]?.id ? String(rows[0].id) : "");
        setSource(payload?.source || "live");
      } catch (reason) {
        if (cancelled) return;
        setEvents([]);
        setSelectedEventId("");
        setSource("error");
        setError(reason instanceof Error ? reason.message : "Events unavailable");
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }
    void loadEvents();
    return () => { cancelled = true; };
  }, [selectedLeague]);

  async function loadUniverse() {
    if (!selectedEventId || !selectedGroup) return;
    setLoadingUniverse(true);
    setError("");
    setSavedMessage("");
    try {
      const response = await fetch(`/api/market-universe?sport=${encodeURIComponent(selectedLeague)}&eventId=${encodeURIComponent(selectedEventId)}&group=${encodeURIComponent(selectedGroup)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.reason || "Market group unavailable");
      setUniverse(payload);
      setSource(payload?.source || "event-market-provider");
    } catch (reason) {
      setUniverse(null);
      setError(reason instanceof Error ? reason.message : "Market group unavailable");
    } finally {
      setLoadingUniverse(false);
    }
  }

  function handleSportChange(groupName) {
    const group = SPORTS.find((sport) => sport.group === groupName);
    setSelectedSport(groupName);
    if (group?.leagues?.length) setSelectedLeague(group.leagues[0].key);
  }

  function trackSelection(market, unit, selection) {
    if (!selection?.analysisEligible || selection.decision === "SKIP" || selection.decision === "PRICE_ONLY") return;
    const event = universe?.data?.event || {};
    addTrackedBet({
      eventId: event.id,
      match: `${event.homeTeam || ""} vs ${event.awayTeam || ""}`,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      selection: selection.selection,
      odds: selection.odds,
      bookmaker: selection.bookmaker,
      bookmakerKey: selection.bookmakerKey,
      sportKey: event.sportKey,
      marketKey: market.key,
      marketUnitKey: unit.key,
      marketUnitLabel: unit.label,
      edge: selection.edge,
      ev: selection.ev,
      confidence: selection.confidence,
      modelProbability: selection.consensusProbability,
      marketProbability: selection.marketProbability,
      fairOdds: selection.fairOdds,
      stake: selection.suggestedStake,
      decision: selection.decision,
      decisionReason: selection.decisionReason,
      source: "scorecaster-market-universe-v1",
      modelMode: "market-unit-no-vig-consensus",
      edgeType: "best-price-vs-unit-no-vig-consensus",
      paperOnly: true
    });
    setSavedMessage(tr({
      fi: "Kohde lisättiin paperisalkkuun. Oikeaa vetoa ei asetettu.",
      en: "The selection was added to paper tracking. No real bet was placed.",
      es: "La selección se añadió al seguimiento simulado. No se realizó ninguna apuesta real."
    }));
  }

  const data = universe?.data || null;
  const markets = data?.markets || [];
  const analyzedSelections = markets.flatMap((market) => market.units.flatMap((unit) => unit.selections)).filter((selection) => selection.analysisEligible);
  const playCount = analyzedSelections.filter((selection) => selection.decision === "PLAY").length;

  return (
    <div className="space-y-7" data-market-universe="v1">
      <PageHero
        tone="sky"
        eyebrow="Market Universe V1 · event-specific bookmaker markets"
        title={tr({ fi: "Paljon enemmän kuin 1X2", en: "Much more than 1X2", es: "Mucho más que 1X2" })}
        description={tr({
          fi: "Avaa ottelukohtaiset markkinat: joukkue tekee maalin / team totals, BTTS, vaihtoehtoiset rajat, tulosmarkkinat, puoliajat, kulmat, kortit ja pelaajapropit silloin kun vedonvälittäjädatan provider niitä oikeasti tarjoaa.",
          en: "Open event-level markets: team to score / team totals, BTTS, alternate lines, result markets, periods, corners, cards and player props whenever the bookmaker data provider actually supplies them.",
          es: "Explora mercados por partido: totales de equipo, BTTS, líneas alternativas, córners, tarjetas y props cuando el proveedor realmente los ofrece."
        })}
        actions={<>
          <button type="button" onClick={() => void loadUniverse()} disabled={loadingUniverse || !selectedEventId} className="sc-button-primary disabled:opacity-40">
            {loadingUniverse ? tr({ fi: "Haetaan markkinoita…", en: "Loading markets…", es: "Cargando mercados…" }) : tr({ fi: "Hae valittu markkinaryhmä", en: "Load selected market group", es: "Cargar grupo de mercados" })}
          </button>
          <Link href="/betting" className="sc-button-secondary">Bookmaker Hub</Link>
          <Link href="/pro" className="sc-button-secondary">Pro Bettor Desk</Link>
        </>}
        aside={<div className="grid grid-cols-2 gap-2">
          <MetricTile compact label={tr({ fi: "Markkinat", en: "Markets", es: "Mercados" })} value={data?.marketCount || 0} tone="blue" />
          <MetricTile compact label={tr({ fi: "Linjat", en: "Units", es: "Líneas" })} value={data?.unitCount || 0} tone="purple" />
          <MetricTile compact label={tr({ fi: "Tarjoukset", en: "Offers", es: "Ofertas" })} value={data?.offerCount || 0} tone="default" />
          <MetricTile compact label="PLAY" value={playCount} tone="green" />
        </div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source, tone: source === "error" ? "danger" : "default" },
        { label: tr({ fi: "Haku", en: "Fetch mode", es: "Modo" }), value: "on-demand per event", tone: "info" },
        { label: tr({ fi: "Päätösraja", en: "Decision boundary", es: "Límite" }), value: "valid no-vig units only", tone: "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper only", tone: "warning" }
      ]} />

      {error && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">{error}</div>}
      {savedMessage && <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 p-4 text-sm text-sky-100">{savedMessage}</div>}

      <Panel
        title={tr({ fi: "Valitse ottelu ja markkinat", en: "Choose event and market group", es: "Elige partido y mercados" })}
        subtitle={tr({ fi: "Lisämarkkinat haetaan vasta valitulle ottelulle, jotta quota ja datamäärä pysyvät hallinnassa.", en: "Additional markets are fetched only for the selected event to control quota and response size.", es: "Los mercados adicionales se cargan solo para el partido elegido." })}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Laji", en: "Sport", es: "Deporte" })}
            <select value={selectedSport} onChange={(event) => handleSportChange(event.target.value)} className="sc-input mt-2">
              {SPORTS.map((sport) => <option key={sport.group} value={sport.group}>{sport.group}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Liiga", en: "League", es: "Liga" })}
            <select value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)} className="sc-input mt-2">
              {currentLeagues.map((league) => <option key={league.key} value={league.key}>{league.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Ottelu", en: "Event", es: "Partido" })}
            <select value={selectedEventId} onChange={(event) => { setSelectedEventId(event.target.value); setUniverse(null); }} disabled={loadingEvents || !events.length} className="sc-input mt-2 disabled:opacity-40">
              {!events.length && <option value="">{loadingEvents ? "Loading…" : "No events"}</option>}
              {events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
            </select>
          </label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Markkinaryhmä", en: "Market group", es: "Grupo" })}
            <select value={selectedGroup} onChange={(event) => { setSelectedGroup(event.target.value); setUniverse(null); }} className="sc-input mt-2">
              {groupOptions.map((group) => <option key={group.key} value={group.key}>{group.title}</option>)}
            </select>
          </label>
        </div>
        {selectedEvent && <div className="mt-4 text-xs text-[var(--sc-muted)]">{eventLabel(selectedEvent)} · {selectedLeague}</div>}
      </Panel>

      {!loadingUniverse && universe && markets.length === 0 && <EmptyState
        title={tr({ fi: "Tätä markkinaa ei löytynyt", en: "No markets returned", es: "No se encontraron mercados" })}
        description={tr({ fi: "Provider ei palauttanut valitulle ottelulle tämän ryhmän kertoimia. Scorecaster ei keksi puuttuvia markkinoita.", en: "The provider returned no odds for this group on the selected event. Scorecaster does not invent missing markets.", es: "El proveedor no devolvió cuotas; Scorecaster no inventa mercados." })}
      />}

      {markets.map((market) => <section key={market.key} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 md:p-6">
        <SectionHeader
          eyebrow={market.key}
          title={market.title}
          description={tr({ fi: `${market.unitCount} linjaa/yksikköä · ${market.offerCount} bookmaker-tarjousta`, en: `${market.unitCount} market units · ${market.offerCount} bookmaker offers`, es: `${market.unitCount} unidades · ${market.offerCount} ofertas` })}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {market.units.map((unit) => <div key={`${market.key}:${unit.key}`} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black text-[var(--sc-text)]">{unit.label}</div>
                <div className="mt-1 text-xs text-[var(--sc-muted)]">{unit.analysisEligible ? tr({ fi: "No-vig/EV-analyysi sallittu tälle settlement-yksikölle", en: "No-vig/EV analysis is valid for this settlement unit", es: "Análisis no-vig/EV válido" }) : unit.analysisReason}</div>
              </div>
              {unit.point === 0.5 && ["team_totals", "alternate_team_totals"].includes(market.key) && <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">{tr({ fi: "Joukkue tekee maalin", en: "Team to score", es: "Equipo marca" })}</span>}
            </div>
            <div className="mt-4 grid gap-3">
              {unit.selections.map((selection) => <div key={selection.selection} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-[var(--sc-text)]">{selection.selection}</div>
                    <div className="mt-1 text-xs text-[var(--sc-muted)]">{selection.bookmaker || "–"} · {selection.bookmakerCount} books · {selection.freshnessLabel}</div>
                  </div>
                  <DecisionBadge decision={selection.decision || "PRICE_ONLY"} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricTile compact label={tr({ fi: "Paras kerroin", en: "Best odds", es: "Mejor cuota" })} value={odds(selection.odds)} tone="blue" />
                  <MetricTile compact label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={pct(selection.consensusProbability)} tone="default" />
                  <MetricTile compact label="Edge" value={pct(selection.edge)} tone={decisionTone(selection.decision)} />
                  <MetricTile compact label="EV" value={pct(selection.ev)} tone={decisionTone(selection.decision)} />
                </div>
                <div className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{selection.decisionReason}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selection.offers.slice(0, 6).map((offer) => <span key={`${selection.selection}:${offer.bookmakerKey}`} className="rounded-lg border border-[var(--sc-border)] px-2.5 py-1.5 text-xs text-[var(--sc-text-secondary)]">{offer.bookmaker} <strong>{odds(offer.odds)}</strong></span>)}
                </div>
                {selection.analysisEligible && selection.decision !== "SKIP" && <button type="button" onClick={() => trackSelection(market, unit, selection)} className="sc-button-secondary mt-4">{tr({ fi: "Lisää paperisalkkuun", en: "Add to paper portfolio", es: "Añadir a cartera simulada" })}</button>}
              </div>)}
            </div>
          </div>)}
        </div>
      </section>)}

      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/8 p-4 text-xs leading-6 text-amber-100">
        <strong>{tr({ fi: "Matemaattinen raja:", en: "Mathematical boundary:", es: "Límite matemático:" })}</strong> {tr({
          fi: "markkinat, joissa on push/split-settlement, päällekkäisiä lopputuloksia tai vajaa outcome-joukko, näytetään PRICE_ONLY-tilassa kunnes niille on oma oikea settlement-malli. Näin esimerkiksi team total Over 0.5 voidaan analysoida, mutta väärää EV:tä ei lasketa väkisin monimutkaiseen prop-markkinaan.",
          en: "markets with push/split settlement, overlapping outcomes or incomplete outcome sets remain PRICE_ONLY until a correct settlement model exists. Team total Over 0.5 can be analyzed while complex props are never forced through the wrong EV formula.",
          es: "los mercados con settlement complejo permanecen PRICE_ONLY hasta disponer de un modelo correcto."
        })}
      </section>
    </div>
  );
}
