"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SPORTS } from "../../lib/sports";
import { buildGameCenterEvents, filterGameCenterEvents, summarizeGameCenter } from "../../lib/game-center-v1.mjs";
import { readEventFilters, eventFiltersHref } from "../../lib/event-browser-filters.mjs";
import { requestErrorText } from "../../lib/client-request.mjs";
import { useLanguage } from "../components/LanguageProvider";
import useRemoteJson from "../components/useRemoteJson";
import MarketPickExplanation from "../components/MarketPickExplanation";
import { DecisionBadge, EmptyState, MatchIdentity, MetricTile, PageHero } from "../components/ProductUI";

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
  const searchParams = useSearchParams();
  const filters = readEventFilters(searchParams);
  const { league, query, time: timeFilter, decision: decisionFilter, sort: sortMode, view } = filters;
  const [pageState, setPageState] = useState({ key: "", count: 24 });
  const analysis = view === "analysis";
  const queryString = `${analysis ? "view=summary" : "view=directory"}${league ? `&sports=${encodeURIComponent(league)}` : ""}`;
  const { data, loading, error, refresh } = useRemoteJson(`/api/top-picks?${queryString}`);
  const events = useMemo(() => buildGameCenterEvents(data?.data || [], data?.events || []), [data]);
  const visibleEvents = useMemo(() => filterGameCenterEvents(events, { query, time: timeFilter, decision: decisionFilter, sort: sortMode }), [events, query, timeFilter, decisionFilter, sortMode]);
  const summary = useMemo(() => summarizeGameCenter(events), [events]);
  const quickLeagues = [...new Set([...(data?.leagues || []), league].filter(Boolean))];
  const pageKey = `${searchParams}:${data?.generatedAt || ""}`;
  const shownCount = pageState.key === pageKey ? pageState.count : 24;
  const filtersActive = Boolean(query || timeFilter !== "all" || decisionFilter !== "all" || sortMode !== "kickoff");
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";

  function change(values) { window.history.replaceState(null, "", eventFiltersHref({ ...filters, ...values })); }
  function resetViewFilters() { change({ query: "", time: "all", decision: "all", sort: "kickoff" }); }

  return <div className="space-y-6">
    <PageHero eyebrow={tr({ fi: "Ottelut", en: "Matches", es: "Partidos" })}
      title={tr({ fi: "Löydä ottelu. Avaa analyysi. Seuraa tulosta.", en: "Find a match. Open its analysis. Track the result.", es: "Encuentra un partido. Abre su análisis. Sigue el resultado." })}
      description={tr({ fi: "Selaa seuraavan seitsemän päivän otteluita ja hae joukkuetta. Analysoidut kohteet -näkymässä voit vertailla palvelimen arvioimia valintoja.", en: "Browse the next seven days and search for a team. Analyzed selections lets you compare the server's reviewed candidates.", es: "Explora los próximos siete días y busca un equipo. Las selecciones analizadas permiten comparar candidatos evaluados." })}
      actions={<><button type="button" onClick={refresh} disabled={loading} className="sc-button-secondary disabled:opacity-50">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä ottelut", en: "Refresh matches", es: "Actualizar partidos" })}</button><Link href="/watchlist" className="sc-button-ghost">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link></>}
      aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Ottelut", en: "Matches", es: "Partidos" })} value={loading ? "…" : error ? "–" : summary.events} tone="blue" /><MetricTile compact label={analysis ? "PLAY" : tr({ fi: "Sarjat", en: "Leagues", es: "Ligas" })} value={loading ? "…" : error ? "–" : analysis ? summary.play : data?.availableLeagueCount ?? "–"} tone="green" /></div>} />

    <section aria-label={tr({ fi: "Otteluhakemisto", en: "Event directory", es: "Directorio" })}>
      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: "directory", label: tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" }) }, { value: "analysis", label: tr({ fi: "Analysoidut kohteet", en: "Analyzed selections", es: "Selecciones analizadas" }) }].map(item => <button key={item.value} type="button" aria-pressed={view === item.value} onClick={() => change({ view: item.value, decision: "all", sort: "kickoff" })} className={view === item.value ? "sc-button-primary" : "sc-button-secondary"}>{item.label}</button>)}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label={tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" })}>
        {["", ...quickLeagues].map(key => <button key={key} type="button" aria-pressed={league === key} onClick={() => change({ league: key })} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${league === key ? "border-[var(--sc-brand)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)]" : "border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{key ? leagueTitle(key) : tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" })}</button>)}
      </div>
      <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Hae peliä tai joukkuetta", en: "Search event or team", es: "Buscar evento o equipo" })}<input type="search" value={query} onChange={event => change({ query: event.target.value.slice(0, 120) })} placeholder={tr({ fi: "esim. Ilves, Aces, Arsenal", en: "e.g. Ilves, Aces, Arsenal", es: "p. ej. Ilves, Aces, Arsenal" })} className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Sarja", en: "League", es: "Liga" })}<select value={league} onChange={event => change({ league: event.target.value })} className="sc-input mt-2 w-full"><option value="">{tr({ fi: "Kauden sarjat", en: "Season leagues", es: "Ligas actuales" })}</option>{SPORTS.map(group => <optgroup key={group.group} label={group.group}>{group.leagues.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</optgroup>)}</select></label>
          <label className="text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Ajankohta", en: "Time", es: "Hora" })}<select value={timeFilter} onChange={event => change({ time: event.target.value })} className="sc-input mt-2 w-full"><option value="all">{tr({ fi: "Kaikki ajat", en: "All times", es: "Todas" })}</option><option value="today">{tr({ fi: "Tänään", en: "Today", es: "Hoy" })}</option><option value="tomorrow">{tr({ fi: "Huomenna", en: "Tomorrow", es: "Mañana" })}</option><option value="next24">{tr({ fi: "Seuraavat 24 h", en: "Next 24 hours", es: "Próximas 24 h" })}</option></select></label>
          {analysis ? <><label className="text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}<select value={decisionFilter} onChange={event => change({ decision: event.target.value })} className="sc-input mt-2 w-full"><option value="all">{tr({ fi: "Kaikki päätökset", en: "All decisions", es: "Todas" })}</option><option>PLAY</option><option>CAUTION</option><option>SKIP</option></select></label><label className="text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Järjestä", en: "Sort", es: "Ordenar" })}<select value={sortMode} onChange={event => change({ sort: event.target.value })} className="sc-input mt-2 w-full"><option value="kickoff">{tr({ fi: "Alkamisaika", en: "Kickoff", es: "Inicio" })}</option><option value="decision">{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}</option><option value="edge">Edge</option><option value="trust">Trust</option><option value="confidence">{tr({ fi: "Datan varmuus", en: "Data confidence", es: "Confianza de datos" })}</option></select></label></> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sc-border)] pt-4 text-xs text-[var(--sc-muted)]">
          <span role="status">{loading ? tr({ fi: "Haetaan otteluita…", en: "Loading matches…", es: "Cargando partidos…" }) : error ? "–" : `${visibleEvents.length} / ${events.length} ${tr({ fi: "ottelua", en: "matches", es: "partidos" })}`} · {tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" })}: {updated}</span>
          {filtersActive ? <button type="button" onClick={resetViewFilters} className="font-bold text-[var(--sc-brand)] underline">{tr({ fi: "Tyhjennä näkymän rajaukset", en: "Clear view filters", es: "Limpiar filtros" })}</button> : null}
        </div>
      </div>

      {data?.partialUpstream ? <div role="status" className="mt-4 rounded-xl border border-amber-400/30 p-4 text-sm text-[var(--sc-text)]">{tr({ fi: "Osan sarjoista tai markkinoista tietoja ei saatu. Muut ottelut ovat selattavissa.", en: "Some leagues or markets could not be loaded. Other matches remain available.", es: "No se pudieron cargar algunas ligas o mercados. Los demás partidos están disponibles." })}{data.unavailableLeagues?.length ? <span className="mt-1 block text-[var(--sc-muted)]">{data.unavailableLeagues.map(item => leagueTitle(item.sportKey)).join(", ")}</span> : null}</div> : null}
      {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-400/30 p-5 text-[var(--sc-text)]"><p>{requestErrorText(error, tr)}</p><button type="button" onClick={refresh} className="sc-button-secondary mt-3">{tr({ fi: "Yritä uudelleen", en: "Try again", es: "Reintentar" })}</button></div> : null}
      {loading ? <div role="status" className="mt-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Haetaan ajantasaiset ottelut. Analyysin avaaminen tarkistaa hinnan ja päätöksen uudelleen.", en: "Loading current fixtures. Opening an analysis checks the price and decision again.", es: "Cargando eventos actuales. Abrir el análisis vuelve a comprobar cuota y decisión." })}<div aria-hidden="true" className="mt-3 grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map(key => <div key={key} className="h-32 animate-pulse rounded-2xl bg-[var(--sc-surface-soft)]" />)}</div></div> : null}
      {!loading && !error && !visibleEvents.length ? <div className="mt-5"><EmptyState title={tr({ fi: "Otteluita ei löytynyt näillä rajauksilla", en: "No events match these filters", es: "No hay eventos con estos filtros" })} description={tr({ fi: "Poista haku tai päivärajaus, tai valitse toinen sarja. Kaikki ottelut -näkymä näyttää myös kohteet, joita ei ole vielä analysoitu.", en: "Clear the search or date filter, or choose another league. All matches includes events that have not been analyzed yet.", es: "Quita filtros o elige otra liga. Todos los partidos incluye eventos sin analizar." })} actionHref="/events" actionLabel={tr({ fi: "Kaikki ottelut", en: "All matches", es: "Todos los partidos" })} />{filtersActive ? <button type="button" onClick={resetViewFilters} className="sc-button-secondary mt-3">{tr({ fi: "Poista rajaukset", en: "Clear filters", es: "Quitar filtros" })}</button> : null}</div> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {visibleEvents.slice(0, shownCount).map(event => {
          const primary = event.primarySelection;
          const href = `/event/${encodeURIComponent(event.id)}?sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(primary?.selection || primary?.label || "")}&returnTo=${encodeURIComponent(eventFiltersHref(filters))}`;
          const journeyHref = `/match-intelligence?eventId=${encodeURIComponent(event.id)}&sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(primary?.selection || primary?.label || "")}`;
          const kickoff = timing(event.commenceTime, locale, tr);
          return <article key={event.id} className="sc-surface flex flex-col rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3"><MatchIdentity homeTeam={event.homeTeam} awayTeam={event.awayTeam} meta={event.league} />{primary ? <DecisionBadge decision={event.decision} /> : null}</div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><time dateTime={event.commenceTime || undefined} title={kickoff.full} className="font-bold text-[var(--sc-text)]">{kickoff.short}</time><span className="text-xs text-[var(--sc-muted)]">{primary ? primary.bookmaker || "" : tr({ fi: "Analyysi avattaessa", en: "Analyze on opening", es: "Analizar al abrir" })}</span></div>
            {primary ? <div className="my-4"><div className="flex justify-between gap-3 text-lg font-black text-[var(--sc-text)]"><span>{primary.selection || primary.label}</span><span>{decimal(primary.odds)}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><MetricTile compact label="Edge" value={percent(primary.edge)} /><MetricTile compact label="EV" value={percent(primary.ev)} /><MetricTile compact label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={decimal(primary.fairOdds)} /></div><MarketPickExplanation pick={primary} /></div> : <p className="my-4 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Ottelu on haettu kerroinpalvelusta. Avaa nykyiset hinnat, perustelut ja seurannan toiminnot.", en: "Fixture loaded from the odds provider. Open current prices, reasoning and tracking actions.", es: "Evento del proveedor de cuotas. Abre precios, análisis y seguimiento." })}</p>}
            <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--sc-border)] pt-4"><Link href={href} className="sc-button-primary flex-1 text-center">{tr({ fi: "Avaa ottelu ja analyysi", en: "Open match and analysis", es: "Abrir partido y análisis" })}</Link>{analysis ? <Link href={journeyHref} className="sc-button-secondary">Match Journey</Link> : null}</div>
          </article>;
        })}
      </div>
      {shownCount < visibleEvents.length ? <button type="button" onClick={() => setPageState({ key: pageKey, count: shownCount + 24 })} className="sc-button-secondary mt-5 w-full">{tr({ fi: `Näytä lisää (${visibleEvents.length - shownCount} jäljellä)`, en: `Show more (${visibleEvents.length - shownCount} remaining)`, es: `Ver más (${visibleEvents.length - shownCount} restantes)` })}</button> : null}
    </section>
    <p className="text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "Ottelulista kattaa valittujen sarjojen saatavilla olevat ottelut. Analysoitujen kohteiden lista on rajattu otos, eikä käyttöliittymä korota yhtään kohdetta PLAY-tilaan.", en: "The directory covers available fixtures in selected leagues. Analyzed selections are a limited sample; the UI never upgrades a selection to PLAY.", es: "El directorio cubre eventos disponibles en las ligas elegidas. El análisis es una muestra limitada; la interfaz nunca eleva una selección a PLAY." })}</p>
  </div>;
}
