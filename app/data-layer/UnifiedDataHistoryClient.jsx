"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function percent(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "–";
}

function decimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function severityTone(value) {
  if (value === "high") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (value === "medium") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-sky-400/30 bg-sky-400/10 text-sky-200";
}

export default function UnifiedDataHistoryClient({ eventId = "", selection = "", compact = false }) {
  const { tr, locale } = useLanguage();
  const [hours, setHours] = useState(compact ? 168 : 72);
  const [state, setState] = useState({ loading: true, error: "", available: false, data: null, reason: "" });

  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try {
      const query = new URLSearchParams({ hours: String(hours), limit: compact ? "800" : "1500" });
      if (eventId) query.set("eventId", eventId);
      if (selection) query.set("selection", selection);
      const response = await fetch(`/api/data-layer/history?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Unified data history unavailable");
      setState({ loading: false, error: "", available: payload.historyAvailable === true, data: payload.data || null, reason: payload.reason || "" });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Unified data history unavailable", available: false, data: null, reason: "" });
    }
  }, [eventId, selection, hours, compact]);

  useEffect(() => { void load(); }, [load]);

  const activeIncidents = useMemo(() => (state.data?.incidents || []).filter((item) => item.active !== false), [state.data]);
  const trend = state.data?.trend || [];
  const maxSelections = Math.max(1, ...trend.map((item) => Number(item.selections || 0)));
  const summary = state.data?.summary || {};

  if (state.loading) {
    return <section className="sc-surface rounded-[1.6rem] p-6 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ladataan datakerroksen historiaa…", en: "Loading data-layer history…", es: "Cargando historial…" })}</section>;
  }

  if (!state.available) {
    return (
      <section className="sc-surface rounded-[1.6rem] p-6">
        <EmptyState
          title={tr({ fi: "Datakerroksen historia odottaa tuotantoaktivointia", en: "Data-layer history awaits production activation", es: "El historial espera activación" })}
          description={state.error || state.reason || tr({ fi: "Aja Supabase-migraatio ja aktivoi 30 minuutin capture-worker. Nykyhetken V1-ledger toimii silti normaalisti.", en: "Run the Supabase migration and activate the 30-minute capture worker. The current V1 ledger still works normally.", es: "Ejecuta la migración y activa el capturador. El registro actual sigue funcionando." })}
        />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          eyebrow="Unified Sports Data V2"
          title={compact ? tr({ fi: "Ottelun datahistoria", en: "Event data history", es: "Historial del evento" }) : tr({ fi: "Historia, closing odds ja provider-laatu", en: "History, closing odds and provider quality", es: "Historial, cierre y calidad" })}
          description={tr({ fi: "30 minuutin snapshotit näyttävät kattavuuden, provider-erot, AI-vaikutukset ja markkinan sulkeutumisen ilman ennakkovuotoa.", en: "Thirty-minute snapshots show coverage, provider divergence, AI impact and market close without pregame leakage.", es: "Capturas de 30 minutos muestran cobertura, divergencia, impacto y cierre sin fuga previa." })}
        />
        {!compact && <div className="flex gap-2">{[24, 72, 168, 720].map((value) => <button type="button" key={value} onClick={() => setHours(value)} className={`rounded-xl border px-3 py-2 text-xs font-black ${hours === value ? "border-blue-300 bg-blue-300/10 text-blue-200" : "border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>{value < 168 ? `${value}h` : value === 168 ? "7d" : "30d"}</button>)}</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile label={tr({ fi: "Snapshotteja", en: "Snapshots", es: "Capturas" })} value={summary.snapshotCount || 0} />
        <MetricTile label={tr({ fi: "Nykyvalintoja", en: "Current selections", es: "Selecciones" })} value={summary.currentSelections || 0} tone="blue" />
        <MetricTile label={tr({ fi: "Nykykattavuus", en: "Current coverage", es: "Cobertura" })} value={percent(summary.averageCurrentCoverage)} tone="green" />
        <MetricTile label="Multi-provider" value={summary.multiProviderSelections || 0} tone="purple" />
        <MetricTile label="Closing records" value={summary.closingRecordCount || 0} />
        <MetricTile label={tr({ fi: "Aktiivisia incidentejä", en: "Active incidents", es: "Incidentes activos" })} value={summary.activeIncidentCount || 0} tone={(summary.activeIncidentCount || 0) > 0 ? "yellow" : "green"} />
      </div>

      {trend.length > 0 && <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
        <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Kattavuus- ja provider-trendi", en: "Coverage and provider trend", es: "Tendencia de cobertura" })}</div>
        <div className="mt-5 flex min-h-44 items-end gap-1 overflow-x-auto pb-2">
          {trend.slice(-96).map((item) => {
            const height = Math.max(8, Number(item.averageCoverage || 0) * 150);
            const width = Math.max(8, Number(item.selections || 0) / maxSelections * 18);
            return <div key={item.capturedAt} title={`${new Date(item.capturedAt).toLocaleString(locale)} · ${percent(item.averageCoverage)} · ${item.selections} selections`} className="flex shrink-0 flex-col items-center justify-end gap-1"><div className={`rounded-t ${item.downgradeCount > 0 ? "bg-amber-300/70" : item.providerDisagreementCount > 0 ? "bg-rose-300/70" : "bg-blue-300/70"}`} style={{ height, width }} /><span className="text-[8px] text-[var(--sc-faint)]">{new Date(item.capturedAt).getHours().toString().padStart(2, "0")}</span></div>;
          })}
        </div>
        <div className="mt-2 text-xs text-[var(--sc-muted)]">{tr({ fi: "Sininen = normaali, keltainen = downgrade, punainen = provider-ristiriita.", en: "Blue = normal, amber = downgrade, red = provider divergence.", es: "Azul = normal, amarillo = rebaja, rojo = divergencia." })}</div>
      </section>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
          <div className="font-black text-[var(--sc-text)]">Provider Quality</div>
          <div className="mt-4 space-y-3">
            {(state.data?.providerQuality || []).map((provider) => <div key={provider.provider} className="rounded-[1.1rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{provider.provider}</div><div className="text-xs text-[var(--sc-muted)]">{provider.family} · {provider.samples} samples</div></div><span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${provider.status === "healthy" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : provider.status === "offline" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>{provider.status}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-[var(--sc-faint)]">Availability</span><div className="font-black">{percent(provider.availabilityRate)}</div></div><div><span className="text-[var(--sc-faint)]">Trust</span><div className="font-black">{percent(provider.averageTrust)}</div></div><div><span className="text-[var(--sc-faint)]">Divergence</span><div className="font-black">{percent(provider.averageDivergence, 1)}</div></div></div></div>)}
            {(state.data?.providerQuality || []).length === 0 && <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Provider-havaintoja ei ole vielä tallennettu.", en: "No provider observations have been stored yet.", es: "Aún no hay observaciones." })}</div>}
          </div>
        </section>

        <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
          <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Aktiiviset incidentit", en: "Active incidents", es: "Incidentes activos" })}</div>
          <div className="mt-4 space-y-3">
            {activeIncidents.slice(0, 12).map((item) => <div key={item.fingerprint} className={`rounded-[1.1rem] border p-4 ${severityTone(item.severity)}`}><div className="flex items-center justify-between gap-3"><div className="font-black">{item.title}</div><span className="text-[10px] font-black uppercase">{item.severity}</span></div><p className="mt-1 text-sm leading-6">{item.message}</p><div className="mt-1 text-[10px] opacity-70">{item.event_id || item.provider_key || item.incident_type}</div></div>)}
            {activeIncidents.length === 0 && <div className="rounded-[1.1rem] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{tr({ fi: "Ei aktiivisia datakerrosincidenttejä.", en: "No active data-layer incidents.", es: "No hay incidentes activos." })}</div>}
          </div>
        </section>
      </div>

      <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6">
        <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Closing odds ja markkina-CLV", en: "Closing odds and market CLV", es: "Cuotas de cierre y CLV" })}</div>
        <p className="mt-1 text-sm text-[var(--sc-muted)]">{tr({ fi: "Closing-hinta lukitaan viimeisestä ennen aloitusta tallennetusta snapshotista. Se tulee AI:n käyttöön vain jälkikäteen kalibrointia varten.", en: "The closing price is locked from the final snapshot before start. AI can use it only afterward for calibration.", es: "El cierre se fija desde la última captura previa y solo se usa después para calibración." })}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.12em] text-[var(--sc-faint)]"><tr><th className="pb-3">Event</th><th className="pb-3">Selection</th><th className="pb-3">Opening</th><th className="pb-3">Closing</th><th className="pb-3">Price CLV</th><th className="pb-3">Closed</th></tr></thead><tbody>{(state.data?.closingRecords || []).slice(0, compact ? 8 : 30).map((row) => <tr key={`${row.event_id}:${row.selection}`} className="border-t border-[var(--sc-border)]"><td className="py-3 font-bold text-[var(--sc-text)]">{row.event_id}</td><td className="py-3">{row.selection}</td><td className="py-3">{decimal(row.opening_odds)}</td><td className="py-3">{decimal(row.closing_odds)}</td><td className={`py-3 font-black ${Number(row.price_clv || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{percent(row.price_clv, 1)}</td><td className="py-3 text-xs text-[var(--sc-muted)]">{new Date(row.closing_captured_at).toLocaleString(locale)}</td></tr>)}</tbody></table></div>
        {(state.data?.closingRecords || []).length === 0 && <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Closing-recordit syntyvät, kun ensimmäiset seuratut ottelut alkavat capture-workerin ollessa aktiivinen.", en: "Closing records appear after tracked events start while the capture worker is active.", es: "Los cierres aparecen después del inicio con el capturador activo." })}</div>}
      </section>
    </section>
  );
}