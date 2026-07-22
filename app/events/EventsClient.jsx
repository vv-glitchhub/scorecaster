"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  DecisionBadge,
  EmptyState,
  MatchIdentity,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

const FILTERS = [
  { key: "all", sport: "", label: { fi: "Kaikki", en: "All", es: "Todos" } },
  { key: "nhl", sport: "icehockey_nhl", label: { fi: "NHL", en: "NHL", es: "NHL" } },
  { key: "nba", sport: "basketball_nba", label: { fi: "NBA", en: "NBA", es: "NBA" } },
  { key: "epl", sport: "soccer_epl", label: { fi: "EPL", en: "EPL", es: "EPL" } },
  { key: "laliga", sport: "soccer_spain_la_liga", label: { fi: "La Liga", en: "La Liga", es: "La Liga" } },
  { key: "liiga", sport: "icehockey_finland_liiga", label: { fi: "Liiga", en: "Liiga", es: "Liiga" } },
  { key: "shl", sport: "icehockey_sweden_hockey_league", label: { fi: "SHL", en: "SHL", es: "SHL" } }
];

function eventId(pick = {}) {
  return String(pick.gameId || pick.eventId || pick.id || "");
}

function decision(pick = {}) {
  const value = String(pick.productDecision || pick.decision || "CAUTION").toUpperCase();
  if (value === "BET") return "PLAY";
  if (value === "PASS") return "SKIP";
  return value === "PLAY" || value === "SKIP" ? value : "CAUTION";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)} %` : "–";
}

export default function EventsClient() {
  const { tr, locale } = useLanguage();
  const [filter, setFilter] = useState(FILTERS[0]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);
  const [source, setSource] = useState("loading");

  const load = useCallback(async (selected = filter) => {
    setLoading(true);
    setError("");
    try {
      const query = selected.sport ? `?sports=${encodeURIComponent(selected.sport)}` : "";
      const response = await fetch(`/api/top-picks${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Events unavailable");
      setPicks(Array.isArray(data.data) ? data.data : []);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
      setSource(data.fixtureSource || data.source || "live-odds-provider-only");
    } catch (loadError) {
      setPicks([]);
      setSource("error");
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Otteluita ei voitu ladata.", en: "Events could not be loaded.", es: "No se pudieron cargar los eventos." }));
    } finally {
      setLoading(false);
    }
  }, [filter, tr]);

  useEffect(() => { void load(filter); }, [filter, load]);

  const events = useMemo(() => {
    const map = new Map();
    for (const pick of picks) {
      const id = eventId(pick);
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          id,
          match: pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`,
          homeTeam: pick.homeTeam,
          awayTeam: pick.awayTeam,
          commenceTime: pick.commenceTime,
          league: pick.leagueTitle || pick.league,
          sportKey: pick.sportKey || pick.league,
          selections: []
        });
      }
      map.get(id).selections.push(pick);
    }
    return [...map.values()].sort((left, right) => Date.parse(left.commenceTime || "") - Date.parse(right.commenceTime || ""));
  }, [picks]);

  const summary = useMemo(() => {
    const bestByEvent = events.map((event) => event.selections.slice().sort((a, b) => Number(b.edge || 0) - Number(a.edge || 0))[0]).filter(Boolean);
    return {
      play: bestByEvent.filter((pick) => decision(pick) === "PLAY").length,
      caution: bestByEvent.filter((pick) => decision(pick) === "CAUTION").length,
      skip: bestByEvent.filter((pick) => decision(pick) === "SKIP").length
    };
  }, [events]);

  const updated = generatedAt
    ? new Date(generatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : tr({ fi: "ei saatavilla", en: "unavailable", es: "no disponible" });

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Daily Flow V3 · Event Detail V1"
        title={tr({ fi: "Valitse ottelu, tarkista päätös ja jatka oikeaan toimintoon", en: "Choose an event, verify the decision and continue to the right action", es: "Elige un evento, verifica la decisión y continúa con la acción adecuada" })}
        description={tr({
          fi: "Hakemisto näyttää vain nykyisestä varmennetusta live-analyysistä löytyvät ottelut. Avaa ottelu nähdäksesi markkinan, evidenssin, vireen, levon ja paperitoiminnot yhdessä.",
          en: "The directory shows only events found in the current verified live analysis. Open an event to review market data, evidence, form, rest and paper-only actions together.",
          es: "El directorio muestra únicamente eventos del análisis en vivo verificado. Abre uno para revisar mercado, evidencia, forma, descanso y acciones simuladas."
        })}
        actions={
          <>
            <button type="button" onClick={() => void load()} disabled={loading} className="sc-button-primary disabled:opacity-50">
              {loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä ottelut", en: "Refresh events", es: "Actualizar eventos" })}
            </button>
            <Link href="/watchlist" className="sc-button-secondary">{tr({ fi: "Avaa seurantalista", en: "Open watchlist", es: "Abrir seguimiento" })}</Link>
          </>
        }
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Ottelut", en: "Events", es: "Eventos" })} value={loading ? "…" : events.length} tone="blue" /><MetricTile compact label="PLAY" value={loading ? "…" : summary.play} tone="green" /><MetricTile compact label="CAUTION" value={loading ? "…" : summary.caution} tone="yellow" /><MetricTile compact label="SKIP" value={loading ? "…" : summary.skip} tone="red" /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Lähde", en: "Source", es: "Fuente" }), value: source },
        { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: updated, tone: "info" },
        { label: tr({ fi: "Suodatin", en: "Filter", es: "Filtro" }), value: tr(filter.label), tone: "info" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "vain varmennetut tapahtumat", en: "verified events only", es: "solo eventos verificados" }), tone: "warning" }
      ]} />

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Otteluhakemisto", en: "Event directory", es: "Directorio de eventos" })}
          title={tr({ fi: "Lähiajan varmennetut ottelut", en: "Verified near-term events", es: "Eventos próximos verificados" })}
          description={tr({ fi: "Suodata liigaa tai avaa ottelu suoraan yksityiskohtaiseen auditointiin.", en: "Filter by league or open an event directly into the detailed audit.", es: "Filtra por liga o abre un evento directamente en la auditoría detallada." })}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" onClick={() => setFilter(item)} className={`min-h-11 rounded-full border px-4 text-sm font-black transition ${filter.key === item.key ? "border-[var(--sc-brand)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)] hover:text-[var(--sc-text)]"}`}>
              {tr(item.label)}
            </button>
          ))}
        </div>

        {error && <div className="rounded-[1.25rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
        {!loading && events.length === 0 && !error && <EmptyState title={tr({ fi: "Otteluita ei löytynyt tällä suodattimella", en: "No events found for this filter", es: "No se encontraron eventos con este filtro" })} description={tr({ fi: "Nykyinen Top Picks -analyysi ei sisällä tämän liigan lähiajan tapahtumia.", en: "The current Top Picks analysis has no near-term events for this league.", es: "El análisis actual no contiene eventos próximos de esta liga." })} actionHref="/betting" actionLabel={tr({ fi: "Avaa kaikki kohteet", en: "Open all picks", es: "Abrir todos" })} />}

        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => {
            const best = event.selections.slice().sort((a, b) => Number(b.edge || 0) - Number(a.edge || 0))[0];
            const eventDecision = decision(best);
            const href = `/event/${encodeURIComponent(event.id)}?sport=${encodeURIComponent(event.sportKey || "")}&selection=${encodeURIComponent(best?.selection || best?.label || "")}`;
            const kickoff = event.commenceTime
              ? new Date(event.commenceTime).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : tr({ fi: "Alkamisaika puuttuu", en: "Kickoff unavailable", es: "Hora no disponible" });

            return (
              <Link key={event.id} href={href} className="sc-card-hover sc-surface group block rounded-[1.55rem] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <MatchIdentity homeTeam={event.homeTeam} awayTeam={event.awayTeam} meta={`${kickoff} · ${event.league || "Sport"}`} />
                  <DecisionBadge decision={eventDecision} />
                </div>

                {best && (
                  <div className="mt-5 rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Paras nykyinen valinta", en: "Current best selection", es: "Mejor selección actual" })}</div>
                        <div className="mt-1 text-lg font-black text-[var(--sc-text)]">{best.selection || best.label} <span className="text-[var(--sc-brand)]">@ {Number(best.odds || 0).toFixed(2)}</span></div>
                      </div>
                      <div className="text-xs font-bold text-[var(--sc-muted)]">{event.selections.length} {tr({ fi: "valintaa", en: "selections", es: "selecciones" })}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MetricTile compact label="Edge" value={percent(best.edge)} tone={Number(best.edge || 0) > 0 ? "green" : "default"} />
                      <MetricTile compact label="EV" value={percent(best.ev)} tone={Number(best.ev || 0) > 0 ? "green" : "default"} />
                      <MetricTile compact label={tr({ fi: "Luottamus", en: "Confidence", es: "Confianza" })} value={percent(best.confidence)} tone="blue" />
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t border-[var(--sc-border)] pt-4 text-sm font-black">
                  <span className="text-[var(--sc-muted)]">{tr({ fi: "Markkina + evidenssi + paperitoiminnot", en: "Market + evidence + paper actions", es: "Mercado + evidencia + acciones simuladas" })}</span>
                  <span className="text-[var(--sc-brand)] transition group-hover:translate-x-1">{tr({ fi: "Avaa", en: "Open", es: "Abrir" })} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">
        {tr({ fi: "Lista sisältää vain nykyisessä Top Picks -analyysissä olevat tapahtumat. Puuttuvaa tapahtumaa ei voi avata keksityillä asiakastiedoilla.", en: "The directory contains only events in the current Top Picks analysis. A missing event cannot be opened with invented client data.", es: "La lista contiene solo eventos del análisis Top Picks actual. No se puede abrir un evento ausente con datos inventados por el cliente." })}
      </div>
    </div>
  );
}
