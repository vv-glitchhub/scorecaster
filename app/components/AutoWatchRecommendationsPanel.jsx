"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SPORTS } from "../../lib/sports.js";
import { useLanguage } from "./LanguageProvider";

const DEFAULTS = {
  enabled: false,
  top_n: 3,
  alert_move_percent: 0.03,
  alert_before_minutes: 120,
  selection_mode: "play-and-caution",
  min_score: 0,
  min_edge: 0,
  min_ev: 0,
  sport_keys: [],
  last_completed_at: null,
  last_status: "idle",
  last_error: null,
  last_synced_count: 0,
  last_removed_count: 0
};

function percentInput(value, fallback = 0) {
  return Math.round(Number(value ?? fallback) * 1000) / 10;
}

export default function AutoWatchRecommendationsPanel({ compact = false }) {
  const { tr, locale } = useLanguage();
  const [available, setAvailable] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [autoManagedCount, setAutoManagedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sportToAdd, setSportToAdd] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sportOptions = useMemo(() => SPORTS.flatMap((group) => group.leagues.map((league) => ({ key: league.key, label: `${group.label || group.sport || "Sport"} · ${league.title || league.name || league.key}` }))), []);
  const sportLabels = useMemo(() => new Map(sportOptions.map((item) => [item.key, item.label])), [sportOptions]);

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/cloud/auto-watch-recommendations", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setSignedOut(true);
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Auto-Watch unavailable");
      setSignedOut(false);
      setAvailable(payload.available !== false);
      setPreferences({ ...DEFAULTS, ...(payload.preferences || {}), sport_keys: Array.isArray(payload.preferences?.sport_keys) ? payload.preferences.sport_keys : [] });
      setAutoManagedCount(Number(payload.autoManagedCount || 0));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Auto-Watch unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(changes) {
    if (saving) return;
    const next = { ...preferences, ...changes };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/cloud/auto-watch-recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled === true,
          topN: Number(next.top_n || 3),
          alertMovePercent: Number(next.alert_move_percent || 0.03),
          alertBeforeMinutes: Number(next.alert_before_minutes || 120),
          selectionMode: next.selection_mode || "play-and-caution",
          minScore: Number(next.min_score || 0),
          minEdge: Number(next.min_edge || 0),
          minEv: Number(next.min_ev || 0),
          sportKeys: Array.isArray(next.sport_keys) ? next.sport_keys : []
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Auto-Watch update failed");
      setPreferences({ ...DEFAULTS, ...(payload.preferences || next), sport_keys: Array.isArray(payload.preferences?.sport_keys) ? payload.preferences.sport_keys : next.sport_keys || [] });
      const sync = payload.sync || {};
      const managedAfterSync = Number(sync.retainedAuto || 0) + Number(sync.inserted || 0);
      setAutoManagedCount(next.enabled ? managedAfterSync : 0);
      setMessage(payload.warning || (next.enabled
        ? tr({
            fi: `Auto-Watch V2 on käytössä. Suodattimet synkattiin heti ja palvelin jatkaa valvontaa 15 minuutin syklillä.`,
            en: `Auto-Watch V2 is active. Filters were synchronized immediately and the server will continue on a 15-minute cycle.`,
            es: `Auto-Watch V2 está activo. Los filtros se sincronizaron y el servidor continuará cada 15 minutos.`
          })
        : tr({
            fi: "Auto-Watch poistettiin käytöstä ja vain sen automaattisesti hallitsemat seurantarivit poistettiin.",
            en: "Auto-Watch was disabled and only its automatically managed watchlist rows were removed.",
            es: "Auto-Watch se desactivó y solo se eliminaron sus filas gestionadas automáticamente."
          })));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Auto-Watch update failed");
    } finally {
      setSaving(false);
    }
  }

  function addSport() {
    if (!sportToAdd) return;
    setPreferences((current) => ({ ...current, sport_keys: [...new Set([...(current.sport_keys || []), sportToAdd])].slice(0, 20) }));
    setSportToAdd("");
  }

  function removeSport(key) {
    setPreferences((current) => ({ ...current, sport_keys: (current.sport_keys || []).filter((item) => item !== key) }));
  }

  const lastRun = preferences.last_completed_at
    ? new Date(preferences.last_completed_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "–";
  const workerStatus = String(preferences.last_status || "idle").toUpperCase();
  const filterSummary = `${preferences.selection_mode === "play-only" ? "PLAY only" : "PLAY + CAUTION"} · score ≥${Number(preferences.min_score || 0).toFixed(0)} · edge ≥${percentInput(preferences.min_edge)}% · EV ≥${percentInput(preferences.min_ev)}%`;

  if (loading) {
    return <section className={`${compact ? "h-32" : "h-64"} animate-pulse rounded-[1.6rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]`} />;
  }

  if (signedOut) {
    return (
      <section className="rounded-[1.6rem] border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Auto-Watch Recommendations V2</div>
        <h2 className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Valvo Scorecasterin kärkikohteita omilla suodattimilla", en: "Automatically monitor Scorecaster picks with your filters", es: "Supervisa automáticamente con tus filtros" })}</h2>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Kirjautuminen tarvitaan, koska seuranta, suodattimet ja hälytykset ovat käyttäjäkohtaisia.", en: "Sign-in is required because monitoring, filters and alerts are user-specific.", es: "Debes iniciar sesión porque el seguimiento y los filtros son personales." })}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/login" className="sc-button-primary">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>{compact && <Link href="/auto-watch" className="sc-button-secondary">{tr({ fi: "Miten Auto-Watch toimii", en: "How Auto-Watch works", es: "Cómo funciona" })}</Link>}</div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.6rem] border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-6" data-auto-watch-recommendations="v2">
      <div className={`grid gap-5 ${compact ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" : "lg:grid-cols-[minmax(0,1fr)_430px]"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Auto-Watch Recommendations V2</div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.13em] ${preferences.enabled ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"}`}>{preferences.enabled ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "POIS", en: "OFF", es: "OFF" })}</span></div>
          <h2 className="mt-2 text-xl font-black text-[var(--sc-text)] sm:text-2xl">{tr({ fi: `Valvo automaattisesti enintään Top ${preferences.top_n}`, en: `Automatically monitor up to Top ${preferences.top_n}`, es: `Supervisa automáticamente hasta Top ${preferences.top_n}` })}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Auto-Watch suodattaa Recommendation Enginen valmiit PLAY/CAUTION-päätökset. Se ei koskaan tee omaa PLAY-upgradea. Ranking-vaihto saa muuttaa vain auto-managed-rivejä; manuaaliset Watchlist-kohteet säilyvät.", en: "Auto-Watch filters completed PLAY/CAUTION decisions from Recommendation Engine. It can never create its own PLAY upgrade. Ranking rotation changes only auto-managed rows; manual Watchlist items remain untouched.", es: "Auto-Watch filtra decisiones PLAY/CAUTION ya finalizadas y nunca crea un upgrade PLAY. Solo modifica filas automáticas." })}</p>
          <div className="mt-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--sc-text-secondary)]">{filterSummary}{preferences.sport_keys?.length ? ` · ${preferences.sport_keys.length} sport filters` : ` · ${tr({ fi: "kaikki lajit", en: "all sports", es: "todos los deportes" })}`}</div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-[var(--sc-muted)]"><span>Auto-managed: {autoManagedCount}</span><span>·</span><span>{tr({ fi: "Viimeisin ajo", en: "Last run", es: "Última ejecución" })}: {lastRun}</span><span>·</span><span>Worker: {workerStatus}</span><span>·</span><span>15 min</span><span>·</span><span>paper-only</span></div>
          {message && <div className="mt-3 text-sm font-bold text-emerald-300">{message}</div>}{preferences.last_error && !message && <div className="mt-3 text-xs font-bold text-amber-200">{preferences.last_error}</div>}{error && <div className="mt-3 text-sm font-bold text-rose-300">{error}</div>}{!available && <div className="mt-3 text-sm font-bold text-amber-200">{tr({ fi: "Auto-Watch-tietokantarekisteri ei ole vielä käytettävissä.", en: "The Auto-Watch database registry is not available yet.", es: "El registro aún no está disponible." })}</div>}
        </div>

        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">Top N<select value={preferences.top_n} onChange={(event) => setPreferences((current) => ({ ...current, top_n: Number(event.target.value) }))} disabled={saving} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]"><option value={1}>Top 1</option><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Päätökset", en: "Decisions", es: "Decisiones" })}<select value={preferences.selection_mode} onChange={(event) => setPreferences((current) => ({ ...current, selection_mode: event.target.value }))} disabled={saving} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]"><option value="play-and-caution">PLAY + CAUTION</option><option value="play-only">PLAY only</option></select></label>
          </div>

          {!compact && <>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <label className="text-xs font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]">Min score<input type="number" min="0" max="100" step="1" value={preferences.min_score} onChange={(event) => setPreferences((current) => ({ ...current, min_score: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]" /></label>
              <label className="text-xs font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]">Min edge %<input type="number" min="0" max="20" step="0.5" value={percentInput(preferences.min_edge)} onChange={(event) => setPreferences((current) => ({ ...current, min_edge: Number(event.target.value) / 100 }))} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]" /></label>
              <label className="text-xs font-black uppercase tracking-[0.1em] text-[var(--sc-faint)]">Min EV %<input type="number" min="0" max="100" step="0.5" value={percentInput(preferences.min_ev)} onChange={(event) => setPreferences((current) => ({ ...current, min_ev: Number(event.target.value) / 100 }))} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]" /></label>
            </div>

            <div className="mt-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Lajit / liigat", en: "Sports / leagues", es: "Deportes / ligas" })}</div><div className="mt-2 flex gap-2"><select value={sportToAdd} onChange={(event) => setSportToAdd(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 text-sm font-bold text-[var(--sc-text)]"><option value="">{tr({ fi: "Kaikki, ellei rajata", en: "All unless filtered", es: "Todos salvo filtro" })}</option>{sportOptions.filter((item) => !(preferences.sport_keys || []).includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button type="button" onClick={addSport} disabled={!sportToAdd} className="sc-button-secondary disabled:opacity-40">+</button></div>{preferences.sport_keys?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{preferences.sport_keys.map((key) => <button type="button" key={key} onClick={() => removeSport(key)} className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-[10px] font-black text-cyan-200" title={tr({ fi: "Poista suodatin", en: "Remove filter", es: "Quitar filtro" })}>{sportLabels.get(key) || key} ×</button>)}</div>}</div>

            <details className="mt-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{tr({ fi: "Hälytysrajat", en: "Alert thresholds", es: "Límites de alerta" })}</summary><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-black text-[var(--sc-faint)]">{tr({ fi: "Hintaliike %", en: "Price move %", es: "Movimiento %" })}<input type="number" min="0.5" max="50" step="0.5" value={percentInput(preferences.alert_move_percent, 0.03)} onChange={(event) => setPreferences((current) => ({ ...current, alert_move_percent: Number(event.target.value) / 100 }))} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 text-sm font-black text-[var(--sc-text)]" /></label><label className="text-xs font-black text-[var(--sc-faint)]">{tr({ fi: "Ennen alkua min", en: "Before kickoff min", es: "Antes del inicio min" })}<input type="number" min="15" max="10080" step="15" value={preferences.alert_before_minutes} onChange={(event) => setPreferences((current) => ({ ...current, alert_before_minutes: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 text-sm font-black text-[var(--sc-text)]" /></label></div></details>
          </>}

          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={saving || !available} onClick={() => void save({ enabled: !preferences.enabled })} className={preferences.enabled ? "sc-button-secondary disabled:opacity-50" : "sc-button-primary disabled:opacity-50"}>{saving ? tr({ fi: "Synkataan…", en: "Syncing…", es: "Sincronizando…" }) : preferences.enabled ? tr({ fi: "Poista Auto-Watch", en: "Disable Auto-Watch", es: "Desactivar" }) : tr({ fi: "Ota Auto-Watch V2 käyttöön", en: "Enable Auto-Watch V2", es: "Activar Auto-Watch V2" })}</button>{preferences.enabled && <button type="button" disabled={saving} onClick={() => void save({ enabled: true })} className="sc-button-secondary disabled:opacity-50">{tr({ fi: "Tallenna ja synkkaa nyt", en: "Save & sync now", es: "Guardar y sincronizar" })}</button>}{compact && <Link href="/auto-watch" className="sc-button-secondary">{tr({ fi: "Asetukset", en: "Settings", es: "Ajustes" })}</Link>}</div>
          {!compact && <div className="mt-3 flex flex-wrap gap-3 text-xs font-black"><Link href="/watchlist" className="text-[var(--sc-brand)] hover:underline">Watchlist</Link><Link href="/alerts" className="text-[var(--sc-brand)] hover:underline">Alert Inbox</Link><Link href="/recommendations" className="text-[var(--sc-brand)] hover:underline">Recommendations</Link></div>}
        </div>
      </div>
    </section>
  );
}
