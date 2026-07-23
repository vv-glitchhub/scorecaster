"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function severityClass(severity) {
  return severity === "high"
    ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
    : severity === "info"
      ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
      : "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default function DiagnosticIncidentPanel() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [unified, setUnified] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/diagnostics-v2?limit=24", { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "System incidents unavailable");
        return data;
      }),
      fetch("/api/data-layer/history?hours=168&limit=800", { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unified data incidents unavailable");
        return data;
      })
    ])
      .then(([diagnostics, unifiedData]) => {
        if (!active) return;
        setPayload(diagnostics);
        setUnified(unifiedData);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "System incidents unavailable"); });
    return () => { active = false; };
  }, []);

  const incidents = useMemo(() => {
    const diagnosticStored = (payload?.alerts?.stored || []).filter((item) => item.active);
    const diagnostic = diagnosticStored.length ? diagnosticStored : payload?.alerts?.live || [];
    const unifiedIncidents = unified?.historyAvailable
      ? (unified.data?.incidents || []).filter((item) => item.active !== false).map((item) => ({ ...item, alert_type: item.incident_type, source: "unified-data" }))
      : [];
    return [...diagnostic, ...unifiedIncidents].sort((left, right) => {
      const weight = { high: 3, medium: 2, info: 1 };
      return (weight[right.severity] || 0) - (weight[left.severity] || 0);
    });
  }, [payload, unified]);

  const unifiedProviderHealth = unified?.data?.providerQuality || [];
  const healthyProviders = unifiedProviderHealth.filter((item) => item.status === "healthy").length;

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="System incidents"
        title={tr({ fi: "Päätösvirran ja datantarjoajien hälytykset", en: "Decision-flow and data-provider incidents", es: "Incidencias del flujo y proveedores" })}
        description={tr({ fi: "Yhdessä näkymässä näkyvät all-SKIP-, stale-, provider-outage-, datakattavuus-, ristiriita- ja adverse-context-hälytykset.", en: "One view combines all-SKIP, stale, provider outage, coverage, divergence and adverse-context incidents.", es: "Una vista combina incidencias de flujo, proveedores, cobertura y divergencia." })}
        action={<div className="flex gap-2"><Link href="/diagnostics-v2" className="sc-button-secondary">Decision Diagnostics</Link><Link href="/data-layer" className="sc-button-secondary">Data Layer</Link></div>}
      />
      {payload && <div className="mb-5 grid gap-3 sm:grid-cols-4"><MetricTile label={tr({ fi: "Incidentit", en: "Incidents", es: "Incidencias" })} value={incidents.length} tone={incidents.length ? "red" : "green"} /><MetricTile label="Decision provider" value={`${payload.providerHealth?.score ?? 0}/100`} tone={payload.providerHealth?.status === "healthy" ? "green" : "yellow"} /><MetricTile label={tr({ fi: "Terveet dataprovenderit", en: "Healthy data providers", es: "Proveedores sanos" })} value={`${healthyProviders}/${unifiedProviderHealth.length}`} tone={healthyProviders === unifiedProviderHealth.length && unifiedProviderHealth.length ? "green" : "yellow"} /><MetricTile label={tr({ fi: "Trenditila", en: "Trend status", es: "Tendencia" })} value={payload.trends?.status?.toUpperCase() || "–"} tone={payload.trends?.status === "worsening" ? "red" : payload.trends?.status === "improving" ? "green" : "default"} /></div>}
      {error && <div className="rounded-[1.15rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">{error}</div>}
      {!payload && !error && <div className="h-24 animate-pulse rounded-[1.15rem] bg-[var(--sc-surface-soft)]" />}
      {payload && incidents.length === 0 && <EmptyState title={tr({ fi: "Aktiivisia järjestelmäincidenttejä ei ole", en: "No active system incidents", es: "No hay incidencias activas" })} description={tr({ fi: "Päätösvirran, stale-datan, providerien, kattavuuden ja ristiriitojen säännöt eivät laukea nykytilassa.", en: "Decision-flow, stale-data, provider, coverage and divergence rules are not firing now.", es: "Las reglas del sistema no están activas." })} />}
      {incidents.length > 0 && <div className="grid gap-4 md:grid-cols-2">{incidents.map((incident) => <article key={incident.fingerprint || incident.id} className={`rounded-[1.25rem] border p-5 ${severityClass(incident.severity)}`}><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{incident.source || "decision-diagnostics"} · {incident.alert_type || incident.alertType} · {incident.severity}</div><h3 className="mt-2 text-lg font-black">{incident.title}</h3><p className="mt-1 text-sm leading-6 opacity-90">{incident.message}</p></article>)}</div>}
    </section>
  );
}