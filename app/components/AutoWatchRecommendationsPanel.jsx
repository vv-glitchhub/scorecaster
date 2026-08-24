"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

const DEFAULTS = {
  enabled: false,
  top_n: 3,
  alert_move_percent: 0.03,
  alert_before_minutes: 120,
  last_completed_at: null,
  last_status: "idle",
  last_error: null,
  last_synced_count: 0,
  last_removed_count: 0
};

function percentInput(value) {
  return Math.round(Number(value || 0.03) * 1000) / 10;
}

export default function AutoWatchRecommendationsPanel({ compact = false }) {
  const { tr, locale } = useLanguage();
  const [available, setAvailable] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [autoManagedCount, setAutoManagedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setPreferences({ ...DEFAULTS, ...(payload.preferences || {}) });
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
          alertBeforeMinutes: Number(next.alert_before_minutes || 120)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Auto-Watch update failed");
      setPreferences({ ...DEFAULTS, ...(payload.preferences || next) });
      const sync = payload.sync || {};
      const managedAfterSync = Number(sync.retainedAuto || 0) + Number(sync.inserted || 0);
      setAutoManagedCount(next.enabled ? managedAfterSync : 0);
      setMessage(payload.warning || (next.enabled
        ? tr({
            fi: `Auto-Watch on käytössä. Nykyinen Top ${next.top_n} synkattiin ja palvelin jatkaa valvontaa 15 minuutin syklillä.`,
            en: `Auto-Watch is active. The current Top ${next.top_n} was synchronized and the server will continue on a 15-minute cycle.`,
            es: `Auto-Watch está activo. El Top ${next.top_n} actual se sincronizó y el servidor continuará cada 15 minutos.`
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

  const lastRun = preferences.last_completed_at
    ? new Date(preferences.last_completed_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "–";
  const workerStatus = String(preferences.last_status || "idle").toUpperCase();

  if (loading) {
    return <section className={`${compact ? "h-32" : "h-64"} animate-pulse rounded-[1.6rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]`} />;
  }

  if (signedOut) {
    return (
      <section className="rounded-[1.6rem] border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Auto-Watch Recommendations V1</div>
        <h2 className="mt-2 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Valvo Scorecasterin Top 3:a automaattisesti", en: "Automatically monitor Scorecaster's Top 3", es: "Supervisa automáticamente el Top 3 de Scorecaster" })}</h2>
        <p className="mt-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Kirjautuminen tarvitaan, koska seuranta ja hälytykset ovat käyttäjäkohtaisia.", en: "Sign-in is required because watchlists and alerts are user-specific.", es: "Debes iniciar sesión porque el seguimiento y las alertas son personales." })}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login" className="sc-button-primary">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>
          {compact && <Link href="/auto-watch" className="sc-button-secondary">{tr({ fi: "Miten Auto-Watch toimii", en: "How Auto-Watch works", es: "Cómo funciona Auto-Watch" })}</Link>}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.6rem] border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-6" data-auto-watch-recommendations="v1">
      <div className={`grid gap-5 ${compact ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" : "lg:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Auto-Watch Recommendations V1</div>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.13em] ${preferences.enabled ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-muted)]"}`}>
              {preferences.enabled ? tr({ fi: "AKTIIVINEN", en: "ACTIVE", es: "ACTIVO" }) : tr({ fi: "POIS", en: "OFF", es: "OFF" })}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black text-[var(--sc-text)] sm:text-2xl">
            {tr({ fi: `Valvo Top ${preferences.top_n}:a ilman käsin lisäämistä`, en: `Monitor Top ${preferences.top_n} without adding picks manually`, es: `Supervisa el Top ${preferences.top_n} sin añadir selecciones manualmente` })}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Scorecaster synkkaa nykyiset PLAY/CAUTION-kärkisuositukset omaan seurantalistaasi. Kun ranking vaihtuu, vanha auto-managed-rivi poistuu ja uusi tulee tilalle. Manuaalisia seurantoja ei koskaan poisteta. Hälytykset kulkevat nykyisen Alert Inboxin ja 🔔-kellon kautta.",
              en: "Scorecaster syncs the leading PLAY/CAUTION recommendations into your private watchlist. When the ranking changes, old auto-managed rows are replaced while manual watch items are never removed. Alerts flow through the existing Alert Inbox and bell.",
              es: "Scorecaster sincroniza las principales recomendaciones PLAY/CAUTION en tu lista privada. Al cambiar el ranking, reemplaza solo filas automáticas y nunca elimina seguimientos manuales. Las alertas usan el buzón y la campana existentes."
            })}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-[var(--sc-muted)]">
            <span>{tr({ fi: "Auto-managed", en: "Auto-managed", es: "Auto-managed" })}: {autoManagedCount}</span>
            <span>·</span>
            <span>{tr({ fi: "Viimeisin ajo", en: "Last run", es: "Última ejecución" })}: {lastRun}</span>
            <span>·</span>
            <span>{tr({ fi: "Worker", en: "Worker", es: "Worker" })}: {workerStatus}</span>
            <span>·</span>
            <span>{tr({ fi: "Taustasykli", en: "Background cycle", es: "Ciclo" })}: 15 min</span>
            <span>·</span>
            <span>paper-only</span>
          </div>
          {message && <div className="mt-3 text-sm font-bold text-emerald-300">{message}</div>}
          {preferences.last_error && !message && <div className="mt-3 text-xs font-bold text-amber-200">{preferences.last_error}</div>}
          {error && <div className="mt-3 text-sm font-bold text-rose-300">{error}</div>}
          {!available && <div className="mt-3 text-sm font-bold text-amber-200">{tr({ fi: "Auto-Watch-tietokantarekisteri ei ole vielä käytettävissä.", en: "The Auto-Watch database registry is not available yet.", es: "El registro de Auto-Watch aún no está disponible." })}</div>}
        </div>

        <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4">
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">
            {tr({ fi: "Kuinka monta kärkikohdetta", en: "How many top picks", es: "Cuántas selecciones" })}
            <select
              value={preferences.top_n}
              onChange={(event) => setPreferences((current) => ({ ...current, top_n: Number(event.target.value) }))}
              disabled={saving}
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]"
            >
              <option value={1}>Top 1</option>
              <option value={2}>Top 2</option>
              <option value={3}>Top 3</option>
            </select>
          </label>

          {!compact && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
                {tr({ fi: "Hintaliike %", en: "Price move %", es: "Movimiento %" })}
                <input
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={percentInput(preferences.alert_move_percent)}
                  onChange={(event) => setPreferences((current) => ({ ...current, alert_move_percent: Number(event.target.value) / 100 }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">
                {tr({ fi: "Ennen alkua min", en: "Before kickoff min", es: "Antes del inicio min" })}
                <input
                  type="number"
                  min="15"
                  max="10080"
                  step="15"
                  value={preferences.alert_before_minutes}
                  onChange={(event) => setPreferences((current) => ({ ...current, alert_before_minutes: Number(event.target.value) }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 text-sm font-black text-[var(--sc-text)]"
                />
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !available}
              onClick={() => void save({ enabled: !preferences.enabled })}
              className={preferences.enabled ? "sc-button-secondary disabled:opacity-50" : "sc-button-primary disabled:opacity-50"}
            >
              {saving
                ? tr({ fi: "Synkataan…", en: "Syncing…", es: "Sincronizando…" })
                : preferences.enabled
                  ? tr({ fi: "Poista Auto-Watch", en: "Disable Auto-Watch", es: "Desactivar Auto-Watch" })
                  : tr({ fi: `Ota Top ${preferences.top_n} Auto-Watch käyttöön`, en: `Enable Top ${preferences.top_n} Auto-Watch`, es: `Activar Auto-Watch Top ${preferences.top_n}` })}
            </button>
            {preferences.enabled && (
              <button type="button" disabled={saving} onClick={() => void save({ enabled: true })} className="sc-button-secondary disabled:opacity-50">
                {tr({ fi: "Tallenna ja synkkaa nyt", en: "Save & sync now", es: "Guardar y sincronizar" })}
              </button>
            )}
            {compact && <Link href="/auto-watch" className="sc-button-secondary">{tr({ fi: "Asetukset", en: "Settings", es: "Ajustes" })}</Link>}
          </div>
          {!compact && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-black">
              <Link href="/watchlist" className="text-[var(--sc-brand)] hover:underline">{tr({ fi: "Seurantalista", en: "Watchlist", es: "Seguimiento" })}</Link>
              <Link href="/alerts" className="text-[var(--sc-brand)] hover:underline">Alert Inbox</Link>
              <Link href="/recommendations" className="text-[var(--sc-brand)] hover:underline">{tr({ fi: "Suositukset", en: "Recommendations", es: "Recomendaciones" })}</Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
