"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const pp = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(1)} pp` : "–";
const decimal = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-1 text-2xl font-black text-[var(--sc-text)]">{value}</div>
      {hint && <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{hint}</div>}
    </div>
  );
}

function MovementBadge({ label }) {
  const text = String(label || "unknown");
  return <span className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1 text-xs font-black text-[var(--sc-text-secondary)]">{text}</span>;
}

function SelectionPanel({ item, locale, tr }) {
  const movement = item.movement || {};
  const current = item.current || {};
  const opening = item.opening || {};
  const closing = item.closing;
  return (
    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{item.selection}</div>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)]">{tr({ fi: "Markkinan hintatodiste", en: "Market price evidence", es: "Evidencia de mercado" })}</h2>
        </div>
        <MovementBadge label={movement.causeLabel} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={tr({ fi: "Avaus", en: "Opening", es: "Apertura" })} value={decimal(opening.averagePrice)} hint={`${pct(opening.probability)} · ${opening.providerCount || 0} providers`} />
        <Metric label={tr({ fi: "Nykyinen", en: "Current", es: "Actual" })} value={decimal(current.averagePrice)} hint={`${pct(current.probability)} · ${current.providerCount || 0} providers`} />
        <Metric label={tr({ fi: "Todennäköisyysmuutos", en: "Probability move", es: "Cambio de probabilidad" })} value={pp(movement.probabilityChange)} hint={movement.direction || "stable"} />
        <Metric label={tr({ fi: "Closing line", en: "Closing line", es: "Cierre" })} value={closing ? decimal(closing.averagePrice) : "LOCKED"} hint={closing ? `${pct(closing.probability)} · ${closing.providerCount || 0} providers` : tr({ fi: "Näkyy vasta ottelun alettua", en: "Visible only after kickoff", es: "Visible tras el inicio" })} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Laaja liike", en: "Broad movement", es: "Movimiento amplio" })}</div>
          <div className="mt-2 text-lg font-black text-[var(--sc-text)]">{movement.broadEvidence?.detected ? tr({ fi: "Havaittu", en: "Detected", es: "Detectado" }) : tr({ fi: "Ei todistettu", en: "Not established", es: "No establecido" })}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-text-secondary)]">
            {movement.broadEvidence?.detected
              ? `${movement.broadEvidence.providerCount} providers · ${movement.broadEvidence.direction} · ${pp(movement.broadEvidence.medianProbabilityChange)}`
              : movement.broadEvidence?.reason || tr({ fi: "Samansuuntaista, tuoretta usean tarjoajan näyttöä ei ole riittävästi.", en: "There is not enough fresh synchronized multi-provider evidence.", es: "No hay suficiente evidencia sincronizada." })}
          </p>
          <div className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">{tr({ fi: "Scorecaster ei kutsu tätä sharp moneyksi eikä väitä tietävänsä liikkeen aiheuttajaa.", en: "Scorecaster does not label this sharp money or claim to know who caused the move.", es: "Scorecaster no lo etiqueta como dinero profesional." })}</div>
        </div>

        <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Syötteen laatu", en: "Feed quality", es: "Calidad del feed" })}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Metric label={tr({ fi: "Vanhentuneet", en: "Stale", es: "Obsoletos" })} value={movement.staleProviders?.length || 0} />
            <Metric label={tr({ fi: "Poikkeavat", en: "Outliers", es: "Atípicos" })} value={movement.outlierProviders?.length || 0} />
          </div>
          {(movement.staleProviders?.length || movement.outlierProviders?.length) > 0 && (
            <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">
              {[...(movement.staleProviders || []), ...(movement.outlierProviders || [])].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>

      {(item.alerts || []).length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Informatiiviset hälytykset", en: "Informational alerts", es: "Alertas informativas" })}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.alerts.map((alert, index) => <span key={`${alert.type}-${index}`} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--sc-text-secondary)]">{alert.type} · {alert.severity}</span>)}
          </div>
        </div>
      )}

      <details className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
        <summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: "Näytä tarjoajakohtainen auditointi", en: "Show provider audit", es: "Ver auditoría" })}</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-[var(--sc-faint)]"><tr><th className="px-2 py-2">Provider</th><th className="px-2 py-2">Open</th><th className="px-2 py-2">Current</th><th className="px-2 py-2">Δ p</th><th className="px-2 py-2">State</th></tr></thead>
            <tbody>
              {(movement.providerMovements || []).map((provider) => (
                <tr key={provider.bookmakerKey} className="border-t border-[var(--sc-border)] text-[var(--sc-text-secondary)]">
                  <td className="px-2 py-3 font-black text-[var(--sc-text)]">{provider.bookmakerTitle || provider.bookmakerKey}</td>
                  <td className="px-2 py-3">{decimal(provider.openingPrice)}</td>
                  <td className="px-2 py-3">{decimal(provider.currentPrice)}</td>
                  <td className="px-2 py-3">{pp(provider.probabilityChange)}</td>
                  <td className="px-2 py-3">{provider.stale ? "stale" : provider.outlier ? "outlier" : "eligible"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-3 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
        <summary className="cursor-pointer font-black text-[var(--sc-text)]">{tr({ fi: "Näytä konsensusaikajana", en: "Show consensus timeline", es: "Ver línea temporal" })}</summary>
        <div className="mt-4 space-y-2">
          {(item.timeline || []).map((point) => (
            <div key={point.captureId} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-[var(--sc-border)] px-3 py-3 text-sm text-[var(--sc-text-secondary)]">
              <span>{new Date(point.capturedAt).toLocaleString(locale)}</span><span>{pct(point.probability)}</span><span>{point.providerCount} providers</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

export default function MarketMicrostructureClient({ initialEventId = "", initialMarket = "h2h", initialSelection = "" }) {
  const { tr, locale } = useLanguage();
  const [eventId, setEventId] = useState(initialEventId);
  const [market, setMarket] = useState(["h2h", "spreads", "totals"].includes(initialMarket) ? initialMarket : "h2h");
  const [selection, setSelection] = useState(initialSelection);
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/market-microstructure/health", { cache: "no-store" });
      setHealth(await response.json());
    } catch { setHealth(null); }
  }, []);

  const load = useCallback(async (targetEventId = eventId) => {
    const cleaned = String(targetEventId || "").trim();
    if (!cleaned) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ eventId: cleaned, market });
      if (selection.trim()) query.set("selection", selection.trim());
      const response = await fetch(`/api/market-microstructure?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Market evidence unavailable");
      setData(payload);
      const next = new URL(window.location.href);
      next.search = query.toString();
      window.history.replaceState({}, "", next);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Market evidence unavailable");
    } finally { setLoading(false); }
  }, [eventId, market, selection]);

  useEffect(() => { void loadHealth(); }, [loadHealth]);
  useEffect(() => { if (initialEventId) void load(initialEventId); }, []);

  const selections = useMemo(() => Array.isArray(data?.selections) ? data.selections : [], [data]);

  return (
    <div className="space-y-7">
      <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Market Microstructure V2</div>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{tr({ fi: "Miten markkina oikeasti liikkui?", en: "How did the market actually move?", es: "¿Cómo se movió el mercado?" })}</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "Avaus-, nyky- ja closing-hinnat tarjoajittain, no-vig-normalisointi, vanhentuneet syötteet, poikkeamat ja samanaikainen laaja liike. Syytä ei arvata.", en: "Provider-level opening, current and closing prices, no-vig normalization, stale feeds, outliers and synchronized broad movement. The cause is never invented.", es: "Precios por proveedor, normalización no-vig y evidencia sincronizada sin inventar la causa." })}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-[var(--sc-muted)]">
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-2">paper-only</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-2">sharpMoneyClaim=false</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-2">closing locked pre-kickoff</span>
        </div>
      </section>

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_auto]">
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Event ID<input value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" placeholder="provider event id" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Market<select value={market} onChange={(event) => setMarket(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]"><option value="h2h">h2h</option><option value="spreads">spreads</option><option value="totals">totals</option></select></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Valinta, vapaaehtoinen", en: "Selection, optional", es: "Selección opcional" })}<input value={selection} onChange={(event) => setSelection(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label>
          <button type="button" onClick={() => void load()} disabled={loading || !eventId.trim()} className="sc-button-primary self-end disabled:opacity-40">{loading ? tr({ fi: "Analysoidaan…", en: "Analyzing…", es: "Analizando…" }) : tr({ fi: "Avaa auditointi", en: "Open audit", es: "Abrir auditoría" })}</button>
        </div>
      </section>

      {health && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">Pipeline: <strong className="text-[var(--sc-text)]">{health.status}</strong> · records {health.upcomingNormalizedRecords ?? 0} · worker {health.workerEnabled ? "enabled" : "disabled"}</div>}
      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}

      {data && <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{data.league || data.sport || "Market"}</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{data.eventId}</h2></div><div className="text-sm text-[var(--sc-muted)]">{data.recordsEligible || 0} normalized records · {data.sourceAttribution}</div></div></section>}
      {data?.status === "missing" && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-amber-100">{tr({ fi: "Tälle ottelulle ei ole vielä varmennettua tarjoajahistoriaa. Puuttuvaa dataa ei korvata arvauksella.", en: "No verified provider history exists for this event yet. Missing data is not replaced with an estimate.", es: "Aún no hay historial verificado." })}</div>}
      {selections.map((item) => <SelectionPanel key={`${item.selection}-${item.point ?? "none"}`} item={item} locale={locale} tr={tr} />)}

      <div className="flex flex-wrap gap-3"><Link href="/events" className="sc-button-secondary">{tr({ fi: "Ottelut", en: "Events", es: "Eventos" })}</Link><Link href="/sources" className="sc-button-secondary">{tr({ fi: "Lähteet ja oikeudet", en: "Sources and rights", es: "Fuentes y derechos" })}</Link><Link href="/api/market-microstructure/health" className="sc-button-ghost">Health JSON</Link></div>
    </div>
  );
}
