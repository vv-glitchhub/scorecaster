"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader, TrustBar } from "../components/ProductUI";

const DEFAULTS = {
  enabled: false,
  sports: [],
  daily_pick_limit: 3,
  min_priority_score: 0.62,
  min_odds: 1.2,
  max_odds: 5,
  autonomy_profile: "conservative",
  learning_enabled: true,
  auto_paper_promotion: true,
  max_consecutive_losses: 6,
  max_drawdown_percent: 12,
  minimum_provider_health: 60
};

function modeTone(mode) {
  if (mode === "ACTIVE") return "green";
  if (mode === "FROZEN") return "red";
  if (["DEGRADED", "RECOVERY"].includes(mode)) return "yellow";
  return "blue";
}

function NumberField({ label, value, min, max, step, onChange }) {
  return <label className="space-y-2 text-sm font-bold text-slate-300"><span>{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-white outline-none focus:border-purple-300/50" /></label>;
}

export default function AutonomousAgentClient() {
  const { tr, locale } = useLanguage();
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Autonomous Intelligence unavailable");
      setData(payload);
      setSettings({ ...DEFAULTS, ...(payload.settings || {}) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Autonomous Intelligence could not be loaded");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const sportGroups = useMemo(() => {
    const groups = new Map();
    for (const item of data?.supportedSports || []) {
      if (!groups.has(item.sport)) groups.set(item.sport, []);
      groups.get(item.sport).push(item);
    }
    return [...groups.entries()];
  }, [data?.supportedSports]);

  function toggleSport(key) {
    setSettings((current) => {
      const selected = new Set(current.sports || []);
      if (selected.has(key)) selected.delete(key);
      else if (selected.size < 6) selected.add(key);
      return { ...current, sports: [...selected].sort() };
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: Boolean(settings.enabled),
          sports: settings.sports || [],
          dailyPickLimit: Number(settings.daily_pick_limit),
          minPriorityScore: Number(settings.min_priority_score),
          minOdds: Number(settings.min_odds),
          maxOdds: Number(settings.max_odds),
          autonomyProfile: settings.autonomy_profile,
          learningEnabled: Boolean(settings.learning_enabled),
          autoPaperPromotion: Boolean(settings.auto_paper_promotion),
          maxConsecutiveLosses: Number(settings.max_consecutive_losses),
          maxDrawdownPercent: Number(settings.max_drawdown_percent),
          minimumProviderHealth: Number(settings.minimum_provider_health)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Settings could not be saved");
      setSettings({ ...DEFAULTS, ...(payload.settings || {}) });
      setMessage(tr({ fi: "Autonomous Intelligence V12.1 -asetukset tallennettiin.", en: "Autonomous Intelligence V12.1 settings were saved.", es: "Se guardó la configuración V12.1." }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function requestRun() {
    setRequesting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Run could not be queued");
      setMessage(tr({ fi: "V12.1-paperiajo asetettiin seuraavalle suojatulle worker-kierrokselle.", en: "A V12.1 paper cycle was queued for the next protected worker run.", es: "Se puso en cola un ciclo V12.1." }));
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Run could not be queued");
    } finally {
      setRequesting(false);
    }
  }

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const state = data?.state || {};
  const latest = data?.learning?.[0] || null;
  const performance = latest?.performance || {};
  const provider = latest?.provider_health || {};
  const activeIncidents = (data?.incidents || []).filter((item) => item.active !== false);
  const champion = (data?.models || []).find((item) => item.status === "champion") || null;
  const challenger = (data?.models || []).find((item) => item.status === "challenger") || null;
  const configured = data?.configuration?.configured;
  const active = Boolean(data?.agentActive && settings.enabled);
  const mode = state.operating_mode || (data?.v121Active ? "BOOTSTRAP" : "V12 FALLBACK");
  const health = Number(state.health_score ?? latest?.health_score ?? 0);

  return (
    <div className="space-y-7">
      <PageHero
        tone="purple"
        eyebrow="Autonomous Intelligence V12.1"
        title={tr({ fi: "Oppiva, auditoitava ja itseään suojaava paperiagentti", en: "A learning, auditable and self-protecting paper agent", es: "Un agente simulado que aprende y se protege" })}
        description={tr({ fi: "Mission Control hoitaa nykytilan. Tässä määritetään autonomiaprofiili, oppiminen, mallipromootio ja kovat drawdown-, tappioputki- sekä provider-rajat.", en: "Mission Control shows the current state. This page configures the autonomy profile, learning, model promotion and hard drawdown, loss-streak and provider gates.", es: "Mission Control muestra el estado; aquí se configuran los límites y el aprendizaje." })}
        actions={<><button type="button" onClick={() => void save()} disabled={saving || loading} className="sc-button-primary">{saving ? "…" : tr({ fi: "Tallenna V12.1", en: "Save V12.1", es: "Guardar V12.1" })}</button><button type="button" onClick={() => void requestRun()} disabled={requesting || !settings.enabled || !data?.available} className="sc-button-secondary disabled:opacity-40">{requesting ? "…" : tr({ fi: "Jonota paperiajo", en: "Queue paper cycle", es: "Iniciar ciclo" })}</button><Link href="/mission-control" className="sc-button-ghost">Mission Control</Link></>}
        aside={<div className="grid grid-cols-2 gap-2"><MetricTile compact label={tr({ fi: "Tila", en: "Mode", es: "Modo" })} value={String(mode).toUpperCase()} tone={modeTone(mode)} /><MetricTile compact label="Health" value={`${health.toFixed(0)}/100`} tone={health >= 70 ? "green" : health >= 40 ? "yellow" : "red"} /><MetricTile compact label="Kill switch" value={state.kill_switch_active ? "ON" : "OFF"} tone={state.kill_switch_active ? "red" : "green"} /><MetricTile compact label={tr({ fi: "Incidentit", en: "Incidents", es: "Incidencias" })} value={activeIncidents.length} tone={activeIncidents.length ? "red" : "green"} /></div>}
      />

      <TrustBar items={[
        { label: "Worker", value: active ? "ACTIVE" : configured ? "WAITING" : "NOT CONFIGURED", tone: active ? "good" : "warning" },
        { label: "V12.1 storage", value: data?.v121Active ? "ACTIVE" : "V12 FALLBACK", tone: data?.v121Active ? "good" : "warning" },
        { label: tr({ fi: "Seuraava ajo", en: "Next cycle", es: "Próximo ciclo" }), value: date(state.next_check_at), tone: "info" },
        { label: tr({ fi: "Tuoteraja", en: "Boundary", es: "Límite" }), value: "paper-only · no real money", tone: "warning" }
      ]} />

      {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100">{error}</div>}
      {data?.warning && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">{data.warning}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile label={tr({ fi: "Oppimisotos", en: "Learning sample", es: "Muestra" })} value={latest?.sample_size || 0} tone="blue" />
        <MetricTile label="Recent ROI" value={performance.recent?.roi === null || performance.recent?.roi === undefined ? "–" : `${(Number(performance.recent.roi) * 100).toFixed(1)}%`} tone={Number(performance.recent?.roi || 0) >= 0 ? "green" : "yellow"} />
        <MetricTile label="Recent CLV" value={performance.recent?.averageClv === null || performance.recent?.averageClv === undefined ? "–" : `${(Number(performance.recent.averageClv) * 100).toFixed(1)}%`} tone={Number(performance.recent?.averageClv || 0) >= 0 ? "green" : "yellow"} />
        <MetricTile label="Brier" value={performance.recent?.brierScore ?? "–"} tone="purple" />
        <MetricTile label={tr({ fi: "Tappioputki", en: "Loss streak", es: "Racha" })} value={performance.all?.lossStreak || 0} tone={(performance.all?.lossStreak || 0) >= settings.max_consecutive_losses ? "red" : "default"} />
        <MetricTile label="Provider" value={`${Number(provider.score || 0).toFixed(0)}/100`} tone={provider.status === "healthy" ? "green" : provider.status === "offline" ? "red" : "yellow"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow="Autonomy profile" title={tr({ fi: "Autonomian ja oppimisen turvarajat", en: "Autonomy and learning safety limits", es: "Límites de autonomía" })} description={tr({ fi: "Agentti säätää seuraavaa ajoaikaa ja papeririskiä automaattisesti vain näiden rajojen sisällä.", en: "The Agent adapts its next cycle and paper-risk posture only inside these boundaries.", es: "El Agent adapta el ciclo y el riesgo dentro de estos límites." })} />
            <div className="mb-5 grid gap-3 sm:grid-cols-3">{["conservative", "balanced", "research"].map((item) => <button key={item} type="button" onClick={() => setSettings((current) => ({ ...current, autonomy_profile: item }))} className={`rounded-xl border px-4 py-3 text-sm font-black uppercase ${settings.autonomy_profile === item ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-white/10 bg-white/[0.025] text-slate-400"}`}>{item}</button>)}</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <NumberField label={tr({ fi: "Valintoja per ajo", en: "Picks per cycle", es: "Selecciones" })} value={settings.daily_pick_limit} min={1} max={3} step={1} onChange={(value) => setSettings((current) => ({ ...current, daily_pick_limit: value }))} />
              <NumberField label={tr({ fi: "Maksimi tappioputki", en: "Maximum loss streak", es: "Racha máxima" })} value={settings.max_consecutive_losses} min={3} max={20} step={1} onChange={(value) => setSettings((current) => ({ ...current, max_consecutive_losses: value }))} />
              <NumberField label={tr({ fi: "Maksimi drawdown %", en: "Maximum drawdown %", es: "Drawdown máximo" })} value={settings.max_drawdown_percent} min={3} max={30} step={1} onChange={(value) => setSettings((current) => ({ ...current, max_drawdown_percent: value }))} />
              <NumberField label="Provider health min" value={settings.minimum_provider_health} min={30} max={90} step={1} onChange={(value) => setSettings((current) => ({ ...current, minimum_provider_health: value }))} />
              <NumberField label={tr({ fi: "Minimiprioriteetti", en: "Minimum priority", es: "Prioridad mínima" })} value={settings.min_priority_score} min={0.5} max={1} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_priority_score: value }))} />
              <NumberField label={tr({ fi: "Minimikerroin", en: "Minimum odds", es: "Cuota mínima" })} value={settings.min_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_odds: value }))} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{[
              { key: "enabled", label: tr({ fi: "Autonominen paperiajo", en: "Autonomous paper execution", es: "Ejecución simulada" }) },
              { key: "learning_enabled", label: tr({ fi: "Jatkuva oppiminen", en: "Continuous learning", es: "Aprendizaje continuo" }) },
              { key: "auto_paper_promotion", label: tr({ fi: "Paperimallin automaattinen promootio", en: "Automatic paper-model promotion", es: "Promoción automática" }) }
            ].map((item) => <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm font-bold text-slate-200"><span>{item.label}</span><input type="checkbox" checked={Boolean(settings[item.key])} onChange={(event) => setSettings((current) => ({ ...current, [item.key]: event.target.checked }))} /></label>)}</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Markkinat", en: "Markets", es: "Mercados" })} title={tr({ fi: "Autonomisesti seurattavat liigat", en: "Autonomously monitored leagues", es: "Ligas monitorizadas" })} action={<span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black">{settings.sports?.length || 0}/6</span>} />
            <div className="space-y-5">{sportGroups.map(([sportName, items]) => <div key={sportName}><div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{sportName}</div><div className="flex flex-wrap gap-2">{items.map((item) => { const selected = (settings.sports || []).includes(item.key); return <button type="button" key={item.key} onClick={() => toggleSport(item.key)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${selected ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-white/10 text-slate-400"}`}>{item.title}</button>; })}</div></div>)}</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow="Champion–challenger" title={tr({ fi: "Pysyvä mallirekisteri", en: "Persistent model registry", es: "Registro de modelos" })} />
            <div className="space-y-3"><div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4"><div className="text-xs font-black uppercase text-emerald-300">Champion</div><div className="mt-1 font-black text-white">{champion?.model_key || state.champion_model_key || "identity"}</div></div><div className="rounded-xl border border-purple-300/20 bg-purple-300/5 p-4"><div className="text-xs font-black uppercase text-purple-300">Challenger</div><div className="mt-1 font-black text-white">{challenger?.model_key || state.challenger_model_key || "identity"}</div><div className="text-xs text-slate-400">{latest?.promotion_action || "KEEP_CHALLENGER_SHADOW"} · {latest?.sample_size || 0}/300</div></div></div>
            <p className="mt-4 text-xs leading-5 text-slate-400">{tr({ fi: "Promootio vaatii 300 havaintoa, kaksi valmista snapshotia, stabiilin driftin, hyvän provider-terveyden sekä hyväksyttävän ROI:n ja CLV:n. Se vaikuttaa vain papeririskipolitiikkaan.", en: "Promotion requires 300 samples, two ready snapshots, stable drift, healthy providers and acceptable ROI and CLV. It affects paper-risk policy only.", es: "La promoción requiere 300 muestras y solo afecta al riesgo simulado." })}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow="Safety incidents" title={tr({ fi: "Automaattinen suojaus", en: "Automatic protection", es: "Protección automática" })} />
            {activeIncidents.length === 0 ? <EmptyState title={tr({ fi: "Aktiivisia V12.1-incidenttejä ei ole", en: "No active V12.1 incidents", es: "No hay incidencias V12.1" })} description={tr({ fi: "Kill switch-, drift-, provider-, drawdown- ja tappioputkirajat eivät ole aktiivisia.", en: "Kill-switch, drift, provider, drawdown and loss-streak gates are not active.", es: "Los límites de seguridad no están activos." })} /> : <div className="space-y-3">{activeIncidents.slice(0, 8).map((incident) => <article key={incident.id || incident.fingerprint} className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100"><div className="text-[10px] font-black uppercase">{incident.incident_type} · {incident.severity}</div><div className="mt-1 font-black">{incident.title}</div><p className="mt-1 text-sm opacity-85">{incident.message}</p></article>)}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
