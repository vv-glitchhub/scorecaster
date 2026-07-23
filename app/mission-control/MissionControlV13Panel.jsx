"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

function date(value, locale) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function pct(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function severityClass(allowed) {
  return allowed
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
    : "border-rose-400/25 bg-rose-400/10 text-rose-100";
}

export default function MissionControlV13Panel() {
  const { tr, locale } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", data: null, stopping: false });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "V13 governance unavailable");
      setState({ loading: false, error: "", data: payload, stopping: false });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "V13 governance unavailable", data: null, stopping: false });
    }
  }

  async function emergencyStop() {
    if (!window.confirm(tr({
      fi: "Pysäytetäänkö kaikki uudet autonomiset paperivalinnat? Olemassa olevat paperikohteet jäävät seurantaan ja ratkaistaviksi.",
      en: "Stop all new autonomous paper selections? Existing paper positions remain available for settlement and audit.",
      es: "¿Detener todas las nuevas selecciones simuladas autónomas? Las posiciones existentes permanecerán para liquidación y auditoría."
    }))) return;
    setState((current) => ({ ...current, stopping: true, error: "" }));
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { method: "DELETE", headers: { "Content-Type": "application/json" } });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Emergency stop failed");
      await load();
    } catch (error) {
      setState((current) => ({ ...current, stopping: false, error: error instanceof Error ? error.message : "Emergency stop failed" }));
    }
  }

  useEffect(() => { void load(); }, []);

  const data = state.data;
  const agentState = data?.state;
  const audits = data?.audits || [];
  const briefs = data?.briefs || [];
  const latestBrief = briefs[0]?.brief || agentState?.last_brief || null;
  const auditSummary = useMemo(() => {
    const allowed = audits.filter((item) => item.allowed).length;
    const reasons = new Map();
    audits.filter((item) => !item.allowed).forEach((item) => (item.reasons || []).forEach((reason) => reasons.set(reason, (reasons.get(reason) || 0) + 1)));
    return {
      allowed,
      blocked: audits.length - allowed,
      commonReasons: [...reasons.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8)
    };
  }, [audits]);
  const paused = Boolean(agentState?.paused_until && Date.parse(agentState.paused_until) > Date.now());

  return (
    <section className="sc-surface rounded-[1.7rem] p-6">
      <SectionHeader
        eyebrow="AUTONOMOUS V13 GOVERNANCE"
        title={tr({ fi: "Järjestelmäincidentit, cooldown ja täydellinen kandidaattiloki", en: "System incidents, cooldown and complete candidate audit", es: "Incidentes, cooldown y auditoría completa de candidatos" })}
        description={tr({ fi: "V13 täydentää V12:ta tietokantapohjaisella pausella, adaptiivisella ajovälillä, päivittäisellä briefillä ja jokaisen hyväksytyn tai hylätyn ehdokkaan RLS-eristetyllä auditilla.", en: "V13 extends V12 with database-enforced pauses, adaptive cadence, daily briefs and an RLS-isolated audit for every accepted or rejected candidate.", es: "V13 amplía V12 con pausas en base de datos, cadencia adaptativa, resúmenes y auditoría RLS." })}
        action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} className="sc-button-secondary" disabled={state.loading}>{state.loading ? "…" : tr({ fi: "Päivitä V13", en: "Refresh V13", es: "Actualizar V13" })}</button><button type="button" onClick={() => void emergencyStop()} className="rounded-full border border-rose-400/40 bg-rose-400/15 px-4 py-2 text-sm font-black text-rose-100 hover:bg-rose-400/25" disabled={state.stopping || data?.settings?.enabled === false}>{state.stopping ? "…" : tr({ fi: "EMERGENCY STOP", en: "EMERGENCY STOP", es: "PARADA DE EMERGENCIA" })}</button></div>}
      />

      {state.error && <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100">{state.error}</div>}
      {!state.loading && data?.available === false && <EmptyState title={tr({ fi: "V13-migraatio ei ole aktiivinen", en: "V13 migration is not active", es: "La migración V13 no está activa" })} description={data?.warning || "Autonomous Agent V13 migration required."} />}

      {data?.available && <>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label={tr({ fi: "Agentti", en: "Agent", es: "Agente" })} value={data.settings?.enabled ? "ENABLED" : "STOPPED"} tone={data.settings?.enabled ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Governance health", en: "Governance health", es: "Salud de gobernanza" })} value={`${agentState?.health_status || "learning"} · ${Number(agentState?.health_score || 0).toFixed(0)}/100`} tone={agentState?.health_status === "paused" || agentState?.health_status === "blocked" ? "red" : agentState?.health_status === "healthy" ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Tietokantapause", en: "Database pause", es: "Pausa en base de datos" })} value={paused ? date(agentState?.paused_until, locale) : tr({ fi: "EI AKTIIVINEN", en: "NOT ACTIVE", es: "NO ACTIVA" })} tone={paused ? "red" : "green"} />
          <MetricTile label={tr({ fi: "Seuraava ajoväli", en: "Next cadence", es: "Próxima cadencia" })} value={`${data.runs?.[0]?.next_check_minutes || "–"} min`} tone="blue" />
          <MetricTile label={tr({ fi: "Ratkaistu otos", en: "Resolved sample", es: "Muestra resuelta" })} value={agentState?.resolved_sample || 0} />
          <MetricTile label={tr({ fi: "Peräkkäiset tappiot", en: "Consecutive losses", es: "Pérdidas consecutivas" })} value={agentState?.consecutive_losses || 0} tone={Number(agentState?.consecutive_losses || 0) >= 3 ? "red" : "default"} />
          <MetricTile label={tr({ fi: "Governance ROI", en: "Governance ROI", es: "ROI de gobernanza" })} value={pct(agentState?.roi)} tone={Number(agentState?.roi || 0) >= 0 ? "green" : "red"} />
          <MetricTile label={tr({ fi: "Governance CLV", en: "Governance CLV", es: "CLV de gobernanza" })} value={pct(agentState?.average_clv)} tone={Number(agentState?.average_clv || 0) >= 0 ? "green" : "yellow"} />
        </div>

        {paused && <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-50"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-200">DATABASE-ENFORCED PAUSE</div><div className="mt-2 font-black">{agentState?.pause_reason || "Safety cooldown"}</div><div className="mt-1 text-sm text-rose-100/80">{tr({ fi: "Manuaalinen run-pyyntö on estetty pauselle asetettuun aikaan asti.", en: "Manual run requests are denied until the database pause expires.", es: "Las solicitudes manuales están bloqueadas hasta que termine la pausa." })}</div></div>}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">DAILY BRIEF</div>
            <h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{latestBrief?.headline || tr({ fi: "Briefiä ei ole vielä", en: "No brief yet", es: "Aún no hay resumen" })}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><MetricTile compact label={tr({ fi: "Overall", en: "Overall", es: "General" })} value={latestBrief?.health?.overall || "–"} /><MetricTile compact label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardado" })} value={latestBrief?.cycle?.saved ?? 0} /><MetricTile compact label={tr({ fi: "Hylätty", en: "Blocked", es: "Bloqueado" })} value={latestBrief?.cycle?.blocked ?? 0} /><MetricTile compact label={tr({ fi: "Oppimistila", en: "Learning mode", es: "Modo aprendizaje" })} value={latestBrief?.learning?.mode || "shadow-only"} /></div>
            {(latestBrief?.commonBlockReasons || []).length > 0 && <div className="mt-4 space-y-2">{latestBrief.commonBlockReasons.map((item) => <div key={item.reason} className="flex items-center justify-between rounded-lg border border-[var(--sc-border)] px-3 py-2 text-sm"><span className="text-[var(--sc-muted)]">{item.reason}</span><strong>{item.count}</strong></div>)}</div>}
          </div>

          <div className="rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">CANDIDATE AUDIT · LAST 100</div>
            <div className="mt-3 grid grid-cols-2 gap-3"><MetricTile compact label={tr({ fi: "Hyväksytty", en: "Allowed", es: "Permitido" })} value={auditSummary.allowed} tone="green" /><MetricTile compact label={tr({ fi: "Estetty", en: "Blocked", es: "Bloqueado" })} value={auditSummary.blocked} tone="red" /></div>
            <div className="mt-4 space-y-2">{auditSummary.commonReasons.map(([reason, count]) => <div key={reason} className="flex items-center justify-between rounded-lg border border-[var(--sc-border)] px-3 py-2 text-sm"><span className="text-[var(--sc-muted)]">{reason}</span><strong>{count}</strong></div>)}{auditSummary.commonReasons.length === 0 && <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei estosyitä viimeisessä auditissa.", en: "No blocking reasons in the latest audit.", es: "No hay razones de bloqueo en la auditoría." })}</div>}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{audits.slice(0, 12).map((audit) => <article key={audit.id} className={`rounded-xl border p-4 ${severityClass(audit.allowed)}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black">{audit.match || audit.event_id}</div><div className="mt-1 text-sm opacity-80">{audit.selection} · {Number(audit.odds || 0).toFixed(2)}</div></div><span className="rounded-full border border-current/20 px-2 py-1 text-[9px] font-black">{audit.allowed ? "ALLOWED" : "BLOCKED"}</span></div><div className="mt-3 text-xs leading-5 opacity-85">coverage {pct(audit.data_coverage)} · providers {audit.provider_count ?? "–"} · disagreement {pct(audit.provider_disagreement)}</div>{(audit.reasons || []).length > 0 && <div className="mt-2 text-xs font-bold">{audit.reasons.join(" · ")}</div>}</article>)}</div>
      </>}
    </section>
  );
}
