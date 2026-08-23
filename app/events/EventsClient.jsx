"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SPORTS } from "../../lib/sports";
import {
  buildGameCenterEvents,
  filterGameCenterEvents,
  summarizeGameCenter
} from "../../lib/game-center-v1.mjs";
import { useLanguage } from "../components/LanguageProvider";
import MarketPickExplanation from "../components/MarketPickExplanation";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

const LEAGUES = SPORTS.flatMap((group) => group.leagues);
const LEAGUE_BY_KEY = new Map(LEAGUES.map((item) => [item.key, item]));

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value) {
  const number = finite(value);
  return number === null ? "–" : `${(number * 100).toFixed(1)} %`;
}

function decimal(value) {
  const number = finite(value);
  return number === null ? "–" : number.toFixed(2);
}

function sameLocalDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function timing(value, locale, tr) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return {
      full: tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" }),
      short: tr({ fi: "Aika puuttuu", en: "Time unavailable", es: "Sin hora" })
    };
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minutes = Math.round((date.getTime() - now.getTime()) / 60000);
  const clock = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const full = date.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (minutes >= 0 && minutes < 60) {
    return { full, short: tr({ fi: `Alkaa ${Math.max(1, minutes)} min kuluttua`, en: `Starts in ${Math.max(1, minutes)} min`, es: `Empieza en ${Math.max(1, minutes)} min` }) };
  }
  if (sameLocalDate(date, now)) return { full, short: tr({ fi: `Tänään ${clock}`, en: `Today ${clock}`, es: `Hoy ${clock}` }) };
  if (sameLocalDate(date, tomorrow)) return { full, short: tr({ fi: `Huomenna ${clock}`, en: `Tomorrow ${clock}`, es: `Mañana ${clock}` }) };
  if (minutes < 0) return { full, short: tr({ fi: "Alkamisaika ohitettu", en: "Kickoff passed", es: "Inicio superado" }) };
  return { full, short: date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) };
}

function leagueTitle(key) {
  return LEAGUE_BY_KEY.get(key)?.title || key;
}

export default function EventsClient() {
  const { tr, locale } = useLanguage();
  const [league, setLeague] = useState("");
  const [seasonLeagues, setSeasonLeagues] = useState([]);
  const [query, setQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [sortMode, setSortMode] = useState("kickoff");
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ generatedAt: null, source: "loading", providerGames: null, acceptedGames: null, excludedGames: null });

  const load = useCallback(async (selectedLeague = "") => {
    setLoading(true);
    setError("");
    try {
      const queryString = selectedLeague
        ? `?sports=${encodeURIComponent(selectedLeague)}&view=summary`
        : "?view=summary";
      const response = await fetch(`/api/top-picks${queryString}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Events unavailable");
      setPicks(Array.isArray(data.data) ? data.data : []);
      setMeta({
        generatedAt: data.generatedAt || new Date().toISOString(),
        source: data.fixtureSource || data.source || "live-odds-provider-only",
        providerGames: finite(data.providerGames),
        acceptedGames: finite(data.acceptedGames),
        excludedGames: finite(data.excludedGames)
      });
      if (!selectedLeague && Array.isArray(data.leagues)) setSeasonLeagues(data.leagues.filter((key) => LEAGUE_BY_KEY.has(key)));
    } catch (loadError) {
      setPicks([]);
      setMeta({ generatedAt: null, source: "error", providerGames: null, acceptedGames: null, excludedGames: null });
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Otteluita ei voitu ladata.", en: "Events could not be loaded.", es: "No se pudieron cargar los eventos." }));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void load(league); }, [league, load]);

  const events = useMemo(() => buildGameCenterEvents(picks), [picks]);
  const visibleEvents = useMemo(() => filterGameCenterEvents(events, {
    query,
    time: timeFilter,
    decision: decisionFilter,
    sort: sortMode
  }), [decisionFilter, events, query, sortMode, timeFilter]);
  const summary = useMemo(() => summarizeGameCenter(events), [events]);
  const quickLeagues = useMemo(() => [...new Set([...seasonLeagues, league].filter(Boolean))], [league, seasonLeagues]);
  const updated = meta.generatedAt
    ? new Date(meta.generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });
  const selectedLeagueLabel = league ? leagueTitle(league) : tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas de temporada" });
  const filtersActive = Boolean(query || timeFilter !== "all" || decisionFilter !== "all" || sortMode !== "kickoff");

  function resetViewFilters() {
    setQuery("");
    setTimeFilter("all");
    setDecisionFilter("all");
    setSortMode("kickoff");
  }

  return (
    <div className="space-y-7" data-game-center-v1="true">
      <PageHero
        tone="sky"
        eyebrow="Game Center V1 · Daily Flow V3 · Event Detail V3"
        title={tr({ fi: "Löydä oikea ottelu ja ymmärrä päätös ennen toimintoa", en: "Find the right event and understand the decision before acting", es: "Encuentra el evento y entiende la decisión antes de actuar" })}
        description={tr({
          fi: "Hakemisto näyttää vain providerin varmentamia lähiajan otteluita. Hae joukkuetta, rajaa päivä ja päätös sekä jatka palvelimen varmentamaan seuranta- ja paperitallennuspolkuun.",
          en: "The directory shows provider-verified events only. Search a team, filter by day and decision, then continue through the same server-verified watchlist and paper-save flow.",
          es: "El directorio solo muestra eventos verificados. Busca un equipo, filtra por día y decisión y continúa por el flujo verificado de seguimiento y simulación."
        })}
        actions={
          <>
            <button type="button" onClick={() => void load(league)} disabled={loading} className="sc-button-primary disabled:opacity-50">
              {loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä ottelut", en: "Refresh events", es: "Actualizar eventos" })}
            </button>
            <Link href="/watchlist" className="sc-button-secondary">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link>
          </>
        }
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Ottelut", en: "Events", es: "Eventos" })} value={loading ? "…" : summary.events} tone="blue" /><MetricTile compact label="PLAY" value={loading ? "…" : summary.play} tone="green" /><MetricTile compact label="CAUTION" value={loading ? "…" : summary.caution} tone="yellow" /><MetricTile compact label="SKIP" value={loading ? "…" : summary.skip} tone="red" /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: meta.source },
        { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: updated, tone: "info" },
        { label: tr({ fi: "Sarjat", en: "Leagues", es: "Ligas" }), value: selectedLeagueLabel, tone: "info" },
        { label: tr({ fi: "Hyväksytyt pelit", en: "Accepted games", es: "Partidos aceptados" }), value: meta.acceptedGames ?? "–", tone: "good" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper only", tone: "warning" }
      ]} />

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Otteluhakemisto", en: "Event directory", es: "Directorio de eventos" })}
          title={tr({ fi: "Lähiajan varmennetut ottelut", en: "Verified near-term events", es: "Eventos próximos verificados" })}
          description={tr({ fi: "Kauden pikavalinnat tulevat nyt palvelimen todellisesta sarjavalinnasta. Voit myös avata minkä tahansa tuetun sarjan erikseen.", en: "Season shortcuts now follow the server's actual league selection. You can also open any supported league separately.", es: "Los accesos de temporada siguen la selección real del servidor. También puedes abrir cualquier liga compatible." })}
        />

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label={tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas de temporada" })}>
          <button type="button" onClick={() => setLeague("")} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-black transition ${league === "" ? "border-[var(--sc-brand)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}>
            {tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" })}
          </button>
          {quickLeagues.map((key) => (
            <button key={key} type="button" onClick={() => setLeague(key)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-black transition ${league === key ? "border-[var(--sc-brand)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}>
              {leagueTitle(key)}
            </button>
          ))}
        </div>

        <div className="mb-5 rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.4fr)_repeat(4,minmax(9rem,1fr))]">
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
              {tr({ fi: "Hae peliä tai joukkuetta", en: "Search event or team", es: "Buscar evento o equipo" })}
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr({ fi: "esim. Ilves, Aces, Arsenal", en: "e.g. Ilves, Aces, Arsenal", es: "p. ej. Ilves, Aces, Arsenal" })} className="sc-input mt-2 w-full normal-case tracking-normal" />
            </label>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
              {tr({ fi: "Sarja", en: "League", es: "Liga" })}
              <select value={league} onChange={(event) => setLeague(event.target.value)} className="sc-input mt-2 w-full normal-case tracking-normal">
                <option value="">{tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" })}</option>
                {SPORTS.map((group) => <optgroup key={group.group} label={group.group}>{group.leagues.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</optgroup>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
              {tr({ fi: "Ajankohta", en: "Time", es: "Hora" })}
              <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} className="sc-input mt-2 w-full normal-case tracking-normal"><option value="all">{tr({ fi: "Kaikki ajat", en: "All times", es: "Todas" })}</option><option value="today">{tr({ fi: "Tänään", en: "Today", es: "Hoy" })}</option><option value="tomorrow">{tr({ fi: "Huomenna", en: "Tomorrow", es: "Mañana" })}</option><option value="next24">{tr({ fi: "Seuraavat 24 h", en: "Next 24 hours", es: "Próximas 24 h" })}</option></select>
            </label>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
              {tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}
              <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)} className="sc-input mt-2 w-full normal-case tracking-normal"><option value="all">{tr({ fi: "Kaikki päätökset", en: "All decisions", es: "Todas" })}</option><option value="PLAY">PLAY</option><option value="CAUTION">CAUTION</option><option value="SKIP">SKIP</option></select>
            </label>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
              {tr({ fi: "Järjestä", en: "Sort", es: "Ordenar" })}
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="sc-input mt-2 w-full normal-case tracking-normal"><option value="kickoff">{tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" })}</option><option value="decision">{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}</option><option value="edge">Edge</option><option value="trust">Trust</option><option value="confidence">{tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })}</option></select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sc-border)] pt-4 text-xs text-[var(--sc-muted)]">
            <span><strong className="text-[var(--sc-text)]">{visibleEvents.length}</strong> / {events.length} {tr({ fi: "ottelua näkyvissä", en: "events visible", es: "eventos visibles" })}</span>
            {filtersActive ? <button type="button" onClick={resetViewFilters} className="font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Tyhjennä näkymän rajaukset", en: "Clear view filters", es: "Limpiar filtros" })}</button> : null}
          </div>
        </div>

        {error && <div role="alert" className="rounded-[1.25rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
        {!loading && visibleEvents.length === 0 && !error && <EmptyState title={tr({ fi: "Otteluita ei löytynyt näillä rajauksilla", en: "No events match these filters", es: "No hay eventos con estos filtros" })} description={tr({ fi: "Kokeile poistaa haku tai avata toinen sarja. Nykyinen Top Picks analysis ei täytä tyhjää näkymää esimerkkidatalla.", en: "Clear the search or open another league. The current Top Picks analysis never fills an empty view with example data.", es: "Limpia la búsqueda o abre otra liga. El análisis actual no rellena la vista con datos de ejemplo." })} actionHref="/" actionLabel={tr({ fi: "Avaa päivän näkymä", en: "Open Today", es: "Abrir Hoy" })} />}

        {loading ? <div className="grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-[28rem] animate-pulse rounded-[1.55rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />)}</div> : null}

        {!loading ? <div className="grid gap-4 lg:grid-cols-2">
          {visibleEvents.map((event) => {
            const primary = event.primarySelection;
            const eventDecision = event.decision;
            const href = `/event/${encodeURIComponent(event.id)}?sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(primary?.selection || primary?.label || "")}`;
            const journeyHref = `/match-intelligence?eventId=${encodeURIComponent(event.id)}&sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(primary?.selection || primary?.label || "")}`;
            const kickoff = timing(event.commenceTime, locale, tr);
            const readiness = primary?.sportsIntelligence?.readiness?.level || "market-only";
            const bookmakerCount = finite(primary?.bookmakerCount ?? primary?.dataQuality?.bookmakerCount);
            const trust = finite(primary?.trustScore ?? primary?.qualityScore);

            return (
              <article key={event.id} className="sc-card-hover sc-surface flex flex-col rounded-[1.55rem] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <MatchIdentity homeTeam={event.homeTeam} awayTeam={event.awayTeam} meta={`${kickoff.full} · ${event.league || "Sport"}`} />
                  <DecisionBadge decision={eventDecision} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-200">{kickoff.short}</span>
                  <span className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-[var(--sc-muted)]">{event.selections.length} {tr({ fi: "valintaa", en: "selections", es: "selecciones" })}</span>
                  <span className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-1.5 text-[var(--sc-muted)]">{readiness}</span>
                </div>

                {primary ? <>
                  <div className="mt-5 rounded-[1.25rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Palvelimen ykkösvalinta", en: "Server-ranked primary selection", es: "Selección principal del servidor" })}</div>
                        <div className="mt-1 text-xl font-black text-[var(--sc-text)]">{primary.selection || primary.label}</div>
                        <div className="mt-1 text-sm font-bold text-[var(--sc-brand)]">{primary.bookmaker || tr({ fi: "Paras varmennettu hinta", en: "Best verified price", es: "Mejor cuota verificada" })}</div>
                      </div>
                      <div className="text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)]">{decimal(primary.odds)}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MetricTile compact label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={decimal(primary.fairOdds)} />
                      <MetricTile compact label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={percent(primary.consensusProbability)} tone="blue" />
                      <MetricTile compact label="Edge" value={percent(primary.edge)} tone={finite(primary.edge) > 0 ? "green" : "default"} />
                      <MetricTile compact label="EV" value={percent(primary.ev)} tone={finite(primary.ev) > 0 ? "green" : "default"} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">{tr({ fi: "Hintalähteet", en: "Price sources", es: "Fuentes" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{bookmakerCount ?? "–"}</div></div>
                    <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">{tr({ fi: "Tuoreus", en: "Freshness", es: "Actualidad" })}</div><div className="mt-1 truncate font-black text-[var(--sc-text)]">{primary.freshnessLabel || primary.dataQuality?.freshness || "–"}</div></div>
                    <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">Trust</div><div className="mt-1 font-black text-[var(--sc-text)]">{trust === null ? "–" : `${trust.toFixed(0)}/100`}</div></div>
                  </div>

                  <div className="mt-4"><MarketPickExplanation pick={primary} /></div>
                </> : null}

                <div className="mt-auto grid gap-2 border-t border-[var(--sc-border)] pt-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Link href={href} className="sc-button-primary flex justify-center text-center">
                    {eventDecision === "SKIP" ? tr({ fi: "Avaa SKIP-perustelu", en: "Open SKIP reasoning", es: "Abrir motivo SKIP" }) : tr({ fi: "Tarkista ja valitse toiminto", en: "Review and choose an action", es: "Revisar y elegir una acción" })}
                  </Link>
                  <Link href={journeyHref} className="sc-button-secondary flex justify-center text-center">Match Journey</Link>
                </div>
              </article>
            );
          })}
        </div> : null}
      </section>

      <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">
        {tr({ fi: "Lista sisältää vain current Top Picks analysis -aineiston varmennetut tapahtumat. Käyttöliittymä säilyttää palvelimen järjestyksen eikä nosta valintaa PLAY-tilaan omalla laskennalla.", en: "The directory contains verified events from the current Top Picks analysis only. The UI preserves server ranking and never upgrades a selection to PLAY with a browser-side calculation.", es: "La lista contiene solo eventos verificados del análisis actual. La interfaz conserva el orden del servidor y nunca eleva una selección a PLAY por su cuenta." })}
      </div>
    </div>
  );
}
