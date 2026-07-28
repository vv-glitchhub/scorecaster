"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./components/LanguageProvider";
import { DecisionBadge, EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "./components/ProductUI";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const num = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const tone = (status) => status === "ready" || status === "healthy" ? "green" : status === "blocked" || status === "degraded" ? "red" : "yellow";

export default function ScorecasterReadyClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sport, setSport] = useState("");
  const [eventId, setEventId] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  async function load(nextSport = sport, nextEventId = eventId) {
    setLoading(true); setError("");
    const params = new URLSearchParams({ hours: "2160", limit: "10000" });
    if (nextSport) params.set("sport", nextSport);
    if (nextEventId) params.set("eventId", nextEventId);
    try {
      const response = await fetch(`/api/scorecaster-app?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Data unavailable");
      setData(payload);
      if (!nextEventId && payload.selectedEventId) setEventId(payload.selectedEventId);
    } catch (cause) { setError(cause.message || "Data unavailable"); setData(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load("", ""); }, []);
  const control = data?.controlCenter;
  const v3 = data?.intelligenceV3;
  const v4 = data?.intelligenceV4;
  const selectedEvent = useMemo(() => data?.events?.find((event) => event.eventId === data.selectedEventId) || null, [data]);
  const selectedRecords = useMemo(() => data?.records?.filter((row) => row.eventId === data.selectedEventId) || [], [data]);
  const updated = data?.generatedAt ? new Date(data.generatedAt).toLocaleString(locale) : "–";

  const heroAside = <div>
    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{tr({ fi: "Tuotantovalmius", en: "Production readiness", es: "Preparación" })}</div>
    <div className="mt-2 text-5xl font-black text-white">{control?.readiness?.score ?? 0}<span className="text-xl text-slate-500">/100</span></div>
    <div className="mt-3"><DecisionBadge decision={control?.readiness?.status === "ready" ? "WATCH" : "SKIP"} /></div>
  </div>;

  return <div className="space-y-7">
    <PageHero
      eyebrow={tr({ fi: "Scorecaster — valmis käyttöön", en: "Scorecaster — ready to use", es: "Scorecaster — listo" })}
      title={tr({ fi: "Kaikki julkaistava urheiludata yhdessä sovelluksessa.", en: "All publishable sports data in one application.", es: "Todos los datos deportivos publicables en una aplicación." })}
      description={tr({ fi: "Valitse ottelu ja näe markkina, malliarvio, simulaatio, datan laatu, lähteet, riskit, kalibrointi, closing line ja paper-only päätös samassa näkymässä.", en: "Select an event and see market, model, simulation, data quality, sources, risks, calibration, closing line and the paper-only decision in one view.", es: "Selecciona un evento y revisa mercado, modelo, simulación, calidad, fuentes, riesgos, calibración y decisión simulada." })}
      actions={<><Link href="/betting" className="sc-button-primary">{tr({ fi: "Avaa kaikki markkinat", en: "Open all markets", es: "Abrir mercados" })}</Link><Link href="/production-control-center" className="sc-button-secondary">{tr({ fi: "Tuotannon valvonta", en: "Production control", es: "Control de producción" })}</Link><button onClick={() => load()} className="sc-button-ghost">{tr({ fi: "Päivitä data", en: "Refresh data", es: "Actualizar" })}</button></>}
      aside={heroAside}
    />

    <TrustBar items={[
      { label: tr({ fi: "Collector", en: "Collector", es: "Collector" }), value: data?.collectorHealth?.status || "unknown", tone: tone(data?.collectorHealth?.status) },
      { label: tr({ fi: "Päivitetty", en: "Updated", es: "Actualizado" }), value: updated, tone: "info" },
      { label: tr({ fi: "Data", en: "Data", es: "Datos" }), value: tr({ fi: "vain publishable", en: "publishable only", es: "solo publicables" }), tone: "info" },
      { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: tr({ fi: "paper-only", en: "paper only", es: "solo simulación" }), tone: "warning" }
    ]} />

    {error && <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-red-100"><div className="font-black">{error}</div><div className="mt-2 text-sm text-red-200">{tr({ fi: "Collector V1 pitää aktivoida tuotantoon ennen kuin kaikki data näkyy.", en: "Collector V1 must be activated in production before all data becomes visible.", es: "Collector V1 debe activarse en producción." })}</div></div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile label={tr({ fi: "Havaintoja", en: "Observations", es: "Observaciones" })} value={loading ? "…" : control?.summary?.records ?? 0} />
      <MetricTile label={tr({ fi: "Tapahtumia", en: "Events", es: "Eventos" })} value={loading ? "…" : control?.summary?.events ?? 0} />
      <MetricTile label={tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })} value={loading ? "…" : control?.summary?.sources ?? 0} />
      <MetricTile label={tr({ fi: "Tuoreus", en: "Freshness", es: "Actualidad" })} value={loading ? "…" : `${num(control?.summary?.freshnessHours, 1)} h`} tone={Number(control?.summary?.freshnessHours || 99) <= 2 ? "green" : "yellow"} />
    </section>

    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 sm:p-6">
      <SectionHeader eyebrow={tr({ fi: "Suodatus", en: "Filters", es: "Filtros" })} title={tr({ fi: "Valitse laji ja ottelu", en: "Choose sport and event", es: "Elige deporte y evento" })} />
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
        <select value={sport} onChange={(e) => { setSport(e.target.value); setEventId(""); void load(e.target.value, ""); }} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white">
          <option value="">{tr({ fi: "Kaikki lajit", en: "All sports", es: "Todos" })}</option>
          {(data?.catalogue?.sports || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={data?.selectedEventId || eventId} onChange={(e) => { setEventId(e.target.value); void load(sport, e.target.value); }} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white">
          {(data?.events || []).map((event) => <option key={event.eventId} value={event.eventId}>{event.sport || "sport"} · {event.league || "league"} · {event.eventId}</option>)}
        </select>
        <button onClick={() => setShowRaw((value) => !value)} className="sc-button-secondary">{showRaw ? tr({ fi: "Piilota raakadata", en: "Hide raw data", es: "Ocultar datos" }) : tr({ fi: "Näytä kaikki data", en: "Show all data", es: "Mostrar datos" })}</button>
      </div>
    </section>

    {!loading && !selectedEvent && !error && <EmptyState title={tr({ fi: "Ei vielä julkaistavaa tapahtumadataa", en: "No publishable event data yet", es: "Sin datos publicables" })} description={tr({ fi: "Aktivoi Collector ja anna workerin kerätä havaintoja.", en: "Activate Collector and allow the worker to collect observations.", es: "Activa Collector para recopilar observaciones." })} />}

    {selectedEvent && <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">{selectedEvent.sport} · {selectedEvent.league}</div>
          <h2 className="mt-2 break-all text-2xl font-black text-white">{selectedEvent.eventId}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile compact label={tr({ fi: "Markkina", en: "Market", es: "Mercado" })} value={pct(v3?.scout?.marketProbability)} />
            <MetricTile compact label={tr({ fi: "Malli", en: "Model", es: "Modelo" })} value={pct(v3?.scout?.modelProbability)} tone="green" />
            <MetricTile compact label={tr({ fi: "Simulaatio", en: "Simulation", es: "Simulación" })} value={pct(v3?.simulator?.simulatedProbability)} />
            <MetricTile compact label={tr({ fi: "Datan laatu", en: "Data quality", es: "Calidad" })} value={`${num(v3?.scout?.dataQuality?.score, 0)}/100`} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricTile compact label={tr({ fi: "Havaintoja", en: "Records", es: "Registros" })} value={selectedEvent.recordCount} />
            <MetricTile compact label={tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })} value={selectedEvent.sources?.length || 0} />
            <MetricTile compact label={tr({ fi: "Mittareita", en: "Metrics", es: "Métricas" })} value={selectedEvent.metrics?.length || 0} />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI Coach</div>
          <div className="mt-3"><DecisionBadge decision={v3?.coach?.verdict || "SKIP"} /></div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{v3?.coach?.summary || tr({ fi: "Ei riittävästi dataa päätökseen.", en: "Not enough data for a decision.", es: "Datos insuficientes." })}</p>
          <div className="mt-5 space-y-2 text-xs text-slate-400">{(v3?.coach?.missing || []).map((item) => <div key={item}>• {item}</div>)}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow="Daily Top 3" title={tr({ fi: "Päivän parhaat seurattavat", en: "Best events to monitor", es: "Mejores eventos" })} />
          <div className="space-y-3">{(control?.dailyTop3 || []).map((pick, index) => <div key={pick.eventId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-emerald-300">#{index + 1} · {pick.score}/100</div><div className="mt-1 break-all font-bold text-white">{pick.eventId}</div></div><DecisionBadge decision={pick.decision} /></div><div className="mt-3 grid grid-cols-3 gap-2"><MetricTile compact label="Edge" value={pct(pick.edge)} /><MetricTile compact label={tr({ fi: "Laatu", en: "Quality", es: "Calidad" })} value={pct(pick.quality)} /><MetricTile compact label={tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} value={num(pick.bestOdds)} /></div></div>)}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow={tr({ fi: "Mallit", en: "Models", es: "Modelos" })} title={tr({ fi: "Mallien vertailu", en: "Model comparison", es: "Comparación" })} />
          <div className="space-y-3">{(control?.models || []).map((model) => <div key={model.metric} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border border-white/10 p-4"><div><div className="font-bold text-white">{model.name}</div><div className="text-xs text-slate-500">{model.observations} obs · {model.events} events</div></div><div className="text-xl font-black text-white">{model.score}</div><div className="rounded-xl bg-white/10 px-3 py-2 font-black text-emerald-200">{model.grade}</div></div>)}</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow={tr({ fi: "Kalibrointi", en: "Calibration", es: "Calibración" })} title={tr({ fi: "Onko malli oikeasti tarkka?", en: "Is the model actually accurate?", es: "¿Es preciso el modelo?" })} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><MetricTile compact label="Samples" value={control?.calibration?.count || 0} /><MetricTile compact label="Brier" value={num(control?.calibration?.brier, 4)} /><MetricTile compact label="Log loss" value={num(control?.calibration?.logLoss, 4)} /><MetricTile compact label="Grade" value={control?.calibration?.grade || "N/A"} /></div></div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow="Closing line" title={tr({ fi: "Kertoimien liike ja CLV", en: "Odds movement and CLV", es: "Movimiento y CLV" })} /><div className="grid grid-cols-2 gap-3"><MetricTile compact label={tr({ fi: "Tapahtumia", en: "Events", es: "Eventos" })} value={control?.closingLine?.count || 0} /><MetricTile compact label="Average price CLV" value={pct(control?.closingLine?.averagePriceClv)} /></div></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow={tr({ fi: "Riskit", en: "Risks", es: "Riesgos" })} title={tr({ fi: "Järjestelmän aktiiviset varoitukset", en: "Active system warnings", es: "Alertas activas" })} /><div className="grid gap-3 md:grid-cols-2">{(v4?.riskSignals || []).map((signal) => <div key={signal.code} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="text-xs font-black uppercase tracking-wider text-yellow-300">{signal.severity} · {signal.code}</div><div className="mt-2 text-sm text-slate-300">{signal.message}</div></div>)}</div></section>

      {showRaw && <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6"><SectionHeader eyebrow={tr({ fi: "Kaikki data", en: "All data", es: "Todos los datos" })} title={tr({ fi: "Valitun tapahtuman julkaistavat havainnot", en: "Publishable observations for the selected event", es: "Observaciones publicables" })} /><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="p-2">Time</th><th className="p-2">Source</th><th className="p-2">Entity</th><th className="p-2">Metric</th><th className="p-2">Value</th><th className="p-2">Confidence</th><th className="p-2">Trust</th></tr></thead><tbody>{selectedRecords.map((row, index) => <tr key={`${row.sourceId}-${row.metric}-${row.observedAt}-${index}`} className="border-t border-white/5 text-slate-300"><td className="whitespace-nowrap p-2">{new Date(row.observedAt).toLocaleString(locale)}</td><td className="p-2">{row.sourceId}</td><td className="p-2">{row.entityId || "–"}</td><td className="p-2 font-bold text-white">{row.metric}</td><td className="p-2">{row.value ?? "–"} {row.unit || ""}</td><td className="p-2">{pct(row.confidence)}</td><td className="p-2">{pct(row.sourceTrust)}</td></tr>)}</tbody></table></div></section>}
    </>}

    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-6"><div className="font-black text-amber-100">{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</div><div className="mt-2 text-sm leading-6 text-amber-100/80">{tr({ fi: "Scorecaster käyttää vain julkaistavaksi hyväksyttyä dataa. Tutkimusdata ei muuta tuotantotodennäköisyyttä, sovellus ei aseta vetoja eikä siirrä rahaa. Kaikki panos- ja tuottolaskelmat ovat virtuaalisia euroja.", en: "Scorecaster uses only approved publishable data. Research data cannot change production probability, the app does not place bets or move money, and all stake and return calculations are virtual euros.", es: "Scorecaster usa solo datos publicables aprobados. No realiza apuestas ni mueve dinero; todos los cálculos son virtuales en euros." })}</div></section>
  </div>;
}
