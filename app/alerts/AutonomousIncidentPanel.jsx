"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function severityClass(severity) {
  return severity === "high" ? "border-rose-400/30 bg-rose-400/10 text-rose-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100";
}

export default function AutonomousIncidentPanel() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/cloud/autonomous-agent", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Autonomous incidents unavailable");
        if (active) setPayload(data);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Autonomous incidents unavailable"); });
    return () => { active = false; };
  }, []);

  const incidents = useMemo(() => (payload?.incidents || []).filter((item) => item.active !== false), [payload]);
  const mode = payload?.state?.operating_mode || (payload?.v121Active ? "BOOTSTRAP" : "V12 FALLBACK");
  const health = Number(payload?.state?.health_score || payload?.learning?.[0]?.health_score || 0);

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Autonomous Intelligence V12.1"
        title={tr({ fi: "Autonomisen paperiagentin turvahälytykset", en: "Autonomous paper-agent safety incidents", es: "Incidencias del agente simulado" })}
        description={tr({ fi: "Kill switch-, mallidrift-, provider-, drawdown- ja tappioputkihälytykset ovat käyttäjäkohtaisia.", en: "Kill-switch, model-drift, provider, drawdown and loss-streak incidents are user-specific.", es: "Las incidencias de seguridad son específicas del usuario." })}
        action={<Link href="/autonomous-agent" className="sc-button-secondary">{tr({ fi: "Avaa V12.1-asetukset", en: "Open V12.1 settings", es: "Abrir V12.1" })}</Link>}
      />
      {payload && <div className="mb-5 grid gap-3 sm:grid-cols-3"><MetricTile label={tr({ fi: "Tila", en: "Mode", es: "Modo" })} value={String(mode).toUpperCase()} tone={mode === "FROZEN" ? "red" : mode === "ACTIVE" ? "green" : "yellow"} /><MetricTile label="Health" value={`${health.toFixed(0)}/100`} tone={health >= 70 ? "green" : health >= 40 ? "yellow" : "red"} /><MetricTile label={tr({ fi: "Incidentit", en: "Incidents", es: "Incidencias" })} value={incidents.length} tone={incidents.length ? "red" : "green"} /></div>}
      {error && <div className="rounded-[1.15rem] border border-amber-400/25 bg-amber-400/10 p-4 text-amber-100">{error}</div>}
      {!payload && !error && <div className="h-24 animate-pulse rounded-[1.15rem] bg-[var(--sc-surface-soft)]" />}
      {payload && incidents.length === 0 && <EmptyState title={tr({ fi: "Aktiivisia V12.1-incidenttejä ei ole", en: "No active V12.1 incidents", es: "No hay incidencias V12.1" })} description={tr({ fi: "Autonominen paperiagentti ei ole ylittänyt turvarajojaan.", en: "The autonomous paper agent has not crossed its safety boundaries.", es: "El agente no ha superado sus límites." })} />}
      {incidents.length > 0 && <div className="grid gap-4 md:grid-cols-2">{incidents.map((incident) => <article key={incident.id || incident.fingerprint} className={`rounded-[1.25rem] border p-5 ${severityClass(incident.severity)}`}><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{incident.incident_type} · {incident.severity}</div><h3 className="mt-2 text-lg font-black">{incident.title}</h3><p className="mt-1 text-sm leading-6 opacity-90">{incident.message}</p></article>)}</div>}
    </section>
  );
}
