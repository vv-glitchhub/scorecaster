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
  max_odds: 5
};

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

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/autonomous-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: Boolean(settings.enabled), sports: settings.sports || [], dailyPickLimit: Number(settings.daily_pick_limit), minPriorityScore: Number(settings.min_priority_score), minOdds: Number(settings.min_odds), maxOdds: Number(settings.max_odds) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Settings could not be saved");
      setSettings({ ...DEFAULTS, ...(payload.settings || {}) });
      setMessage(tr({ fi: "Asetukset tallennettiin.", en: "Settings saved.", es: "Configuración guardada." }));
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
      setMessage(tr({ fi: "Uusi paperiajo asetettiin jonoon seuraavaa suojattua worker-kierrosta varten.", en: "A new paper run was queued for the next protected worker cycle.", es: "Se puso en cola una nueva ejecución simulada para el próximo ciclo protegido." }));
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

  const state = data?.state;
  const recentRuns = data?.runs || [];
  const configured = data?.configuration?.configured;
  const globallyEnabled = data?.configuration?.enabledFlag;
  const active = Boolean(data?.agentActive && settings.enabled);
  const selectedSports = settings.sports?.length || 0;
  const status = active ? "ACTIVE" : configured && globallyEnabled ? "WAITING" : "NOT ACTIVE";

  return (
    <div className="space-y-7">
      <PageHero
        tone="purple"
        eyebrow="Autonomous Paper Agent V1"
        title={tr({ fi: "Rajattu automaatio, selkeä tila", en: "Bounded automation, clear status", es: "Automatización limitada, estado claro" })}
        description={tr({ fi: "Valitse lajit ja päätösrajat, tallenna asetukset ja näe yhdellä silmäyksellä onko käyttäjätila, tuotantoworker ja seuraava tarkistus kunnossa. Agentti ei käsittele rahaa eikä aseta oikeita vetoja.", en: "Choose sports and decision limits, save the settings and see at a glance whether user mode, the production worker and the next check are ready. The Agent never handles money or places real bets.", es: "Elige deportes y límites, guarda la configuración y comprueba de un vistazo el modo del usuario, el worker y la próxima revisión. El Agent nunca gestiona dinero ni realiza apuestas reales." })}
        actions={<><button type="button" onClick={() => void save()} disabled={saving || loading} className="sc-button-primary">{saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna asetukset", en: "Save settings", es: "Guardar configuración" })}</button><button type="button" onClick={() => void requestRun()} disabled={requesting || !settings.enabled || !data?.available} className="sc-button-secondary disabled:cursor-not-allowed disabled:opacity-40">{requesting ? tr({ fi: "Jonotetaan…", en: "Queuing…", es: "Encolando…" }) : tr({ fi: "Pyydä uusi paperiajo", en: "Queue a paper run", es: "Solicitar ejecución simulada" })}</button><Link href="/tracking" className="sc-button-ghost">{tr({ fi: "Avaa paperisalkku", en: "Open paper portfolio", es: "Abrir cartera simulada" })}</Link></>}
        aside={<div className="space-y-3"><div className="flex items-center justify-between gap-4"><span className="text-sm font-bold text-slate-400">{tr({ fi: "Autonominen tila", en: "Autonomous mode", es: "Modo autónomo" })}</span><label className="relative inline-flex cursor-pointer items-center gap-3"><input type="checkbox" checked={Boolean(settings.enabled)} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} className="peer sr-only" /><span className="h-7 w-12 rounded-full bg-slate-700 transition peer-checked:bg-purple-300" /><span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" /><span className="font-black text-white">{settings.enabled ? tr({ fi: "PÄÄLLÄ", en: "ON", es: "ACTIVO" }) : tr({ fi: "POIS", en: "OFF", es: "INACTIVO" })}</span></label></div><MetricTile label="Worker" value={status} tone={active ? "green" : "yellow"} /></div>}
      />

      <TrustBar items={[
        { label: tr({ fi: "Saatavuus", en: "Availability", es: "Disponibilidad" }), value: data?.available ? tr({ fi: "valmis", en: "ready", es: "listo" }) : tr({ fi: "ei valmis", en: "not ready", es: "no listo" }), tone: data?.available ? "default" : "danger" },
        { label: tr({ fi: "Valitut lajit", en: "Selected sports", es: "Deportes elegidos" }), value: selectedSports || tr({ fi: "oletukset", en: "defaults", es: "predeterminados" }), tone: "info" },
        { label: tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Próxima revisión" }), value: date(state?.next_check_at), tone: "warning" },
        { label: tr({ fi: "Tuoteraja", en: "Product boundary", es: "Límite" }), value: tr({ fi: "vain paperiseuranta", en: "paper only", es: "solo simulado" }) }
      ]} />

      {message && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-rose-100">{error}</div>}
      {!data?.available && !loading && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">{data?.warning || "Migration required"}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label={tr({ fi: "Käyttäjän tila", en: "User mode", es: "Modo del usuario" })} value={settings.enabled ? tr({ fi: "PÄÄLLÄ", en: "ON", es: "ACTIVO" }) : tr({ fi: "POIS", en: "OFF", es: "INACTIVO" })} tone={settings.enabled ? "green" : "yellow"} />
        <MetricTile label={tr({ fi: "Tuotantoworker", en: "Production worker", es: "Worker de producción" })} value={status} tone={active ? "green" : "yellow"} />
        <MetricTile label={tr({ fi: "Viimeksi tallennettu", en: "Last saved", es: "Últimos guardados" })} value={state?.last_saved_count ?? 0} tone="blue" />
        <MetricTile label={tr({ fi: "Viimeinen virtuaalipanos", en: "Last virtual stake", es: "Última cantidad virtual" })} value={`${Number(state?.last_total_stake || 0).toFixed(2)} €`} tone="purple" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Asetukset", en: "Settings", es: "Configuración" })} title={tr({ fi: "Päivittäiset päätösrajat", en: "Daily decision limits", es: "Límites diarios" })} description={tr({ fi: "Tietokannan pelikassa- ja altistusrajat tarkistetaan vielä uudelleen ennen jokaista tallennusta.", en: "Database bankroll and exposure limits are checked again before every save.", es: "Los límites de banca y exposición se vuelven a comprobar antes de guardar." })} />
            <div className="grid gap-4 md:grid-cols-2">
              <NumberField label={tr({ fi: "Valintoja päivässä", en: "Picks per day", es: "Selecciones por día" })} value={settings.daily_pick_limit} min={1} max={3} step={1} onChange={(value) => setSettings((current) => ({ ...current, daily_pick_limit: value }))} />
              <NumberField label={tr({ fi: "Minimiprioriteetti", en: "Minimum priority", es: "Prioridad mínima" })} value={settings.min_priority_score} min={0.5} max={1} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_priority_score: value }))} />
              <NumberField label={tr({ fi: "Minimikerroin", en: "Minimum odds", es: "Cuota mínima" })} value={settings.min_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_odds: value }))} />
              <NumberField label={tr({ fi: "Maksimikerroin", en: "Maximum odds", es: "Cuota máxima" })} value={settings.max_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, max_odds: value }))} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <SectionHeader eyebrow={tr({ fi: "Markkinat", en: "Markets", es: "Mercados" })} title={tr({ fi: "Lajit ja liigat", en: "Sports and leagues", es: "Deportes y ligas" })} description={tr({ fi: "Valitse enintään kuusi. Tyhjä valinta käyttää Scorecasterin turvallisia oletusmarkkinoita.", en: "Choose up to six. An empty selection uses Scorecaster's safe default markets.", es: "Elige hasta seis. Una selección vacía usa los mercados seguros predeterminados." })} action={<span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-black text-slate-300">{selectedSports}/6</span>} />
            <div className="space-y-5">{sportGroups.map(([sport, items]) => <div key={sport}><div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{sport}</div><div className="flex flex-wrap gap-2">{items.map((item) => { const selected = (settings.sports || []).includes(item.key); return <button type="button" key={item.key} onClick={() => toggleSport(item.key)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${selected ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]"}`}>{item.title}</button>; })}</div></div>)}</div>
          </div>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-xl font-black text-white">{tr({ fi: "Worker-tila", en: "Worker state", es: "Estado del worker" })}</h2><dl className="mt-5 space-y-3 text-sm"><Row label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={state?.last_status || "idle"} /><Row label={tr({ fi: "Viimeinen valmistuminen", en: "Last completion", es: "Última finalización" })} value={date(state?.last_completed_at)} /><Row label={tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Próxima comprobación" })} value={date(state?.next_check_at)} /><Row label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={state?.last_candidate_count ?? 0} /><Row label={tr({ fi: "Valittuja", en: "Selected", es: "Seleccionados" })} value={state?.last_selected_count ?? 0} /><Row label={tr({ fi: "Ohitettuja", en: "Skipped", es: "Omitidos" })} value={state?.last_skipped_count ?? 0} /></dl>{state?.last_error && <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-100">{state.last_error}</div>}</div>
          <details className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><summary className="cursor-pointer font-black text-white">{tr({ fi: "Turvarajat ja ylläpito", en: "Safety and operations", es: "Seguridad y operaciones" })}</summary><div className="mt-4 space-y-3 text-sm leading-6 text-slate-300"><p>{tr({ fi: "Vain PLAY-päätös voidaan tallentaa.", en: "Only a PLAY decision can be saved.", es: "Solo se puede guardar una decisión PLAY." })}</p><p>{tr({ fi: "Sama tapahtuma ei saa toista avointa valintaa.", en: "The same event cannot receive another open pick.", es: "El mismo evento no puede recibir otra selección abierta." })}</p><p>{tr({ fi: "Panosta pienennetään ennen tallennusta ja tietokanta tarkistaa rajat uudelleen.", en: "Stake is reduced before saving and the database rechecks every limit.", es: "La cantidad se reduce antes de guardar y la base de datos vuelve a comprobar todos los límites." })}</p><p>{tr({ fi: "Ei talletuksia, vedonvälittäjäyhteyksiä tai oikean rahan vetoja.", en: "No deposits, bookmaker connections or real-money bets.", es: "Sin depósitos, conexiones con casas de apuestas ni apuestas con dinero real." })}</p><Link href="/operations" className="sc-button-secondary mt-3 inline-flex">Operations</Link></div></details>
        </aside>
      </section>

      <section>
        <SectionHeader eyebrow={tr({ fi: "Historia", en: "History", es: "Historial" })} title={tr({ fi: "Viimeisimmät ajot", en: "Recent runs", es: "Ejecuciones recientes" })} description={tr({ fi: "Näet ehdokkaiden, valittujen ja tallennettujen paperikohteiden määrän.", en: "See candidate, selected and saved paper-pick counts.", es: "Consulta candidatos, seleccionados y pronósticos guardados." })} />
        {recentRuns.length === 0 ? <EmptyState title={tr({ fi: "Ei ajoja vielä", en: "No runs yet", es: "Aún no hay ejecuciones" })} description={tr({ fi: "Aktivoi käyttäjätila, tallenna asetukset ja pyydä ensimmäinen suojattu paperiajo.", en: "Enable user mode, save the settings and queue the first protected paper run.", es: "Activa el modo, guarda la configuración y solicita la primera ejecución protegida." })} /> : <div className="grid gap-4 lg:grid-cols-2">{recentRuns.map((run) => <article key={run.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="font-black text-white">{String(run.status || "unknown").toUpperCase()}</div><div className="text-sm text-slate-500">{date(run.completed_at || run.started_at)}</div></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><MetricTile compact label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={run.candidate_count ?? 0} /><MetricTile compact label={tr({ fi: "Valittuja", en: "Selected", es: "Seleccionados" })} value={run.selected_count ?? 0} tone="blue" /><MetricTile compact label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={run.saved_count ?? 0} tone="green" /><MetricTile compact label={tr({ fi: "Virtuaalipanos", en: "Virtual stake", es: "Cantidad virtual" })} value={`${Number(run.total_stake || 0).toFixed(2)} €`} tone="purple" /></div>{run.error && <div className="mt-3 text-sm text-rose-200">{run.error}</div>}</article>)}</div>}
      </section>
    </div>
  );
}

function NumberField({ label, value, min, max, step, onChange }) { return <label className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{label}</span><input className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function Row({ label, value }) { return <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-black text-white">{value ?? "–"}</dd></div>; }
