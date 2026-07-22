"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function severityClass(severity) {
  return severity === "high"
    ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
    : "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default function DiagnosticIncidentPanel() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/diagnostics-v2?limit=24", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "System incidents unavailable");
        if (active) setPayload(data);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "System incidents unavailable"); });
    return () => { active = false; };
  }, []);

  const incidents = useMemo(() => {
    if (!payload) return [];
    const stored = (payload.alerts?.stored || []).filter((item) => item.active);
    return stored.length ? stored : payload.alerts?.live || [];
  }, [payload]);

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="System incidents"
        title={tr({ fi: "Päätösvirran ja datantarjoajan hälytykset", en: "Decision-flow and provider incidents", es: "Incidencias del flujo y proveedor" })}
        description={tr({ fi: "Nämä hälytykset koskevat koko Scorecaster-järjestelmän terveyttä, eivät yksittäistä seurantalistakohdetta.", en: "These alerts describe Scorecaster system health, not an individual watchlist selection.", es: "Estas alertas describen la salud del sistema." })}
        action={<Link href="/diagnostics-v2" className="sc-button-secondary">{tr({ fi: "Avaa diagnostiikka", en: "Open diagnostics", es: "Abrir diagnóstico" })}</Link>}
      />
      {payload && <div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricTile label={tr({ fi: "Incidentit", en: "Incidents", es: "Incidencias" })} value={incidents.length} tone={incidents.length ? "red" : "green"} /><MetricTile label="Provider" value={`${payload.providerHealth?.score ?? 0}/100`} tone={payload.providerHealth?.status === "healthy" ? "green" : "yellow"} /><MetricTile label={tr({ fi: "Trenditila", en: "Trend status", es: "Tendencia" })} value={payload.trends?.status?.toUpperCase() || "–"} tone={payload.trends?.status === "worsening" ? "red" : payload.trends?.status === "improving" ? "green" : "default"} /></div>}
      {error && <div className="rounded-[1.15rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">{error}</div>}
      {!payload && !error && <div className="h-24 animate-pulse rounded-[1.15rem] bg-[var(--sc-surface-soft)]" />}
      {payload && incidents.length === 0 && <EmptyState title={tr({ fi: "Aktiivisia järjestelmäincidenttejä ei ole", en: "No active system incidents", es: "No hay incidencias activas" })} description={tr({ fi: "All-SKIP-, stale-data- ja provider-säännöt eivät laukea nykytilassa.", en: "All-SKIP, stale-data and provider rules are not firing now.", es: "Las reglas del sistema no están activas." })} />}
      {incidents.length > 0 && <div className="grid gap-4 md:grid-cols-2">{incidents.map((incident) => <article key={incident.fingerprint || incident.id} className={`rounded-[1.25rem] border p-5 ${severityClass(incident.severity)}`}><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{incident.alert_type || incident.alertType} · {incident.severity}</div><h3 className="mt-2 text-lg font-black">{incident.title}</h3><p className="mt-1 text-sm leading-6 opacity-90">{incident.message}</p></article>)}</div>}
    </section>
  );
}
