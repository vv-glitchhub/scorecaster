"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, SectionHeader, TrustBar } from "../components/ProductUI";

const DEFAULT_CONTROLS = {
  kill_switch: false,
  autonomy_level: "balanced",
  max_daily_loss_percent: 4,
  max_drawdown_percent: 15,
  max_loss_streak: 10,
  allow_shadow_learning: true,
  allow_automatic_risk_tightening: true
};

function percent(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "–";
}

function decimal(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function date(value, locale) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function stateTone(state) {
  if (state === "RUNNING") return "green";
  if (state === "CAUTION" || state === "LEARNING") return "yellow";
  if (state === "PAUSED" || state === "ERROR") return "red";
  return "default";
}

export default function AutonomousV12Panel() {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState(null);
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Autonomous V12 unavailable");
      setPayload(data);
      setControls({ ...DEFAULT_CONTROLS, ...(data.controls || {}) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Autonomous V12 unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveControls(nextControls = controls) {
    if (!payload?.settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const settings = payload.settings;
      const response = await fetch("/api/cloud/autonomous-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: Boolean(settings.enabled),
          sports: settings.sports || [],
          dailyPickLimit: Number(settings.daily_pick_limit || 3),
          minPriorityScore: Number(settings.min_priority_score || 0.62),
          minOdds: Number(settings.min_odds || 1.2),
          maxOdds: Number(settings.max_odds || 5),
          killSwitch: Boolean(nextControls.kill_switch),
          autonomyLevel: nextControls.autonomy_level,
          maxDailyLossPercent: Number(nextControls.max_daily_loss_percent),
          maxDrawdownPercent: Number(nextControls.max_drawdown_percent),
          maxLossStreak: Number(nextControls.max_loss_streak),
          allowShadowLearning: Boolean(nextControls.allow_shadow_learning),
          allowAutomaticRiskTightening: Boolean(nextControls.allow_automatic_risk_tightening)
        })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "V12 controls could not be saved");
      setControls({ ...DEFAULT_CONTROLS, ...(data.controls || nextControls) });
      setMessage(tr({ fi: "Autonomous V12 -ohjaus tallennettiin.", en: "Autonomous V12 controls were saved.", es: "Se guardaron los controles de Autonomous V12." }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "V12 controls could not be saved");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKillSwitch() {
    const next = { ...controls, kill_switch: !controls.kill_switch };
    setControls(next);
    await saveControls(next);
  }

  const state = payload?.v12State;
  const learning = state?.learning_report || payload?.learningCycles?.[0] || null;
  const performance = learning?.performance || learning?.metrics || {};
  const calibration = learning?.calibration || {};
  const challenger = learning?.challenger || {};
  const policy = state?.policy || {};
  const circuit = state?.circuit_breakers || {};
  const audit = payload?.audit || [];
  const operatingState = state?.operating_state || (payload?.v12Available ? "LEARNING" : "NOT ACTIVE");
  const circuitReasons = Array.isArray(circuit.reasons) ? circuit.reasons : [];
  const circuitWarnings = Array.isArray(circuit.warnings) ? circuit.warnings : [];
  const latestSelections = useMemo(() => audit.filter((row) => row.action === "PLAY").slice(0, 8), [audit]);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-purple-300/[0.06] to-transparent p-6 sm:p-8">
        <SectionHeader
          eyebrow="Autonomous Scorecaster V12"
          title={tr({ fi: "Itsenäinen paperiagentti, oppiminen ja hätäjarrut", en: "Autonomous paper agent, learning and circuit breakers", es: "Agente autónomo, aprendizaje y frenos de seguridad" })}
          description={tr({
            fi: "V12 havainnoi, valitsee, panostaa virtuaalisesti, odottaa tulokset, mittaa CLV:n ja kalibroinnin sekä kiristää riskiä automaattisesti. Se ei muuta tuotantotodennäköisyyttä eikä pelaa oikealla rahalla.",
            en: "V12 observes, selects, places virtual stakes, waits for results, measures CLV and calibration, and automatically tightens risk. It never changes production probability or uses real money.",
            es: "V12 observa, selecciona, usa apuestas virtuales, mide CLV y calibración y endurece el riesgo. Nunca usa dinero real."
          })}
          action={<button type="button" onClick={() => void toggleKillSwitch()} disabled={saving || !payload?.v12Available} className={controls.kill_switch ? "sc-button-primary !bg-emerald-300 !text-slate-950" : "sc-button-secondary !border-rose-300/40 !text-rose-100"}>{controls.kill_switch ? tr({ fi: "Poista hätäjarru", en: "Release kill switch", es: "Quitar freno" }) : tr({ fi: "Pysäytä agentti", en: "Stop agent", es: "Detener agente" })}</button>}
        />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile label={tr({ fi: "Toimintatila", en: "Operating state", es: "Estado" })} value={operatingState} tone={stateTone(operatingState)} />
          <MetricTile label={tr({ fi: "Ratkaistut", en: "Settled sample", es: "Muestra" })} value={performance.sampleSize ?? 0} tone="blue" />
          <MetricTile label="ROI" value={percent(performance.roi)} tone={Number(performance.roi) > 0 ? "green" : "default"} />
          <MetricTile label="CLV" value={percent(performance.averageClv)} tone={Number(performance.averageClv) > 0 ? "green" : "yellow"} />
          <MetricTile label="Brier" value={decimal(performance.brier, 4)} tone="purple" />
        </div>
      </div>

      <TrustBar items={[
        { label: tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" }), value: "no-vig market consensus", tone: "info" },
        { label: tr({ fi: "Automaattinen korotus", en: "Automatic upgrade", es: "Mejora automática" }), value: tr({ fi: "estetty", en: "disabled", es: "desactivada" }), tone: "warning" },
        { label: tr({ fi: "Riskin löysäys", en: "Risk relaxation", es: "Relajación" }), value: tr({ fi: "estetty", en: "disabled", es: "desactivada" }), tone: "warning" },
        { label: tr({ fi: "Tila", en: "Mode", es: "Modo" }), value: "paper-only", tone: "good" }
      ]} />

      {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100">{error}</div>}
      {!loading && !payload?.v12Available && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">{payload?.v12Warning || tr({ fi: "Autonomous V12 -migraatio pitää aktivoida.", en: "The Autonomous V12 migration must be activated.", es: "Debe activarse la migración V12." })}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <SectionHeader eyebrow={tr({ fi: "Autonomia", en: "Autonomy", es: "Autonomía" })} title={tr({ fi: "Ohjaustaso ja tappiorajat", en: "Control level and loss limits", es: "Nivel y límites de pérdida" })} description={tr({ fi: "Automaattinen järjestelmä saa vain kiristää näitä rajoja. Se ei saa kasvattaa riskiä käyttäjän asetusten yli.", en: "The autonomous system may only tighten these limits. It cannot increase risk beyond user settings.", es: "El sistema solo puede endurecer estos límites." })} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{tr({ fi: "Autonomian taso", en: "Autonomy level", es: "Nivel" })}</span><select value={controls.autonomy_level} onChange={(event) => setControls((current) => ({ ...current, autonomy_level: event.target.value }))} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white"><option value="observe">Observe</option><option value="conservative">Conservative</option><option value="balanced">Balanced</option></select></label>
            <NumberField label={tr({ fi: "Päivän tappioraja %", en: "Daily loss stop %", es: "Límite diario %" })} value={controls.max_daily_loss_percent} min={0.5} max={10} step={0.5} onChange={(value) => setControls((current) => ({ ...current, max_daily_loss_percent: value }))} />
            <NumberField label={tr({ fi: "Maksimidrawdown %", en: "Maximum drawdown %", es: "Drawdown máximo %" })} value={controls.max_drawdown_percent} min={2} max={30} step={1} onChange={(value) => setControls((current) => ({ ...current, max_drawdown_percent: value }))} />
            <NumberField label={tr({ fi: "Tappioputken pysäytys", en: "Loss-streak stop", es: "Racha máxima" })} value={controls.max_loss_streak} min={3} max={20} step={1} onChange={(value) => setControls((current) => ({ ...current, max_loss_streak: value }))} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Toggle label={tr({ fi: "Shadow-oppiminen", en: "Shadow learning", es: "Aprendizaje shadow" })} checked={controls.allow_shadow_learning} onChange={(checked) => setControls((current) => ({ ...current, allow_shadow_learning: checked }))} />
            <Toggle label={tr({ fi: "Automaattinen riskin kiristys", en: "Automatic risk tightening", es: "Endurecimiento automático" })} checked={controls.allow_automatic_risk_tightening} onChange={(checked) => setControls((current) => ({ ...current, allow_automatic_risk_tightening: checked }))} />
          </div>
          <button type="button" onClick={() => void saveControls()} disabled={saving || !payload?.v12Available} className="sc-button-primary mt-5">{saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna V12-ohjaus", en: "Save V12 controls", es: "Guardar controles" })}</button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <SectionHeader eyebrow="Circuit breakers" title={tr({ fi: "Miksi agentti toimii tai pysähtyy", en: "Why the agent runs or stops", es: "Por qué funciona o se detiene" })} description={tr({ fi: "Pysäytykset perustuvat dataan, provider-terveyteen, settle-jonoon, päivän tappioon, drawdowniin ja oppimisdriftiin.", en: "Stops are driven by data health, providers, settlement backlog, daily loss, drawdown and learning drift.", es: "Los frenos usan salud de datos, pérdidas y drift." })} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><MetricTile compact label={tr({ fi: "Riskiskaala", en: "Risk scale", es: "Escala" })} value={decimal(policy.riskScale, 2)} tone="purple" /><MetricTile compact label={tr({ fi: "Maksimivalinnat", en: "Maximum picks", es: "Máximo" })} value={policy.maxPicks ?? 0} tone="blue" /><MetricTile compact label={tr({ fi: "Maksimipanos", en: "Maximum stake", es: "Apuesta máxima" })} value={`${decimal(policy.maxStakePercent, 2)}%`} /><MetricTile compact label={tr({ fi: "Minimiluottamus", en: "Minimum confidence", es: "Confianza mínima" })} value={percent(policy.minConfidence)} /></div>
          {circuitReasons.length > 0 && <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4"><div className="font-black text-rose-100">STOP</div><div className="mt-2 flex flex-wrap gap-2">{circuitReasons.map((reason) => <span key={reason} className="rounded-full border border-rose-300/20 px-3 py-1 text-xs font-bold text-rose-100">{reason}</span>)}</div></div>}
          {circuitWarnings.length > 0 && <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4"><div className="font-black text-amber-100">WATCH</div><div className="mt-2 flex flex-wrap gap-2">{circuitWarnings.map((reason) => <span key={reason} className="rounded-full border border-amber-300/20 px-3 py-1 text-xs font-bold text-amber-100">{reason}</span>)}</div></div>}
          {!circuitReasons.length && !circuitWarnings.length && <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-100">{tr({ fi: "Yksikään hätäjarru ei ole aktiivinen.", en: "No circuit breaker is active.", es: "No hay frenos activos." })}</div>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <SectionHeader eyebrow="Champion / Challenger" title={tr({ fi: "Oppimisen hyväksyntäportti", en: "Learning promotion gate", es: "Puerta de promoción" })} description={tr({ fi: "Challenger voi nousta vain shadow championiksi. Tuotannon todennäköisyys ei muutu automaattisesti.", en: "The challenger can only become a shadow champion. Production probability never changes automatically.", es: "El challenger solo puede ser campeón shadow." })} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><MetricTile compact label={tr({ fi: "Oppimistila", en: "Learning state", es: "Estado" })} value={learning?.status?.toUpperCase?.() || "LEARNING"} tone={learning?.status === "healthy" ? "green" : "yellow"} /><MetricTile compact label={tr({ fi: "Kalibrointivirhe", en: "Calibration error", es: "Error de calibración" })} value={percent(calibration.expectedCalibrationError)} /><MetricTile compact label={tr({ fi: "CLV-otos", en: "CLV sample", es: "Muestra CLV" })} value={performance.clvSample ?? 0} /><MetricTile compact label={tr({ fi: "Shadow-kelpoinen", en: "Shadow eligible", es: "Elegible shadow" })} value={challenger.eligibleForShadowChampion ? "YES" : "NO"} tone={challenger.eligibleForShadowChampion ? "green" : "yellow"} /></div>
          <div className="mt-4 text-sm leading-6 text-slate-300">{tr({ fi: "Minimiportit: 200 ratkaistua kohdetta, 120 CLV-havaintoa, ei negatiivista keski-CLV:tä, Brier enintään 0,25 ja kalibrointivirhe enintään 6 %.", en: "Minimum gates: 200 settled picks, 120 CLV observations, non-negative average CLV, Brier at most 0.25 and calibration error at most 6%.", es: "Puertas mínimas: 200 selecciones, 120 observaciones CLV y calibración controlada." })}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <SectionHeader eyebrow={tr({ fi: "Viimeisin oppiminen", en: "Latest learning", es: "Último aprendizaje" })} title={tr({ fi: "Suorituskyky ja riski", en: "Performance and risk", es: "Rendimiento y riesgo" })} />
          <dl className="mt-5 space-y-3 text-sm"><Row label={tr({ fi: "Voitot / tappiot", en: "Wins / losses", es: "Ganadas / perdidas" })} value={`${performance.wins ?? 0} / ${performance.losses ?? 0}`} /><Row label={tr({ fi: "Paperitulos", en: "Paper profit", es: "Resultado simulado" })} value={`${decimal(performance.profit)} €`} /><Row label={tr({ fi: "Maksimidrawdown", en: "Maximum drawdown", es: "Drawdown máximo" })} value={`${decimal(performance.maxDrawdown)} €`} /><Row label={tr({ fi: "Nykyinen tappioputki", en: "Current loss streak", es: "Racha actual" })} value={performance.currentLosingStreak ?? 0} /><Row label={tr({ fi: "Viimeinen oppiminen", en: "Last learning", es: "Último aprendizaje" })} value={date(state?.last_learning_at, locale)} /></dl>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <SectionHeader eyebrow="Decision audit" title={tr({ fi: "Mitä agentti teki ja miksi", en: "What the agent did and why", es: "Qué hizo y por qué" })} description={tr({ fi: "Jokainen PLAY, SKIP ja PAUSE tallennetaan syineen ja päätöshetken evidenssillä.", en: "Every PLAY, SKIP and PAUSE is stored with its reasons and decision-time evidence.", es: "Cada acción se guarda con razones y evidencia." })} />
        {audit.length === 0 ? <EmptyState title={tr({ fi: "Auditointia ei ole vielä", en: "No audit yet", es: "Aún no hay auditoría" })} description={tr({ fi: "Ensimmäinen V12-worker-kierros täyttää tämän näkymän.", en: "The first V12 worker cycle will populate this view.", es: "El primer ciclo V12 llenará esta vista." })} /> : <div className="mt-5 grid gap-3 md:grid-cols-2">{audit.slice(0, 20).map((row) => <article key={row.id} className={`rounded-2xl border p-4 ${row.action === "PLAY" ? "border-emerald-300/20 bg-emerald-300/[0.07]" : row.action === "PAUSE" ? "border-rose-300/20 bg-rose-300/[0.07]" : "border-white/10 bg-black/20"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{row.action} · {row.selection || tr({ fi: "Järjestelmä", en: "System", es: "Sistema" })}</div><div className="mt-1 text-sm text-slate-500">{date(row.created_at, locale)}</div></div><div className="text-xs font-black text-slate-400">{row.evidence?.league || ""}</div></div>{row.reasons?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{row.reasons.map((reason) => <span key={reason} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-300">{reason}</span>)}</div>}</article>)}</div>}
        {latestSelections.length > 0 && <div className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">{latestSelections.length} recent autonomous paper PLAY decisions</div>}
      </div>
    </section>
  );
}

function NumberField({ label, value, min, max, step, onChange }) {
  return <label className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white" /></label>;
}

function Toggle({ label, checked, onChange }) {
  return <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"><span className="text-sm font-bold text-slate-300">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-purple-300" /></label>;
}

function Row({ label, value }) {
  return <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-black text-white">{value ?? "–"}</dd></div>;
}
