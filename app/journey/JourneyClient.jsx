"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildRecommendationJourney } from "../../lib/recommendation-journey-v1.mjs";
import { useLanguage } from "../components/LanguageProvider";
import { DecisionBadge, EmptyState, MetricTile, PageHero, TrustBar } from "../components/ProductUI";
import { formatPercent } from "../../lib/analysis-engine";

function keyOf(item) {
  return `${item?.event_id || item?.eventId || ""}::${item?.selection || ""}`;
}

function initialQuery() {
  if (typeof window === "undefined") return { eventId: "", selection: "" };
  const params = new URLSearchParams(window.location.search);
  return { eventId: params.get("eventId") || "", selection: params.get("selection") || "" };
}

function formatDate(value, locale) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function gateName(code, tr) {
  return ({
    "fresh-data": tr({ fi: "tuore data", en: "fresh data", es: "datos recientes" }),
    "bookmaker-coverage": tr({ fi: "bookmaker-kattavuus", en: "bookmaker coverage", es: "cobertura de casas" }),
    confidence: tr({ fi: "confidence", en: "confidence", es: "confianza" }),
    edge: "edge",
    ev: "EV",
    "verified-evidence": tr({ fi: "verified evidence", en: "verified evidence", es: "evidencia verificada" }),
    "safety-recheck": "final safety check",
    "maintain-play-gates": tr({ fi: "PLAY-porttien ylläpito", en: "maintain PLAY gates", es: "mantener filtros PLAY" })
  })[code] || code || "–";
}

function eventText(item, tr) {
  if (item.type === "first-observation") return tr({ fi: `Ensimmäinen varmennettu snapshot: kerroin ${Number(item.odds || 0).toFixed(2)} · ${item.decision}.`, en: `First verified snapshot: odds ${Number(item.odds || 0).toFixed(2)} · ${item.decision}.`, es: `Primer snapshot verificado: cuota ${Number(item.odds || 0).toFixed(2)} · ${item.decision}.` });
  if (item.type === "decision-change") return `${item.previousDecision} → ${item.currentDecision}`;
  if (item.type === "price-move") return `${Number(item.previousOdds || 0).toFixed(2)} → ${Number(item.currentOdds || 0).toFixed(2)} (${formatPercent(item.relativeMove)})`;
  if (item.type.endsWith("-gate")) return `${item.label} · ${formatPercent(item.previousValue)} → ${formatPercent(item.currentValue)}`;
  if (item.type === "best-bookmaker-change") return item.label;
  return item.label || item.type;
}

function EventRow({ item, locale, tr }) {
  const tone = item.severity === "high" ? "border-rose-400/25 bg-rose-400/7" : item.severity === "medium" ? "border-amber-400/25 bg-amber-400/7" : "border-sky-400/20 bg-sky-400/6";
  return <article className={`rounded-[1.15rem] border p-4 ${tone}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{item.type}</div><time className="text-xs font-bold text-[var(--sc-muted)]">{formatDate(item.capturedAt, locale)}</time></div><div className="mt-2 font-black text-[var(--sc-text)]">{eventText(item, tr)}</div>{item.type !== "first-observation" && <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--sc-muted)]"><span>odds {item.odds ? Number(item.odds).toFixed(2) : "–"}</span><span>edge {formatPercent(item.edge)}</span><span>EV {formatPercent(item.ev)}</span><span>conf {formatPercent(item.confidence)}</span></div>}</article>;
}

export default function JourneyClient() {
  const { tr, locale } = useLanguage();
  const [watchlist, setWatchlist] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [currentRecommendation, setCurrentRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");

  async function loadBase() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/watchlist", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setSignedOut(true);
        setWatchlist([]);
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Watchlist unavailable");
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setWatchlist(items);
      const query = initialQuery();
      const wanted = items.find((item) => item.event_id === query.eventId && item.selection === query.selection);
      const next = wanted || items[0] || null;
      setSelectedKey(next ? keyOf(next) : "");
      setSignedOut(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Journey unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadBase(); }, []);

  const selected = useMemo(() => watchlist.find((item) => keyOf(item) === selectedKey) || null, [watchlist, selectedKey]);

  useEffect(() => {
    if (!selected) {
      setTimeline(null);
      setCurrentRecommendation(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      setDetailLoading(true);
      setError("");
      try {
        const timelineUrl = `/api/cloud/market-timeline?eventId=${encodeURIComponent(selected.event_id)}&selection=${encodeURIComponent(selected.selection)}`;
        const [timelineResponse, recommendationResponse] = await Promise.all([
          fetch(timelineUrl, { cache: "no-store" }),
          fetch("/api/recommendations?limit=20", { cache: "no-store" })
        ]);
        const [timelinePayload, recommendationPayload] = await Promise.all([timelineResponse.json(), recommendationResponse.json()]);
        if (!timelineResponse.ok) throw new Error(timelinePayload?.error || "Market timeline unavailable");
        if (!active) return;
        setTimeline(timelinePayload?.timeline || null);
        const current = (recommendationPayload?.recommendations || []).find((item) => item.eventId === selected.event_id && item.selection === selected.selection) || null;
        setCurrentRecommendation(current);
      } catch (nextError) {
        if (!active) return;
        setTimeline(null);
        setCurrentRecommendation(null);
        setError(nextError instanceof Error ? nextError.message : "Journey detail unavailable");
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => { active = false; };
  }, [selected]);

  const journey = useMemo(() => buildRecommendationJourney(timeline || {}, currentRecommendation), [timeline, currentRecommendation]);
  const current = journey.current;

  if (signedOut) return <div className="space-y-6"><PageHero eyebrow="Recommendation Journey V1" title={tr({ fi: "Kirjaudu nähdäksesi oman seurannan päätöshistorian", en: "Sign in to see your monitored decision history", es: "Inicia sesión para ver el historial" })} description={tr({ fi: "Journey perustuu käyttäjäkohtaiseen Watchlistiin ja Market Timeline -snapshotteihin.", en: "Journey is based on your private Watchlist and Market Timeline snapshots.", es: "Journey se basa en tu Watchlist privado y snapshots de mercado." })} actions={<Link href="/login" className="sc-button-primary">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>} /></div>;

  return <div className="space-y-7">
    <PageHero eyebrow="Recommendation Journey V1" title={tr({ fi: "Näe miten kohteen hinta, päätös ja PLAY-portit ovat kehittyneet", en: "See how price, decision and PLAY gates evolved", es: "Mira cómo evolucionaron cuota, decisión y filtros PLAY" })} description={tr({ fi: "Journey näyttää vain tallennetun serverihistorian. Historiallista independent-evidence readinessia ei rekonstruoida jälkikäteen; nykyinen evidenssitila näytetään erikseen.", en: "Journey shows only stored server history. Historical independent-evidence readiness is not reconstructed after the fact; current evidence state is shown separately.", es: "Journey muestra solo historial guardado. La evidencia histórica independiente no se reconstruye; el estado actual se muestra aparte." })} actions={<><button type="button" disabled={loading} onClick={() => void loadBase()} className="sc-button-primary">{loading ? tr({ fi: "Päivitetään…", en: "Refreshing…", es: "Actualizando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/watchlist" className="sc-button-secondary">Watchlist</Link><Link href="/auto-watch" className="sc-button-ghost">Auto-Watch</Link></>} />

    {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}
    {!loading && !watchlist.length ? <EmptyState title={tr({ fi: "Journey tarvitsee seurattavan kohteen", en: "Journey needs a watched pick", es: "Journey necesita una selección seguida" })} description={tr({ fi: "Lisää kohde Watchlistiin tai ota Auto-Watch käyttöön. Serveri alkaa tallentaa Market Timeline -snapshotteja.", en: "Add a pick to Watchlist or enable Auto-Watch. The server will capture Market Timeline snapshots.", es: "Añade una selección o activa Auto-Watch para capturar snapshots." })} actionHref="/auto-watch" actionLabel="Auto-Watch" /> : null}

    {watchlist.length > 0 && <section className="sc-surface rounded-[1.4rem] p-4"><label className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Seurattava kohde", en: "Watched pick", es: "Selección seguida" })}<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} className="sc-input mt-2"><option value="">–</option>{watchlist.map((item) => <option key={keyOf(item)} value={keyOf(item)}>{item.match} · {item.selection}</option>)}</select></label></section>}

    {selected && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricTile label={tr({ fi: "Snapshotit", en: "Snapshots", es: "Snapshots" })} value={detailLoading ? "…" : String(journey.summary.observations || 0)} /><MetricTile label={tr({ fi: "Päätösmuutokset", en: "Decision changes", es: "Cambios decisión" })} value={detailLoading ? "…" : String(journey.summary.decisionChanges || 0)} tone="purple" /><MetricTile label={tr({ fi: "Hintaliikkeet ≥3%", en: "Price moves ≥3%", es: "Movimientos ≥3%" })} value={detailLoading ? "…" : String(journey.summary.significantPriceMoves || 0)} tone="blue" /><MetricTile label={tr({ fi: "Gate-muutokset", en: "Gate changes", es: "Cambios filtro" })} value={detailLoading ? "…" : String(journey.summary.gateChanges || 0)} tone="yellow" /><MetricTile label={tr({ fi: "Nykyinen päätös", en: "Current decision", es: "Decisión actual" })} value={current?.decision || "–"} tone={current?.decision === "PLAY" ? "green" : "yellow"} /></section>

      {current && <section className="sc-surface rounded-[1.5rem] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">{tr({ fi: "Nykyinen Recommendation Engine -tila", en: "Current Recommendation Engine state", es: "Estado actual del motor" })}</div><h2 className="mt-2 text-xl font-black text-[var(--sc-text)]">{selected.match} · {selected.selection}</h2></div><DecisionBadge decision={current.decision} /></div><TrustBar className="mt-4" items={[{ label: "Rank", value: current.rank || "–", tone: "info" }, { label: "Score", value: current.score !== null ? `${Number(current.score).toFixed(1)}/100` : "–", tone: "info" }, { label: tr({ fi: "Evidenssi nyt", en: "Evidence now", es: "Evidencia ahora" }), value: current.readiness || "–", tone: current.readiness === "verified" ? "good" : "warning" }, { label: tr({ fi: "Seuraava portti", en: "Next gate", es: "Siguiente filtro" }), value: gateName(current.nextGate?.code, tr), tone: current.nearPlay ? "warning" : "info" }, { label: "Mode", value: "paper-only", tone: "warning" }]} /><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><MetricTile compact label="Odds" value={current.odds ? Number(current.odds).toFixed(2) : "–"} /><MetricTile compact label="Edge" value={formatPercent(current.edge)} /><MetricTile compact label="EV" value={formatPercent(current.ev)} /><MetricTile compact label="Confidence" value={formatPercent(current.confidence)} /></div></section>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="sc-surface rounded-[1.5rem] p-5"><h2 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Journey-aikajana", en: "Journey timeline", es: "Línea temporal" })}</h2><div className="mt-4 space-y-3">{journey.events.length ? journey.events.map((item, index) => <EventRow key={`${item.type}-${item.capturedAt}-${index}`} item={item} locale={locale} tr={tr} />) : <EmptyState title={tr({ fi: "Snapshot-historiaa ei ole vielä riittävästi", en: "Not enough snapshot history yet", es: "Aún no hay suficiente historial" })} />}</div></div><aside className="sc-surface rounded-[1.5rem] p-5"><div className="text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Auditointiraja", en: "Audit boundary", es: "Límite de auditoría" })}</div><ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--sc-muted)]"><li>• {tr({ fi: "Hinta, päätös, edge, EV ja confidence tulevat tallennetuista serverisnapshoteista.", en: "Price, decision, edge, EV and confidence come from stored server snapshots.", es: "Cuota, decisión, edge, EV y confianza vienen de snapshots guardados." })}</li><li>• {tr({ fi: "Historiallista evidenssitilaa ei arvata.", en: "Historical evidence readiness is never guessed.", es: "La evidencia histórica nunca se adivina." })}</li><li>• {tr({ fi: "Journey ei muuta probabilitya tai päätöstä.", en: "Journey never changes probability or decision.", es: "Journey no cambia probabilidad ni decisión." })}</li><li>• paper-only</li></ul></aside></section>
    </>}
  </div>;
}
