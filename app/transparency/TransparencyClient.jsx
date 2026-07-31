"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const isNumeric = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const showNumber = (value, digits = 4) => isNumeric(value) ? Number(value).toFixed(digits) : "–";
const showPercent = (value, digits = 1) => isNumeric(value) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

function Metric({ label, value, percent = false, digits = 4 }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{percent ? showPercent(value, digits) : showNumber(value, digits)}</div>
    </div>
  );
}

export default function TransparencyClient() {
  const { tr, locale } = useLanguage();
  const searchParams = useSearchParams();
  const requestedEventId = searchParams.get("eventId") || "";
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(requestedEventId);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/transparency?hours=2160&limit=5000", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Transparency data unavailable");
        if (!active) return;
        setOverview(payload);
        const validRequested = payload.events?.some((event) => event.eventId === requestedEventId) ? requestedEventId : "";
        setSelectedEventId((current) => validRequested || current || payload.events?.[0]?.eventId || "");
      } catch (cause) {
        if (active) setError(cause?.message || "Transparency data unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [requestedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setDetail(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/transparency?eventId=${encodeURIComponent(selectedEventId)}&hours=2160&limit=5000`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Event transparency unavailable");
        if (active) setDetail(payload);
      } catch (cause) {
        if (active) setError(cause?.message || "Event transparency unavailable");
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => { active = false; };
  }, [selectedEventId]);

  const formulas = overview?.methodology?.formulas || [];
  const sources = overview?.sourceRegistry || [];
  const events = overview?.events || [];
  const explanation = detail?.explanation || null;
  const calculations = explanation?.calculations || {};
  const records = detail?.records || [];
  const formulaNames = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula.name])), [formulas]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Open Scorecaster</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">{tr({ fi: "Jokainen päätös, lähde ja laskukaava näkyviin.", en: "Every decision, source and formula made visible.", es: "Cada decisión, fuente y fórmula a la vista." })}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Avoin näkymä julkaisee Scorecasterin omat kaavat, päätösrajat, normalisoidut syötteet, puuttuvat tiedot ja lähteiden käyttöoikeustiedot. Selitys ei muuta ennustetta jälkikäteen.", en: "The open view publishes Scorecaster's formulas, decision gates, normalized inputs, missing data and source-rights metadata. Explanations never alter a prediction after the fact.", es: "La vista abierta publica fórmulas, umbrales, datos normalizados y fuentes sin cambiar la predicción." })}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={tr({ fi: "Kaavat", en: "Formulas", es: "Fórmulas" })} value={formulas.length} digits={0} />
          <Metric label={tr({ fi: "Lähderekisteri", en: "Source registry", es: "Registro de fuentes" })} value={sources.length} digits={0} />
          <Metric label={tr({ fi: "Tapahtumat", en: "Events", es: "Eventos" })} value={events.length} digits={0} />
          <Metric label={tr({ fi: "Kirjautuminen APIin", en: "API sign-in", es: "Inicio API" })} value={0} digits={0} />
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm text-[var(--sc-text-secondary)]"><strong className="text-[var(--sc-text)]">Public JSON API:</strong> <code>/api/transparency</code> · CORS <code>*</code> · {tr({ fi: "ei kirjautumista", en: "no sign-in", es: "sin inicio" })}</div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>}
      {loading && <div className="h-72 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />}

      {!loading && (
        <>
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Decision inspector</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Tapahtuman koko päätösketju", en: "The complete event decision chain", es: "Cadena completa de decisión" })}</h2></div>
              <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="sc-input min-w-0 lg:w-[34rem]">
                {!events.length && <option value="">{tr({ fi: "Ei tapahtumia", en: "No events", es: "Sin eventos" })}</option>}
                {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventId} · {event.sport || "sport"} · {event.recordCount} records</option>)}
              </select>
            </div>

            {detailLoading && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-[var(--sc-surface-soft)]" />}
            {!detailLoading && explanation && (
              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5">
                  <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-[var(--sc-brand)] px-3 py-1 text-xs font-black text-[var(--sc-brand-ink)]">{explanation.verdict}</span><span className="text-xs text-[var(--sc-muted)]">{new Date(explanation.generatedAt).toLocaleString(locale)}</span></div>
                  <p className="mt-4 text-sm leading-7 text-[var(--sc-text-secondary)]">{explanation.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Model probability" value={calculations.modelProbability} percent />
                  <Metric label="Market probability" value={calculations.marketProbability} percent />
                  <Metric label="Edge" value={calculations.edge} percent />
                  <Metric label="EV / unit" value={calculations.expectedValuePerUnit} percent />
                  <Metric label="Best decimal odds" value={calculations.bestDecimalOdds} digits={2} />
                  <Metric label="Model fair odds" value={calculations.fairOdds} digits={2} />
                  <Metric label="Data quality" value={calculations.quality} percent />
                  <Metric label="Ranking score" value={calculations.rankingScore} digits={1} />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--sc-border)] p-5"><h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Miksi tähän ratkaisuun päädyttiin", en: "Why this decision was reached", es: "Por qué se tomó esta decisión" })}</h3><div className="mt-4 space-y-2">{(explanation.factors || []).map((factor) => <div key={factor.id} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--sc-surface-soft)] p-3 text-xs"><span className="font-bold text-[var(--sc-text-secondary)]">{factor.label}</span><span className="font-black text-[var(--sc-text)]">{isNumeric(factor.value) ? showNumber(factor.value) : factor.direction}</span></div>)}</div></div>
                  <div className="rounded-2xl border border-[var(--sc-border)] p-5"><h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Päätösportit", en: "Decision gates", es: "Umbrales" })}</h3><div className="mt-4 space-y-2">{(explanation.gateResults || []).map((gate) => <div key={gate.id} className="flex items-start gap-3 rounded-xl bg-[var(--sc-surface-soft)] p-3"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${gate.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>{gate.passed ? "✓" : "!"}</span><div><div className="text-sm font-black text-[var(--sc-text)]">{gate.id}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{gate.requirement}</div></div></div>)}</div></div>
                </div>

                {!!explanation.missingInputs?.length && <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5"><div className="font-black text-amber-100">{tr({ fi: "Puuttuvat tiedot", en: "Missing inputs", es: "Datos faltantes" })}</div><div className="mt-3 flex flex-wrap gap-2">{explanation.missingInputs.map((item) => <span key={item} className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100">{item}</span>)}</div></div>}

                <div className="rounded-2xl border border-[var(--sc-border)] p-5"><h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Käytetyt lähteet", en: "Sources used", es: "Fuentes usadas" })}</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{(explanation.sources || []).map((source) => <div key={source.id} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{source.name}</div><div className="mt-2 text-xs leading-6 text-[var(--sc-muted)]">ID: {source.id}<br />License: {source.license}<br />Observations: {source.observations}<br />Metrics: {source.metrics?.join(", ") || "–"}</div>{source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-[var(--sc-brand)]">{tr({ fi: "Avaa lähteen ehdot", en: "Open source terms", es: "Abrir términos" })}</a>}</div>)}</div></div>

                <details className="rounded-2xl border border-[var(--sc-border)] p-5"><summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: `Näytä kaikki ${records.length} normalisoitua syötettä`, en: `Show all ${records.length} normalized inputs`, es: `Mostrar ${records.length} entradas` })}</summary><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="text-[var(--sc-faint)]"><tr><th className="p-2">Source</th><th className="p-2">Metric</th><th className="p-2">Value</th><th className="p-2">Confidence</th><th className="p-2">Trust</th><th className="p-2">Observed</th></tr></thead><tbody>{records.map((record, index) => <tr key={`${record.sourceId}-${record.metric}-${record.observedAt}-${index}`} className="border-t border-[var(--sc-border)]"><td className="p-2 font-bold text-[var(--sc-text)]">{record.sourceId}</td><td className="p-2 text-[var(--sc-text-secondary)]">{record.metric}</td><td className="p-2 text-[var(--sc-text-secondary)]">{showNumber(record.value)} {record.unit || ""}</td><td className="p-2 text-[var(--sc-muted)]">{showPercent(record.confidence)}</td><td className="p-2 text-[var(--sc-muted)]">{showPercent(record.sourceTrust)}</td><td className="p-2 text-[var(--sc-muted)]">{record.observedAt ? new Date(record.observedAt).toLocaleString(locale) : "–"}</td></tr>)}</tbody></table></div></details>

                <div className="rounded-2xl border border-[var(--sc-border)] p-5"><h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Käytetyt laskukaavat", en: "Formulas used", es: "Fórmulas usadas" })}</h3><div className="mt-3 flex flex-wrap gap-2">{(explanation.formulasUsed || []).map((id) => <span key={id} className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1 text-xs font-bold text-[var(--sc-text)]">{formulaNames.get(id) || id}</span>)}</div></div>
              </div>
            )}
          </section>

          <section><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Open formulas</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki tuotannon pääkaavat", en: "All primary production formulas", es: "Todas las fórmulas principales" })}</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{formulas.map((formula) => <article key={formula.id} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{formula.id}</div><h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{formula.name}</h3><div className="mt-4 overflow-x-auto rounded-2xl bg-[var(--sc-surface-soft)] p-4 font-mono text-sm text-[var(--sc-text-secondary)]">{formula.formula}</div><p className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">{formula.note}</p><div className="mt-4 space-y-2">{Object.entries(formula.variables || {}).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(90px,auto)_1fr] gap-3 text-xs"><code className="font-black text-[var(--sc-text)]">{key}</code><span className="text-[var(--sc-muted)]">{value}</span></div>)}</div></article>)}</div></section>

          <section><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Source registry</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Lähteet, käyttöoikeudet ja rajat", en: "Sources, rights and boundaries", es: "Fuentes, derechos y límites" })}</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{sources.map((source) => <article key={source.id} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{source.id}</div><h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{source.name}</h3></div><span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-[10px] font-black text-[var(--sc-muted)]">{source.accessMode}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">License</div><div className="mt-1 font-black text-[var(--sc-text)]">{source.license}</div></div><div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">Redistribution</div><div className="mt-1 font-black text-[var(--sc-text)]">{source.redistributionAllowed ? "Allowed" : "Not confirmed"}</div></div></div><p className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">{source.notes}</p>{source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-[var(--sc-brand)]">{tr({ fi: "Lähteen ehdot ja lisenssi", en: "Source terms and licence", es: "Términos y licencia" })}</a>}</article>)}</div></section>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "Scorecaster julkaisee omat kaavansa, päätösrajansa, turvallisesti julkaistavat normalisoidut arvot ja lähdeviitteet. API-avaimia, henkilötietoja tai raakadataa ilman uudelleenjakeluoikeutta ei julkaista.", en: "Scorecaster publishes its formulas, decision gates, safely publishable normalized values and source references. API keys, personal data and raw data without redistribution rights are not published.", es: "Scorecaster publica fórmulas, umbrales, valores seguros y fuentes, pero no claves, datos personales ni datos sin permiso." })}</div>
        </>
      )}
    </div>
  );
}
