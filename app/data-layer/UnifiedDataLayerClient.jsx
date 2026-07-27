"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import UnifiedDataLedger from "../components/UnifiedDataLedger";
import { DecisionBadge, EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";

function rowKey(row = {}) {
  return `${row.eventId || "event"}:${row.selection || "selection"}`;
}

export default function UnifiedDataLayerClient() {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", data: [], meta: null });
  const [selectedKey, setSelectedKey] = useState("");

  async function load() {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try {
      const response = await fetch("/api/data-layer", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Unified data unavailable");
      setState({ loading: false, error: "", data: payload.data || [], meta: payload });
      setSelectedKey((current) => current || rowKey(payload.data?.[0]));
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Unified data unavailable", data: [], meta: null });
    }
  }

  useEffect(() => { void load(); }, []);
  const selected = useMemo(() => state.data.find((row) => rowKey(row) === selectedKey) || state.data[0] || null, [state.data, selectedKey]);
  const coverage = state.data.reduce((sum, row) => sum + Number(row.ledger?.coverage?.verifiedCoverageRate || 0), 0) / Math.max(1, state.data.length);
  const multiProvider = state.data.filter((row) => Number(row.ledger?.coverage?.independentOddsProviders || 1) >= 2).length;
  const usedSignals = state.data.reduce((sum, row) => sum + Number(row.ledger?.coverage?.usedFamilies || 0), 0);

  return (
    <div className="space-y-8">
      <PageHero
        tone="blue"
        eyebrow="Unified Sports Data V2"
        title={tr({ fi: "Yksi varmennettu datakerros markkinalle, kontekstille ja AI:lle", en: "One verified data layer for market, context and AI", es: "Una capa verificada de datos para mercado, contexto e IA" })}
        description={tr({
          fi: "Nykyhetken ledger yhdistää odds-providerit, kokoonpanot, loukkaantumiset, aloittajat, levon, matkustuksen, vireen, sään, markkinaliikkeet ja uutisluotettavuuden. V2 tallentaa lisäksi historian, incidentit ja closing-linjat.",
          en: "The current ledger combines odds providers, lineups, injuries, starters, rest, travel, form, weather, market movement and news reliability. V2 also stores history, incidents and closing lines.",
          es: "El registro combina proveedores, alineaciones, lesiones, descanso, viajes, forma, clima y noticias. V2 también guarda historial e incidencias."
        })}
        actions={<><button type="button" className="sc-button-primary" onClick={() => void load()} disabled={state.loading}>{state.loading ? "…" : tr({ fi: "Päivitä data", en: "Refresh data", es: "Actualizar" })}</button><Link href="/sports-analytics" className="sc-button-secondary">Sports Analytics</Link><Link href="/provider-health" className="sc-button-secondary">Provider Health</Link><Link href="/api/data-layer/health" className="sc-button-ghost">V2 Health JSON</Link></>}
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Kohteita", en: "Selections", es: "Selecciones" })} value={state.data.length} /><MetricTile compact label={tr({ fi: "Varmennettu", en: "Verified", es: "Verificado" })} value={`${Math.round(coverage * 100)}%`} tone="blue" /><MetricTile compact label="Multi-provider" value={multiProvider} tone="green" /><MetricTile compact label={tr({ fi: "AI-signaaleja", en: "AI signals", es: "Señales IA" })} value={usedSignals} tone="purple" /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" }), value: "no-vig market consensus", tone: "info" },
        { label: tr({ fi: "Konteksti", en: "Context", es: "Contexto" }), value: tr({ fi: "rajattu ja jäljitettävä", en: "bounded and traceable", es: "limitado y trazable" }), tone: "good" },
        { label: tr({ fi: "Historia", en: "History", es: "Historial" }), value: "30 min snapshots", tone: "info" },
        { label: tr({ fi: "Korotus", en: "Upgrade", es: "Mejora" }), value: tr({ fi: "estetty", en: "disabled", es: "desactivada" }), tone: "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper-only", tone: "warning" }
      ]} />

      {state.error && <div className="rounded-[1.2rem] border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">{state.error}</div>}
      {!state.loading && !state.error && state.data.length === 0 && <EmptyState title={tr({ fi: "Nykyisiä kohteita ei ole", en: "No current selections", es: "No hay selecciones" })} description={tr({ fi: "Datakerros täyttyy Top Picks -kohteista.", en: "The data layer is populated from Top Picks.", es: "La capa se llena desde Top Picks." })} />}

      {state.data.length > 0 && <section className="space-y-4">
        <SectionHeader eyebrow={tr({ fi: "Nykyhetki", en: "Current state", es: "Estado actual" })} title={tr({ fi: "Valitse tarkastettava data-audit", en: "Choose a data audit", es: "Elige una auditoría" })} description={tr({ fi: "Alla näkyy nykyinen päätöshetken ledger. Pysyvä historia jatkuu seuraavassa osiossa.", en: "This is the current decision-time ledger. Persistent history follows below.", es: "Este es el registro actual. El historial continúa abajo." })} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.data.map((row) => { const key = rowKey(row); return <button type="button" key={key} onClick={() => setSelectedKey(key)} className={`rounded-[1.3rem] border p-5 text-left transition ${rowKey(selected) === key ? "border-blue-300 bg-blue-300/10" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] hover:border-blue-300/40"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-[var(--sc-text)]">{row.match}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{row.selection} · {Number(row.odds || 0).toFixed(2)}</div></div><DecisionBadge decision={row.decision} /></div><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]"><span>{row.ledger?.coverage?.usedFamilies || 0} used</span><span>{Math.round(Number(row.ledger?.coverage?.verifiedCoverageRate || 0) * 100)}% verified</span><span>{row.ledger?.coverage?.independentOddsProviders || 1} odds providers</span></div></button>; })}
        </div>
      </section>}

      {selected?.ledger && <UnifiedDataLedger ledger={selected.ledger} />}
    </div>
  );
}
