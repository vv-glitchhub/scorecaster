"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

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
      setError(loadError instanceof Error ? loadError.message : tr({
        fi: "Autonomous Agentia ei voitu ladata.",
        en: "Autonomous Agent could not be loaded.",
        es: "No se pudo cargar Autonomous Agent."
      }));
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
          maxOdds: Number(settings.max_odds)
        })
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
      setMessage(tr({
        fi: "Uusi paperiajo asetettiin jonoon seuraavaa suojattua worker-kierrosta varten.",
        en: "A new paper run was queued for the next protected worker cycle.",
        es: "Se puso en cola una nueva ejecución simulada para el próximo ciclo protegido."
      }));
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Run could not be queued");
    } finally {
      setRequesting(false);
    }
  }

  const date = (value) => {
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? "–" : parsed.toLocaleString(locale, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  };

  const state = data?.state;
  const recentRuns = data?.runs || [];
  const configured = data?.configuration?.configured;
  const globallyEnabled = data?.configuration?.enabledFlag;
  const active = Boolean(data?.agentActive && settings.enabled);

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%),linear-gradient(135deg,#020617,#111827_58%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-black text-purple-200">
          Autonomous Paper Agent V1
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          {tr({
            fi: "AI tekee rajatut paperipäätökset puolestasi",
            en: "AI makes bounded paper decisions for you",
            es: "La IA toma decisiones simuladas con límites"
          })}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {tr({
            fi: "Agentti käyttää vain palvelimella varmennettuja Top Picks -kohteita, Agent V11:n stressitestejä ja omia virtuaalisen pelikassan rajoja. Se ei aseta oikean rahan vetoja eikä käsittele rahaa.",
            en: "The agent uses only server-verified Top Picks, Agent V11 stress tests and your virtual-bankroll limits. It never places real-money bets or handles money.",
            es: "El agente usa únicamente Top Picks verificados, las pruebas de estrés de Agent V11 y los límites de banca virtual. Nunca realiza apuestas con dinero real."
          })}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => void save()} disabled={saving || loading} className="rounded-2xl bg-purple-300 px-5 py-3 font-black text-slate-950 disabled:opacity-50">
            {saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna asetukset", en: "Save settings", es: "Guardar configuración" })}
          </button>
          <button onClick={() => void requestRun()} disabled={requesting || !settings.enabled || !data?.available} className="rounded-2xl border border-purple-300/30 bg-purple-300/10 px-5 py-3 font-black text-purple-100 disabled:opacity-40">
            {requesting ? tr({ fi: "Jonotetaan…", en: "Queuing…", es: "Encolando…" }) : tr({ fi: "Pyydä uusi ajo", en: "Queue a run", es: "Solicitar ejecución" })}
          </button>
          <Link href="/operations" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Operations</Link>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-100">{message}</div>}
      {error && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-100">{error}</div>}
      {!data?.available && !loading && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 p-4 text-yellow-100">{data?.warning || "Migration required"}</div>}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label={tr({ fi: "Käyttäjän tila", en: "User mode", es: "Modo del usuario" })} value={settings.enabled ? tr({ fi: "PÄÄLLÄ", en: "ON", es: "ACTIVO" }) : tr({ fi: "POIS", en: "OFF", es: "INACTIVO" })} />
        <Metric label={tr({ fi: "Tuotantoworker", en: "Production worker", es: "Worker de producción" })} value={active ? "ACTIVE" : configured && globallyEnabled ? "WAITING" : "NOT ACTIVE"} />
        <Metric label={tr({ fi: "Viimeksi tallennettu", en: "Last saved", es: "Últimos guardados" })} value={state?.last_saved_count ?? 0} />
        <Metric label={tr({ fi: "Viimeinen virtuaalipanos", en: "Last virtual stake", es: "Última cantidad virtual" })} value={`${Number(state?.last_total_stake || 0).toFixed(2)} €`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{tr({ fi: "Päätösrajat", en: "Decision limits", es: "Límites de decisión" })}</h2>
              <p className="mt-2 text-slate-400">{tr({ fi: "Tietokannan pelikassa- ja altistusrajat ovat aina lopullinen portti.", en: "Database bankroll and exposure limits are always the final gate.", es: "Los límites de banca y exposición de la base de datos siempre son la última barrera." })}</p>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-black">
              <input type="checkbox" checked={Boolean(settings.enabled)} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} className="h-5 w-5" />
              {tr({ fi: "Aktivoi", en: "Enable", es: "Activar" })}
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <NumberField label={tr({ fi: "Valintoja päivässä", en: "Picks per day", es: "Selecciones por día" })} value={settings.daily_pick_limit} min={1} max={3} step={1} onChange={(value) => setSettings((current) => ({ ...current, daily_pick_limit: value }))} />
            <NumberField label={tr({ fi: "Minimiprioriteetti", en: "Minimum priority", es: "Prioridad mínima" })} value={settings.min_priority_score} min={0.5} max={1} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_priority_score: value }))} />
            <NumberField label={tr({ fi: "Minimikerroin", en: "Minimum odds", es: "Cuota mínima" })} value={settings.min_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, min_odds: value }))} />
            <NumberField label={tr({ fi: "Maksimikerroin", en: "Maximum odds", es: "Cuota máxima" })} value={settings.max_odds} min={1.01} max={20} step={0.01} onChange={(value) => setSettings((current) => ({ ...current, max_odds: value }))} />
          </div>

          <div className="mt-7">
            <div className="font-black">{tr({ fi: "Lajit ja liigat, enintään 6", en: "Sports and leagues, maximum 6", es: "Deportes y ligas, máximo 6" })}</div>
            <p className="mt-1 text-sm text-slate-500">{tr({ fi: "Tyhjä valinta käyttää Scorecasterin oletusmarkkinoita.", en: "An empty selection uses Scorecaster's default markets.", es: "Una selección vacía usa los mercados predeterminados de Scorecaster." })}</p>
            <div className="mt-4 space-y-5">
              {sportGroups.map(([sport, items]) => <div key={sport}>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{sport}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const selected = (settings.sports || []).includes(item.key);
                    return <button type="button" key={item.key} onClick={() => toggleSport(item.key)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${selected ? "border-purple-300/50 bg-purple-300/15 text-purple-100" : "border-white/10 bg-white/[0.03] text-slate-400"}`}>{item.title}</button>;
                  })}
                </div>
              </div>)}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black">{tr({ fi: "Worker-tila", en: "Worker state", es: "Estado del worker" })}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label={tr({ fi: "Tila", en: "Status", es: "Estado" })} value={state?.last_status || "idle"} />
              <Row label={tr({ fi: "Viimeinen valmistuminen", en: "Last completion", es: "Última finalización" })} value={date(state?.last_completed_at)} />
              <Row label={tr({ fi: "Seuraava tarkistus", en: "Next check", es: "Próxima comprobación" })} value={date(state?.next_check_at)} />
              <Row label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={state?.last_candidate_count ?? 0} />
              <Row label={tr({ fi: "Valittuja", en: "Selected", es: "Seleccionados" })} value={state?.last_selected_count ?? 0} />
              <Row label={tr({ fi: "Ohitettuja", en: "Skipped", es: "Omitidos" })} value={state?.last_skipped_count ?? 0} />
            </dl>
            {state?.last_error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{state.last_error}</div>}
          </div>

          <div className="rounded-[2rem] border border-yellow-400/20 bg-yellow-400/10 p-6 text-yellow-100">
            <h2 className="text-xl font-black">{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</h2>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <p>{tr({ fi: "Vain PLAY-päätös voidaan tallentaa.", en: "Only a PLAY decision can be saved.", es: "Solo se puede guardar una decisión PLAY." })}</p>
              <p>{tr({ fi: "Sama tapahtuma ei saa toista avointa valintaa.", en: "The same event cannot receive another open pick.", es: "El mismo evento no puede recibir otra selección abierta." })}</p>
              <p>{tr({ fi: "Panosta pienennetään ennen tallennusta ja tietokanta tarkistaa rajat uudelleen.", en: "Stake is reduced before saving and the database rechecks every limit.", es: "La cantidad se reduce antes de guardar y la base de datos vuelve a comprobar todos los límites." })}</p>
              <p>{tr({ fi: "Ei talletuksia, vedonvälittäjäyhteyksiä tai oikean rahan vetoja.", en: "No deposits, bookmaker connections or real-money bets.", es: "Sin depósitos, conexiones con casas de apuestas ni apuestas con dinero real." })}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-2xl font-black">{tr({ fi: "Viimeisimmät ajot", en: "Recent runs", es: "Ejecuciones recientes" })}</h2>
        <div className="mt-5 space-y-3">
          {recentRuns.length === 0 && <div className="text-slate-500">{tr({ fi: "Ei ajoja vielä.", en: "No runs yet.", es: "Aún no hay ejecuciones." })}</div>}
          {recentRuns.map((run) => <article key={run.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-black">{String(run.status || "unknown").toUpperCase()}</div>
              <div className="text-sm text-slate-500">{date(run.completed_at || run.started_at)}</div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Mini label={tr({ fi: "Ehdokkaita", en: "Candidates", es: "Candidatos" })} value={run.candidate_count} />
              <Mini label={tr({ fi: "Valittuja", en: "Selected", es: "Seleccionados" })} value={run.selected_count} />
              <Mini label={tr({ fi: "Tallennettu", en: "Saved", es: "Guardados" })} value={run.saved_count} />
              <Mini label={tr({ fi: "Virtuaalipanos", en: "Virtual stake", es: "Cantidad virtual" })} value={`${Number(run.total_stake || 0).toFixed(2)} €`} />
            </div>
            {run.error && <div className="mt-3 text-sm text-red-200">{run.error}</div>}
          </article>)}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 break-words text-2xl font-black">{value}</div></div>;
}

function NumberField({ label, value, min, max, step, onChange }) {
  return <label className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="block text-sm font-bold text-slate-300">{label}</span><input className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-black text-white" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Row({ label, value }) {
  return <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-black text-white">{value ?? "–"}</dd></div>;
}

function Mini({ label, value }) {
  return <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-black">{value ?? 0}</div></div>;
}
