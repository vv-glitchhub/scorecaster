"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  EmptyState,
  MetricTile,
  PageHero,
  SectionHeader,
  TrustBar
} from "../components/ProductUI";

const DEFAULTS = {
  enabled: false,
  sports: [],
  daily_pick_limit: 3,
  min_priority_score: 0.62,
  min_odds: 1.2,
  max_odds: 5,
  min_data_coverage: 0.6,
  min_provider_count: 1,
  max_provider_disagreement: 0.12,
  max_drawdown_percent: 12,
  max_daily_loss_percent: 4,
  pause_after_losses: 5,
  cooldown_hours: 12,
  max_open_picks: 12,
  minimum_minutes_before_start: 20,
  maximum_hours_before_start: 72,
  auto_pause_on_incident: true,
  require_unified_data: true,
  adaptive_cadence: true,
  shadow_learning_enabled: true
};

function pct(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function numeric(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "–";
}

function healthTone(status) {
  if (["healthy", "ready", "success"].includes(status)) return "green";
  if (["paused", "blocked", "error"].includes(status)) return "red";
  return "yellow";
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
      if (!response.ok) throw new Error(payload?.error || "Autonomous Agent unavailable");
      setData(payload);
      setSettings({ ...DEFAULTS, ...(payload.settings || {}) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tr({ fi: "Autonomous Agentia ei voitu ladata.", en: "Autonomous Agent could not be loaded.", es: "No se pudo cargar Autonomous Agent." }));
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

  async function persist(nextSettings = settings, successText = null) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: Boolean(nextSettings.enabled),
          sports: nextSettings.sports || [],
          dailyPickLimit: Number(nextSettings.daily_pick_limit),
          minPriorityScore: Number(nextSettings.min_priority_score),
          minOdds: Number(nextSettings.min_odds),
          maxOdds: Number(nextSettings.max_odds),
          minDataCoverage: Number(nextSettings.min_data_coverage),
          minProviderCount: Number(nextSettings.min_provider_count),
          maxProviderDisagreement: Number(nextSettings.max_provider_disagreement),
          maxDrawdownPercent: Number(nextSettings.max_drawdown_percent),
          maxDailyLossPercent: Number(nextSettings.max_daily_loss_percent),
          pauseAfterLosses: Number(nextSettings.pause_after_losses),
          cooldownHours: Number(nextSettings.cooldown_hours),
          maxOpenPicks: Number(nextSettings.max_open_picks),
          minimumMinutesBeforeStart: Number(nextSettings.minimum_minutes_before_start),
          maximumHoursBeforeStart: Number(nextSettings.maximum_hours_before_start),
          autoPauseOnIncident: Boolean(nextSettings.auto_pause_on_incident),
          requireUnifiedData: Boolean(nextSettings.require_unified_data),
          adaptiveCadence: Boolean(nextSettings.adaptive_cadence),
          shadowLearningEnabled: Boolean(nextSettings.shadow_learning_enabled)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Settings could not be saved");
      setSettings({ ...DEFAULTS, ...(payload.settings || {}) });
      setMessage(successText || tr({ fi: "Autonomian asetukset tallennettiin.", en: "Autonomy settings saved.", es: "Configuración autónoma guardada." }));
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
      setMessage(tr({ fi: "V2-paperiajo asetettiin jonoon seuraavaa suojattua worker-kierrosta varten.", en: "A V2 paper run was queued for the next protected worker cycle.", es: "Se puso en cola una ejecución V2 para el próximo ciclo protegido." }));
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Run could not be queued");
    } finally {
      setRequesting(false);
    }
  }

  async function emergencyStop() {
    const stopped = { ...settings, enabled: false };
    setSettings(stopped);
    await persist(stopped, tr({ fi: "Hätäpysäytys aktivoitiin. Uusia paperivalintoja ei tehdä.", en: "Emergency stop activated. No new paper selections will be made.", es: "Parada de emergencia activada. No se harán nuevas selecciones." }));
  }

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const state = data?.state;
  const readiness = data?.readiness || { ready: false, blockers: [] };
  const recentRuns = data?.runs || [];
  const audit = data?.audit || [];
  const latestBrief = data?.briefs?.[0]?.brief || state?.last_brief || null;
  const configured = data?.configuration?.configured;
  const globallyEnabled = data?.configuration?.enabledFlag;
  const active = Boolean(data?.agentActive && settings.enabled && readiness.ready);
  const selectedSports = settings.sports?.length || 0;
  const status = active ? "ACTIVE" : state?.paused_until && Date.parse(state.paused_until) > Date.now() ? "PAUSED" : configured && globallyEnabled ? "WAITING" : "NOT ACTIVE";
  const allowedAudit = audit.filter((item) => item.allowed).length;
  const blockedAudit = audit.length - allowedAudit;

  return (
    <div className="space-y-8">
      <PageHero
        tone="purple"
        eyebrow="Autonomous Paper Agent V2"
        title={tr({ fi: "Autonominen, mutta aina valvottu", en: "Autonomous, but always governed", es: "Autónomo, pero siempre controlado" })}
        description={tr({ fi: "Agentti tarkistaa markkinan, Unified Sports Datan, providerit, incidentit, drawdownin, päivätappion, CLV:n, loss-streakin ja tietokannan riskirajat ennen jokaista virtuaalivalintaa. Oppiminen pysyy shadow-tilassa.", en: "Before every virtual selection, the Agent checks the market, Unified Sports Data, providers, incidents, drawdown, daily loss, CLV, loss streak and database risk limits. Learning stays in shadow mode.", es: "Antes de cada selección virtual, el Agent verifica mercado, datos, proveedores, incidencias, drawdown, pérdidas, CLV y límites. El aprendizaje permanece en modo sombra." })}
        actions={<><button type="button" onClick={() => void persist()} disabled={saving || loading} className="sc-button-primary">{saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna V2-asetukset", en: "Save V2 settings", es: "Guardar ajustes V2" })}</button><button type="button" onClick={() => void requestRun()} disabled={requesting || !settings.enabled || !data?.available || !readiness.ready} className="sc-button-secondary disabled:cursor-not-allowed disabled:opacity-40">{requesting ? tr({ fi: "Jonotetaan…", en: "Queuing…", es: "Encolando…" }) : tr({ fi: "Pyydä turvallinen paperiajo", en: "Queue safe paper run", es: "Solicitar ejecución segura" })}</button><button type="button" onClick={() => void emergencyStop()} disabled={saving || !settings.enabled} className="sc-button-ghost border-rose-300/30 text-rose-200">{tr({ fi: "Hätäpysäytys", en: "Emergency stop", es: "Parada de emergencia" })}</button><Link href="/tracking" className="sc-button-ghost">{tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" })}</Link></>}
        aside={<div className="space-y-3"><div className="flex items-center justify-between gap-4"><span className="text-sm font-bold text-slate-400">{tr({ fi: "Käyttäjän opt-in", en: "User opt-in", es: "Activación del usuario" })}</span><label className="relative inline-flex cursor-pointer items-center gap-3"><input type="checkbox" checked={Boolean(settings.enabled)} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} className="peer sr-only" /><span className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-purple-300" /><span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" /><span className="font-black text-white">{settings.enabled ? "ON" : "OFF"}</span></label></div><MetricTile label={tr({ fi: "Autonomiatila", en: "Autonomy status", es: "Estado autónomo" })} value={status} tone={active ? "green" : status === "PAUSED" ? "red" : "yellow"} /><MetricTile label={tr({ fi: "Terveys", en: "Health", es: "Salud" })} value={`${Number(state?.health_score ?? readiness.healthScore ?? 0).toFixed(0)}/100`} tone={healthTone(state?.health_status)} /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" }), value: "no-vig market consensus", tone: "info" },
        { label: tr({ fi: "Oppiminen", en: "Learning", es: "Aprendizaje" }), value: "shadow-only", tone: "warning" },
        { label: tr({ fi: "Automaattinen korotus", en: "Automatic upgrade", es: "Mejora automática" }), value: tr({ fi: "estetty", en: "disabled", es: "desactivada" }), tone: "warning" },
        { label: tr({ fi: "Rytmi", en: "Cadence", es: "Cadencia" }), value: settings.adaptive_cadence ? tr({ fi: "adaptiivinen", en: "adaptive", es: "adaptativa" }) : "180 min", tone: "info" },
        { label: tr({ fi: "Tuoteraja", en: "Boundary", es: "Límite" }), value: "paper-only", tone: "warning" }
      ]} />

      {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100">{error}</div>}
      {!data?.available && !loading && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">{data?.warning || "Migration required"}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricTile label={tr({ fi: "Readiness", en: "Readiness", es: "Preparación" })} value={readiness.ready ? "READY" : "BLOCKED"} tone={readiness.ready ? "green" : "red"} />
        <MetricTile label={tr({ fi: "Ratkaistu otos", en: "Settled sample", es: "Muestra resuelta" })} value={state?.resolved_sample ?? 0} />
        <MetricTile label="ROI" value={pct(state?.roi)} tone={Number(state?.roi) >= 0 ? "green" : "yellow"} />
        <MetricTile label="CLV" value={pct(state?.average_clv)} tone={Number(state?.average_clv) >= 0 ? "green" : "yellow"} />
        <MetricTile label="Drawdown" value={`${numeric(state?.drawdown_percent, 1)} %`} tone={Number(state?.drawdown_percent) >= Number(settings.max_drawdown_percent) * 0.75 ? "red" : "default"} />
        <MetricTile label={tr({ fi: "Tappioputki", en: "Loss streak", es: "Racha negativa" })} value={state?.consecutive_losses ?? 0} tone={Number(state?.consecutive_losses) >= Number(settings.pause_after_losses) ? "red" : "default"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow="Readiness guard" title={tr({ fi: "Miksi agentti toimii tai pysähtyy", en: "Why the Agent runs or stops", es: "Por qué el Agent actúa o se detiene" })} description={tr({ fi: "Turvaportti voi pysäyttää agentin vaikka käyttäjätila olisi päällä. Hätäpysäytys poistaa opt-inin välittömästi.", en: "The safety gate can stop the Agent even when user mode is enabled. Emergency stop removes opt-in immediately.", es: "La puerta de seguridad puede detener al Agent aunque esté activado." })} />
            {readiness.blockers?.length ? <div className="flex flex-wrap gap-2">{readiness.blockers.map((item) => <span key={item} className="rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100">{item}</span>)}</div> : <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 font-bold text-emerald-100">{tr({ fi: "Kaikki käyttäjä- ja tuotantoportit ovat valmiit seuraavaan turvalliseen sykliin.", en: "All user and production gates are ready for the next safe cycle.", es: "Todas las puertas están listas para el próximo ciclo seguro." })}</div>}
            {(state?.pause_reason || state?.paused_until) && <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100"><div className="font-black">{tr({ fi: "Turvapaussi", en: "Safety cooldown", es: "Pausa de seguridad" })}</div><div className="mt-1 text-sm">{state?.pause_reason || "safety guard"}</div><div className="mt-1 text-sm">{tr({ fi: "Voimassa", en: "Until", es: "Hasta" })}: {date(state?.paused_until)}</div></div>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Valintarajat", en: "Selection limits", es: "Límites de selección" })} title={tr({ fi: "Hinta, prioriteetti ja tapahtumaikkuna", en: "Price, priority and event window", es: "Precio, prioridad y ventana" })} description={tr({ fi: "Tietokannan pelikassa- ja altistusrajat tarkistetaan aina vielä uudelleen.", en: "Database bankroll and exposure limits are always checked again.", es: "Los límites de banca y exposición se verifican de nuevo." })} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <NumberField label={tr({ fi: "Valintoja päivässä", en: "Picks per day", es: "Selecciones al día" })} value={settings.daily_pick_limit} min={1} max={3} step={1} onChange={(value) => setSettings((current) => ({ ...current, daily_pick_limit: value }))} />
              <NumberField label={tr({ fi: "Minimiprioriteetti", en: "Minimum priority", es: "Prioridad mínima" })} value={settings.min_priority_score} min={0.5} max={1} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_priority_score: value }))} />
              <NumberField label={tr({ fi: "Maksimi avoimet kohteet", en: "Maximum open picks", es: "Máximo de selecciones abiertas" })} value={settings.max_open_picks} min={1} max={100} step={1} onChange={(value) => setSettings((current) => ({ ...current, max_open_picks: value }))} />
              <NumberField label={tr({ fi: "Minimikerroin", en: "Minimum odds", es: "Cuota mínima" })} value={settings.min_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_odds: value }))} />
              <NumberField label={tr({ fi: "Maksimikerroin", en: "Maximum odds", es: "Cuota máxima" })} value={settings.max_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, max_odds: value }))} />
              <NumberField label={tr({ fi: "Minuutit ennen alkua", en: "Minutes before start", es: "Minutos antes" })} value={settings.minimum_minutes_before_start} min={5} max={240} step={5} onChange={(value) => setSettings((current) => ({ ...current, minimum_minutes_before_start: value }))} />
              <NumberField label={tr({ fi: "Maksimitunnit ennen alkua", en: "Maximum hours before start", es: "Máximo de horas" })} value={settings.maximum_hours_before_start} min={2} max={168} step={1} onChange={(value) => setSettings((current) => ({ ...current, maximum_hours_before_start: value }))} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow="Unified Data gates" title={tr({ fi: "Data, providerit ja ristiriidat", en: "Data, providers and disagreement", es: "Datos, proveedores y desacuerdo" })} description={tr({ fi: "V2 voi estää muuten hyvän PLAY-kohteen, jos sen evidenssipohja ei ole riittävä.", en: "V2 can block an otherwise good PLAY when its evidence base is insufficient.", es: "V2 puede bloquear un PLAY si la evidencia es insuficiente." })} />
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField label={tr({ fi: "Minimi varmennettu kattavuus", en: "Minimum verified coverage", es: "Cobertura mínima" })} value={settings.min_data_coverage} min={0} max={1} step={0.05} onChange={(value) => setSettings((current) => ({ ...current, min_data_coverage: value }))} />
              <NumberField label={tr({ fi: "Minimi odds-providerit", en: "Minimum odds providers", es: "Mínimo de proveedores" })} value={settings.min_provider_count} min={1} max={5} step={1} onChange={(value) => setSettings((current) => ({ ...current, min_provider_count: value }))} />
              <NumberField label={tr({ fi: "Maksimi provider-ero", en: "Maximum provider disagreement", es: "Desacuerdo máximo" })} value={settings.max_provider_disagreement} min={0.01} max={0.5} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, max_provider_disagreement: value }))} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle label={tr({ fi: "Vaadi Unified Sports Data", en: "Require Unified Sports Data", es: "Exigir datos unificados" })} checked={settings.require_unified_data} onChange={(value) => setSettings((current) => ({ ...current, require_unified_data: value }))} /><Toggle label={tr({ fi: "Pysäytä järjestelmäincidentistä", en: "Pause on system incident", es: "Pausar por incidencia" })} checked={settings.auto_pause_on_incident} onChange={(value) => setSettings((current) => ({ ...current, auto_pause_on_incident: value }))} /></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Suorituskykysuoja", en: "Performance guard", es: "Protección de rendimiento" })} title={tr({ fi: "Automaattinen tappio- ja drawdown-jarru", en: "Automatic loss and drawdown brake", es: "Freno automático de pérdidas" })} description={tr({ fi: "Raja ei muuta ennustemallia. Se pienentää panosta tai pysäyttää paperitoiminnan määräajaksi.", en: "The guard does not change the prediction model. It reduces stake or pauses paper activity for a cooldown.", es: "La protección no cambia el modelo; reduce o pausa la actividad simulada." })} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <NumberField label="Max drawdown %" value={settings.max_drawdown_percent} min={2} max={50} step={1} onChange={(value) => setSettings((current) => ({ ...current, max_drawdown_percent: value }))} />
              <NumberField label={tr({ fi: "Päivätappio %", en: "Daily loss %", es: "Pérdida diaria %" })} value={settings.max_daily_loss_percent} min={1} max={25} step={1} onChange={(value) => setSettings((current) => ({ ...current, max_daily_loss_percent: value }))} />
              <NumberField label={tr({ fi: "Tappioita ennen taukoa", en: "Losses before pause", es: "Pérdidas antes de pausa" })} value={settings.pause_after_losses} min={2} max={20} step={1} onChange={(value) => setSettings((current) => ({ ...current, pause_after_losses: value }))} />
              <NumberField label={tr({ fi: "Cooldown tuntia", en: "Cooldown hours", es: "Horas de pausa" })} value={settings.cooldown_hours} min={1} max={168} step={1} onChange={(value) => setSettings((current) => ({ ...current, cooldown_hours: value }))} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><Toggle label={tr({ fi: "Adaptiivinen tarkistusrytmi", en: "Adaptive check cadence", es: "Cadencia adaptativa" })} checked={settings.adaptive_cadence} onChange={(value) => setSettings((current) => ({ ...current, adaptive_cadence: value }))} /><Toggle label={tr({ fi: "Shadow-oppiminen", en: "Shadow learning", es: "Aprendizaje sombra" })} checked={settings.shadow_learning_enabled} onChange={(value) => setSettings((current) => ({ ...current, shadow_learning_enabled: value }))} /></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Markkinat", en: "Markets", es: "Mercados" })} title={tr({ fi: "Lajit ja liigat", en: "Sports and leagues", es: "Deportes y ligas" })} description={tr({ fi: "Valitse enintään kuusi. Tyhjä valinta käyttää turvallisia oletusmarkkinoita.", en: "Choose up to six. An empty selection uses safe default markets.", es: "Elige hasta seis. Vacío usa mercados seguros." })} action={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-300">{selectedSports}/6</span>} />
            <div className="space-y-5">{sportGroups.map(([sport, items]) => <div key={sport}><div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{sport}</div><div className="flex flex-wrap gap-2">{items.map((item) => { const selected = (settings.sports || []).includes(item.key); return <button type="button" key={item.key} onClick={() => toggleSport(item.key)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${selected ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-white/10 bg-black/20 text-slate-400 hover:border-white/20"}`}>{item.title}</button>; })}</div></div>)}</div>
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-xl font-black text-white">{tr({ fi: "Worker-tila", en: "Worker state", es: "Estado del worker" })}</h2><dl className="mt-5 space-y-3 text-sm"><Row label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={state?.last_status || "idle"} /><Row label={tr({ fi: "Terveystila", en: "Health status", es: "Estado de salud" })} value={state?.health_status || "learning"} /><Row label={tr({ fi: "Viimeinen valmistuminen", en: "Last completion", es: "Última finalización" })} value={date(state?.last_completed_at)} /><Row label={tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Próxima comprobación" })} value={date(state?.next_check_at)} /><Row label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={state?.last_candidate_count ?? 0} /><Row label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={state?.last_saved_count ?? 0} /><Row label={tr({ fi: "Virtuaalipanos", en: "Virtual stake", es: "Cantidad virtual" })} value={`${numeric(state?.last_total_stake)} €`} /></dl>{state?.last_error && <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{state.last_error}</div>}</div>

          {latestBrief && <div className="rounded-3xl border border-purple-300/20 bg-purple-300/[0.07] p-5"><div className="text-xs font-black uppercase tracking-[0.16em] text-purple-200">Daily Autonomous Brief</div><h2 className="mt-2 text-xl font-black text-white">{latestBrief.headline}</h2><div className="mt-4 grid grid-cols-2 gap-3"><MetricTile compact label={tr({ fi: "Ehdokkaat", en: "Candidates", es: "Candidatos" })} value={latestBrief.cycle?.candidates ?? 0} /><MetricTile compact label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={latestBrief.cycle?.saved ?? 0} tone="green" /><MetricTile compact label="Sample" value={latestBrief.learning?.resolvedSample ?? 0} /><MetricTile compact label="CLV" value={pct(latestBrief.learning?.averageClv)} tone="blue" /></div>{latestBrief.commonBlockReasons?.length ? <div className="mt-4 space-y-2 text-sm text-slate-300">{latestBrief.commonBlockReasons.map((item) => <div key={item.reason} className="flex justify-between gap-4"><span>{item.reason}</span><strong>{item.count}</strong></div>)}</div> : null}</div>}

          <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><summary className="cursor-pointer font-black text-white">{tr({ fi: "Muuttumattomat turvarajat", en: "Unchanged safety boundaries", es: "Límites sin cambios" })}</summary><div className="mt-4 space-y-3 text-sm leading-6 text-slate-300"><p>{tr({ fi: "Vain täydet portit läpäissyt PLAY voidaan tallentaa.", en: "Only a PLAY that passes every gate can be saved.", es: "Solo un PLAY que supere todas las puertas puede guardarse." })}</p><p>{tr({ fi: "Konteksti tai oppiminen ei voi nostaa kohdetta PLAYksi.", en: "Context or learning cannot upgrade a selection to PLAY.", es: "El contexto o aprendizaje no puede elevar a PLAY." })}</p><p>{tr({ fi: "Sama tapahtuma ei saa toista avointa valintaa.", en: "The same event cannot receive another open pick.", es: "El mismo evento no puede recibir otra selección abierta." })}</p><p>{tr({ fi: "Ei talletuksia, vedonvälittäjäyhteyksiä tai oikean rahan vetoja.", en: "No deposits, bookmaker connections or real-money bets.", es: "Sin depósitos, conexiones ni apuestas reales." })}</p><Link href="/operations" className="sc-button-secondary mt-3 inline-flex">Operations</Link></div></details>
        </aside>
      </section>

      <section>
        <SectionHeader eyebrow="Decision audit" title={tr({ fi: "Viimeisimmät hyväksynnät ja estot", en: "Recent approvals and blocks", es: "Aprobaciones y bloqueos recientes" })} description={tr({ fi: "Myös hylätyt ehdokkaat säilytetään syineen. Tämä tekee agentista jäljitettävän eikä mustaa laatikkoa.", en: "Rejected candidates are retained with reasons. This makes the Agent traceable instead of a black box.", es: "Los candidatos rechazados se guardan con motivos." })} action={<span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-slate-300">{allowedAudit} allowed · {blockedAudit} blocked</span>} />
        {audit.length === 0 ? <EmptyState title={tr({ fi: "Audit-historiaa ei vielä ole", en: "No audit history yet", es: "Aún no hay historial" })} description={tr({ fi: "Ensimmäinen V2-worker-sykli tallentaa jokaisen ehdokkaan ja porttisyyt.", en: "The first V2 worker cycle stores every candidate and gate reason.", es: "El primer ciclo V2 guardará cada candidato." })} /> : <div className="grid gap-4 lg:grid-cols-2">{audit.slice(0, 20).map((item) => <article key={item.id} className={`rounded-3xl border p-5 ${item.allowed ? "border-emerald-300/25 bg-emerald-300/[0.06]" : "border-rose-300/20 bg-rose-300/[0.045]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.league} · {date(item.created_at)}</div><h3 className="mt-1 font-black text-white">{item.match}</h3><div className="text-sm text-slate-300">{item.selection} · {numeric(item.odds)}</div></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${item.allowed ? "bg-emerald-300/15 text-emerald-100" : "bg-rose-300/15 text-rose-100"}`}>{item.allowed ? "ALLOWED" : "BLOCKED"}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-4"><span>quality {numeric(item.quality_score, 0)}</span><span>coverage {pct(item.data_coverage, 0)}</span><span>providers {item.provider_count ?? "–"}</span><span>gap {pct(item.provider_disagreement, 1)}</span></div>{item.reasons?.length ? <div className="mt-4 flex flex-wrap gap-2">{item.reasons.map((reason) => <span key={reason} className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-[11px] font-bold text-rose-100">{reason}</span>)}</div> : null}{item.warnings?.length ? <div className="mt-3 flex flex-wrap gap-2">{item.warnings.map((warning) => <span key={warning} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-100">{warning}</span>)}</div> : null}</article>)}</div>}
      </section>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Ajohistoria", en: "Run history", es: "Historial de ejecuciones" })} title={tr({ fi: "Viimeisimmät autonomiset syklit", en: "Recent autonomous cycles", es: "Ciclos autónomos recientes" })} description={tr({ fi: "Jokainen ajo sisältää terveyden, guardit, seuraavan tarkistusajan ja daily briefin.", en: "Every run includes health, guards, next-check cadence and a daily brief.", es: "Cada ejecución incluye salud, protecciones y próximo control." })} />
        {recentRuns.length === 0 ? <EmptyState title={tr({ fi: "Ei ajoja vielä", en: "No runs yet", es: "Aún no hay ejecuciones" })} description={tr({ fi: "Aktivoi käyttäjätila, tallenna V2-asetukset ja pyydä ensimmäinen suojattu sykli.", en: "Enable user mode, save V2 settings and queue the first protected cycle.", es: "Activa el modo, guarda V2 y solicita el primer ciclo." })} /> : <div className="grid gap-4 lg:grid-cols-2">{recentRuns.map((run) => <article key={run.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="font-black text-white">{String(run.status || "unknown").toUpperCase()}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${run.health_status === "paused" || run.health_status === "blocked" ? "bg-rose-300/15 text-rose-100" : run.health_status === "healthy" ? "bg-emerald-300/15 text-emerald-100" : "bg-amber-300/15 text-amber-100"}`}>{String(run.health_status || "learning").toUpperCase()} {run.health_score ?? "–"}</span></div><div className="text-sm text-slate-500">{date(run.completed_at || run.started_at)}</div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"><MetricTile compact label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={run.candidate_count ?? 0} /><MetricTile compact label={tr({ fi: "Valittuja", en: "Selected", es: "Seleccionados" })} value={run.selected_count ?? 0} tone="blue" /><MetricTile compact label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={run.saved_count ?? 0} tone="green" /><MetricTile compact label={tr({ fi: "Virtuaalipanos", en: "Virtual stake", es: "Cantidad virtual" })} value={`${numeric(run.total_stake)} €`} tone="purple" /><MetricTile compact label={tr({ fi: "Seuraava", en: "Next", es: "Próxima" })} value={`${run.next_check_minutes ?? "–"} min`} /></div>{run.error && <div className="mt-3 text-sm text-rose-200">{run.error}</div>}</article>)}</div>}
      </section>
    </div>
  );
}

function NumberField({ label, value, min, max, step, onChange }) { return <label className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{label}</span><input className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function Toggle({ label, checked, onChange }) { return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-bold text-slate-300">{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-purple-300" /></label>; }
function Row({ label, value }) { return <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-black text-white">{value ?? "–"}</dd></div>; }
