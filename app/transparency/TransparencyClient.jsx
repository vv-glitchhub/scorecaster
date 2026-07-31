"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const showNumber = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const showPercent = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

function Calculation({ label, value, percent = false, digits = 4 }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{percent ? showPercent(value, digits) : showNumber(value, digits)}</div>
    </div>
  );
}

export default function TransparencyClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/transparency?hours=2160&limit=5000", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Transparency data unavailable");
      setData(payload);
      const first = payload.events?.[0]?.eventId || "";
      setSelectedEventId((current) => current || first);
    } catch (cause) {
      setError(cause?.message || "Transparency data unavailable");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(eventId) {
    if (!eventId) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/transparency?eventId=${encodeURIComponent(eventId)}&hours=2160&limit=5000`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Event transparency unavailable");
      setDetail(payload);
    } catch (cause) {
      setError(cause?.message || "Event transparency unavailable");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (selectedEventId) void loadDetail(selectedEventId);
  }, [selectedEventId]);

  const formulas = data?.methodology?.formulas || [];
  const sources = data?.sourceRegistry || [];
  const events = data?.events || [];
  const explanation = detail?.explanation || null;
  const calculations = explanation?.calculations || {};
  const records = detail?.records || [];
  const usedFormulaNames = useMemo(() => new Map(formulas.map((formula) => [formula.id, formula.name])), [formulas]);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Open Scorecaster</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({
            fi: "Jokainen päätös, lähde ja laskukaava näkyviin.",
            en: "Every decision, source and formula made visible.",
            es: "Cada decisión, fuente y fórmula a la vista."
          })}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)] sm:text-base">
          {tr({
            fi: "Tämä sivu julkaisee Scorecasterin päätösrajat, laskukaavat, normalisoidut syötteet, puuttuvat tiedot ja lähteiden käyttöoikeustiedot. Selitys ei muuta ennustetta jälkikäteen.",
            en: "This page publishes Scorecaster's decision gates, formulas, normalized inputs, missing data and source-rights metadata. The explanation never changes a prediction after the fact.",
            es: "Esta página publica los umbrales, fórmulas, entradas normalizadas, datos faltantes y metadatos de fuentes. La explicación nunca cambia la predicción."
          })}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Calculation label={tr({ fi: "Kaavat", en: "Formulas", es: "Fórmulas" })} value={formulas.length} digits={0} />
          <Calculation label={tr({ fi: "Lähteet rekisterissä", en: "Registered sources", es: "Fuentes registradas" })} value={sources.length} digits={0} />
          <Calculation label={tr({ fi: "Julkiset tapahtumat", en: "Public events", es: "Eventos públicos" })} value={events.length} digits={0} />
          <Calculation label={tr({ fi: "API-tunnistautuminen", en: "API authentication", es: "Autenticación API" })} value={0} digits={0} />
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm leading-7 text-[var(--sc-text-secondary)]">
          <strong className="text-[var(--sc-text)]">Public API:</strong> <code>/api/transparency</code> · CORS <code>*</code> · {tr({ fi: "ei kirjautumista", en: "no sign-in required", es: "sin inicio de sesión" })}
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>}
      {loading && <div className="h-72 animate-pulse rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" />}

      {!loading && (
        <>
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Decision inspector</div>
                <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Avaa tapahtuman koko päätösketju", en: "Open an event's full decision chain", es: "Abrir la cadena completa de decisión" })}</h2>
              </div>
              <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="sc-input min-w-0 lg:w-[32rem]">
                {!events.length && <option value="">{tr({ fi: "Ei tapahtumia", en: "No events", es: "Sin eventos" })}</option>}
                {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventId} · {event.sport || "sport"} · {event.recordCount} records</option>)}
              </select>
            </div>

            {detailLoading && <div className="mt-6 h-56 animate-pulse rounded-2xl bg-[var(--sc-surface-soft)]" />}
            {!detailLoading && explanation && (
              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[var(--sc-brand)] px-3 py-1 text-xs font-black text-[var(--sc-brand-ink)]">{explanation.verdict}</span>
                    <span className="text-xs text-[var(--sc-muted)]">{new Date(explanation.generatedAt).toLocaleString(locale)}</span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--sc-text-secondary)]">{explanation.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Calculation label="Model probability" value={calculations.modelProbability} percent />
                  <Calculation label="Market probability" value={calculations.marketProbability} percent />
                  <Calculation label="Edge" value={calculations.edge} percent />
                  <Calculation label="Expected value / unit" value={calculations.expectedValuePerUnit} percent />
                  <Calculation label="Best decimal odds" value={calculations.bestDecimalOdds} digits={2} />
                  <Calculation label="Model fair odds" value={calculations.fairOdds} digits={2} />
                  <Calculation label="Data quality" value={calculations.quality} percent />
                  <Calculation label="Ranking score" value={calculations.rankingScore} digits={1} />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--sc-border)] p-5">
                    <h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Miksi tähän ratkaisuun päädyttiin", en: "Why the system reached this decision", es: "Por qué se llegó a esta decisión" })}</h3>
                    <div className="mt-4 space-y-3">
                      {(explanation.factors || []).map((factor) => (
                        <div key={factor.id} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--sc-surface-soft)] p-3">
                          <div className="text-sm font-bold text-[var(--sc-text-secondary)]">{factor.label}</div>
                          <div className="text-right text-sm font-black text-[var(--sc-text)]">{Number.isFinite(Number(factor.value)) ? showNumber(factor.value, 4) : factor.direction}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--sc-border)] p-5">
                    <h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Päätösportit", en: "Decision gates", es: "Umbrales de decisión" })}</h3>
                    <div className="mt-4 space-y-3">
                      {(explanation.gateResults || []).map((gate) => (
                        <div key={gate.id} className="flex items-start gap-3 rounded-xl bg-[var(--sc-surface-soft)] p-3">
                          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${gate.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>{gate.passed ? "✓" : "!"}</span>
                          <div><div className="text-sm font-black text-[var(--sc-text)]">{gate.id}</div><div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{gate.requirement}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {!!explanation.missingInputs?.length && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
                    <div className="font-black text-amber-100">{tr({ fi: "Puuttuvat tiedot", en: "Missing inputs", es: "Datos faltantes" })}</div>
                    <div className="mt-3 flex flex-wrap gap-2">{explanation.missingInputs.map((item) => <span key={item} className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100">{item}</span>)}</div>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--sc-border)] p-5">
                  <h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Tässä päätöksessä käytetyt lähteet", en: "Sources used for this decision", es: "Fuentes usadas en esta decisión" })}</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(explanation.sources || []).map((source) => (
                      <div key={source.id} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4">
                        <div className="font-black text-[var(--sc-text)]">{source.name}</div>
                        <div className="mt-2 text-xs leading-6 text-[var(--sc-muted)]">ID: {source.id}<br />License: {source.license}<br />Observations: {source.observations}<br />Metrics: {source.metrics?.join(", ") || "–"}</div>
                        {source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Avaa lähteen ehdot", en: "Open source terms", es: "Abrir términos" })}</a>}
                      </div>
                    ))}
                  </div>
                </div>

                <details className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
                  <summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: `Näytä kaikki ${records.length} normalisoitua syötettä`, en: `Show all ${records.length} normalized inputs`, es: `Mostrar las ${records.length} entradas normalizadas` })}</summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-[var(--sc-faint)]"><tr><th className="p-2">Source</th><th className="p-2">Metric</th><th className="p-2">Value</th><th className="p-2">Confidence</th><th className="p-2">Trust</th><th className="p-2">Observed</th></tr></thead>
                      <tbody>{records.map((record, index) => <tr key={`${record.sourceId}-${record.metric}-${record.observedAt}-${index}`} className="border-t border-[var(--sc-border)]"><td className="p-2 font-bold text-[var(--sc-text)]">{record.sourceId}</td><td className="p-2 text-[var(--sc-text-secondary)]">{record.metric}</td><td className="p-2 text-[var(--sc-text-secondary)]">{showNumber(record.value, 4)} {record.unit || ""}</td><td className="p-2 text-[var(--sc-muted)]">{showPercent(record.confidence)}</td><td className="p-2 text-[var(--sc-muted)]">{showPercent(record.sourceTrust)}</td><td className="p-2 text-[var(--sc-muted)]">{record.observedAt ? new Date(record.observedAt).toLocaleString(locale) : "–"}</td></tr>)}</tbody>
                    </table>
                  </div>
                </details>

                <div className="rounded-2xl border border-[var(--sc-border)] p-5">
                  <h3 className="font-black text-[var(--sc-text)]">{tr({ fi: "Käytetyt laskukaavat", en: "Formulas used", es: "Fórmulas utilizadas" })}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{(explanation.formulasUsed || []).map((id) => <span key={id} className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1 text-xs font-bold text-[var(--sc-text)]">{usedFormulaNames.get(id) || id}</span>)}</div>
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Open formulas</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki tuotannossa käytetyt pääkaavat", en: "All primary formulas used in production", es: "Todas las fórmulas principales" })}</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {formulas.map((formula) => (
                <article key={formula.id} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{formula.id}</div>
                  <h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{formula.name}</h3>
                  <div className="mt-4 overflow-x-auto rounded-2xl bg-[var(--sc-surface-soft)] p-4 font-mono text-sm text-[var(--sc-text-secondary)]">{formula.formula}</div>
                  <p className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">{formula.note}</p>
                  <div className="mt-4 space-y-2">{Object.entries(formula.variables || {}).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(90px,auto)_1fr] gap-3 text-xs"><code className="font-black text-[var(--sc-text)]">{key}</code><span className="text-[var(--sc-muted)]">{value}</span></div>)}</div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Source registry</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Lähteet, käyttöoikeudet ja rajat", en: "Sources, rights and boundaries", es: "Fuentes, derechos y límites" })}</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {sources.map((source) => (
                <article key={source.id} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{source.id}</div><h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{source.name}</h3></div><span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-[10px] font-black text-[var(--sc-muted)]">{source.accessMode}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">License</div><div className="mt-1 font-black text-[var(--sc-text)]">{source.license}</div></div>
                    <div className="rounded-xl bg-[var(--sc-surface-soft)] p-3"><div className="text-[var(--sc-faint)]">Redistribution</div><div className="mt-1 font-black text-[var(--sc-text)]">{source.redistributionAllowed ? "Allowed" : "Not confirmed"}</div></div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--sc-muted)]">{source.notes}</p>
                  {source.termsUrl && <a href={source.termsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-[var(--sc-brand)] hover:underline">{tr({ fi: "Lähteen ehdot ja lisenssi", en: "Source terms and licence", es: "Términos y licencia" })}</a>}
                </article>
              ))}
            </div>
          </section>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-xs leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Avoimuus ei tarkoita palveluntarjoajien lisenssien rikkomista. Scorecaster julkaisee kaikki omat kaavansa, päätösrajansa, normalisoidut julkaistavat arvot ja lähdeviitteet, mutta ei API-avaimia, henkilötietoja tai raakadataa, jonka uudelleenjakeluun ei ole lupaa.",
              en: "Transparency does not mean violating provider licences. Scorecaster publishes its formulas, gates, normalized publishable values and source references, but never API keys, personal data or raw data without redistribution rights.",
              es: "La transparencia no implica violar licencias. Scorecaster publica fórmulas, umbrales, valores normalizados y referencias, pero nunca claves, datos personales ni datos sin derechos de redistribución."
            })}
          </div>
        </>
      )}
    </div>
  );
}
