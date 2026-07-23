"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader } from "../components/ProductUI";

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

function NumberInput({ label, value, min, max, step = 1, onChange }) {
  return <label className="space-y-2 text-sm font-bold text-[var(--sc-muted)]"><span>{label}</span><input className="w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-3 text-[var(--sc-text)] outline-none focus:border-purple-300/50" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export default function AutonomousV121Panel() {
  const { tr } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "V12.1 unavailable");
      setPayload(data);
      setSettings({ ...DEFAULTS, ...(data.settings || {}) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "V12.1 unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

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
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "V12.1 settings could not be saved");
      setSettings({ ...DEFAULTS, ...(data.settings || {}) });
      setMessage(tr({ fi: "V12.1-oppimisrajat tallennettiin.", en: "V12.1 learning gates were saved.", es: "Se guardaron los límites V12.1." }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "V12.1 settings could not be saved");
    } finally {
      setSaving(false);
    }
  }

  const latest = payload?.learning?.[0] || null;
  const state = payload?.state || {};
  const incidents = useMemo(() => (payload?.incidents || []).filter((item) => item.active !== false), [payload]);
  const models = payload?.models || [];
  const champion = models.find((item) => item.status === "champion");
  const challenger = models.find((item) => item.status === "challenger");
  const performance = latest?.performance || {};
  const provider = latest?.provider_health || {};

  return (
    <section className="space-y-5 rounded-[1.6rem] border border-purple-300/20 bg-purple-300/[0.045] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Autonomous Intelligence V12.1"
        title={tr({ fi: "Pysyvä oppiminen ja turvaohjaus", en: "Persistent learning and safety control", es: "Aprendizaje y control persistentes" })}
        description={tr({ fi: "Daily Governor säilyttää kovat päivärajat. V12.1 lisää ROI-, CLV-, Brier-, provider- ja mallipromootiohistorian sekä adaptiivisen ajoajan.", en: "The Daily Governor keeps its hard daily limits. V12.1 adds persistent ROI, CLV, Brier, provider and model-promotion history plus adaptive scheduling.", es: "Daily Governor conserva sus límites y V12.1 añade historial y programación adaptativa." })}
        action={<button type="button" onClick={() => void save()} disabled={saving || loading} className="sc-button-primary">{saving ? "…" : tr({ fi: "Tallenna V12.1", en: "Save V12.1", es: "Guardar V12.1" })}</button>}
      />

      {message && <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100">{error}</div>}
      {payload?.warning && <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">{payload.warning}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile compact label={tr({ fi: "Tila", en: "Mode", es: "Modo" })} value={state.operating_mode || latest?.operating_mode || "V12"} tone={state.kill_switch_active ? "red" : "blue"} />
        <MetricTile compact label="Health" value={`${Number(state.health_score ?? latest?.health_score ?? 0).toFixed(0)}/100`} tone={Number(state.health_score ?? latest?.health_score ?? 0) >= 70 ? "green" : "yellow"} />
        <MetricTile compact label="Recent ROI" value={performance.recent?.roi === null || performance.recent?.roi === undefined ? "–" : `${(Number(performance.recent.roi) * 100).toFixed(1)}%`} tone={Number(performance.recent?.roi || 0) >= 0 ? "green" : "yellow"} />
        <MetricTile compact label="Recent CLV" value={performance.recent?.averageClv === null || performance.recent?.averageClv === undefined ? "–" : `${(Number(performance.recent.averageClv) * 100).toFixed(1)}%`} tone={Number(performance.recent?.averageClv || 0) >= 0 ? "green" : "yellow"} />
        <MetricTile compact label="Brier" value={performance.recent?.brierScore ?? "–"} tone="purple" />
        <MetricTile compact label="Provider" value={`${Number(provider.score || 0).toFixed(0)}/100`} tone={provider.status === "healthy" ? "green" : provider.status === "offline" ? "red" : "yellow"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div>
            <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">Autonomy profile</div>
            <div className="grid gap-3 sm:grid-cols-3">{["conservative", "balanced", "research"].map((profile) => <button key={profile} type="button" onClick={() => setSettings((current) => ({ ...current, autonomy_profile: profile }))} className={`rounded-xl border px-4 py-3 text-sm font-black uppercase ${settings.autonomy_profile === profile ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"}`}>{profile}</button>)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <NumberInput label={tr({ fi: "Maksimi tappioputki", en: "Maximum loss streak", es: "Racha máxima" })} value={settings.max_consecutive_losses} min={3} max={20} onChange={(value) => setSettings((current) => ({ ...current, max_consecutive_losses: value }))} />
            <NumberInput label={tr({ fi: "Maksimi drawdown %", en: "Maximum drawdown %", es: "Drawdown máximo" })} value={settings.max_drawdown_percent} min={3} max={30} onChange={(value) => setSettings((current) => ({ ...current, max_drawdown_percent: value }))} />
            <NumberInput label="Provider health min" value={settings.minimum_provider_health} min={30} max={90} onChange={(value) => setSettings((current) => ({ ...current, minimum_provider_health: value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{[
            { key: "learning_enabled", label: tr({ fi: "Jatkuva oppiminen", en: "Continuous learning", es: "Aprendizaje continuo" }) },
            { key: "auto_paper_promotion", label: tr({ fi: "Automaattinen paperimallin promootio", en: "Automatic paper-model promotion", es: "Promoción automática simulada" }) }
          ].map((item) => <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm font-bold text-[var(--sc-text)]"><span>{item.label}</span><input type="checkbox" checked={Boolean(settings[item.key])} onChange={(event) => setSettings((current) => ({ ...current, [item.key]: event.target.checked }))} /></label>)}</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4"><div className="text-[10px] font-black uppercase text-emerald-300">Champion</div><div className="mt-1 font-black text-[var(--sc-text)]">{champion?.model_key || state.champion_model_key || "identity"}</div></div>
          <div className="rounded-xl border border-purple-300/20 bg-purple-300/5 p-4"><div className="text-[10px] font-black uppercase text-purple-300">Challenger</div><div className="mt-1 font-black text-[var(--sc-text)]">{challenger?.model_key || state.challenger_model_key || "identity"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{latest?.promotion_action || "KEEP_CHALLENGER_SHADOW"} · {latest?.sample_size || 0}/300</div></div>
          <p className="text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Promootio vaatii 300 havaintoa, kaksi peräkkäistä valmista snapshotia, stabiilin driftin, hyvän provider-terveyden sekä hyväksyttävän ROI:n ja CLV:n. Se ei muuta julkaistua todennäköisyyttä.", en: "Promotion requires 300 samples, two consecutive ready snapshots, stable drift, healthy providers and acceptable ROI and CLV. It never changes the published probability.", es: "La promoción requiere 300 muestras y nunca cambia la probabilidad publicada." })}</p>
        </div>
      </div>

      {incidents.length > 0 ? <div className="grid gap-3 md:grid-cols-2">{incidents.slice(0, 8).map((incident) => <article key={incident.id || incident.fingerprint} className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100"><div className="text-[10px] font-black uppercase">{incident.incident_type} · {incident.severity}</div><div className="mt-1 font-black">{incident.title}</div><p className="mt-1 text-sm opacity-85">{incident.message}</p></article>)}</div> : payload?.v121Active ? <EmptyState title={tr({ fi: "Aktiivisia V12.1-incidenttejä ei ole", en: "No active V12.1 incidents", es: "No hay incidencias V12.1" })} description={tr({ fi: "Provider-, drift-, drawdown- ja tappioputkirajat eivät ole aktiivisia.", en: "Provider, drift, drawdown and loss-streak gates are not active.", es: "Los límites de seguridad no están activos." })} /> : null}
    </section>
  );
}
