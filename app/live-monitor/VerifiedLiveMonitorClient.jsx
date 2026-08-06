"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const clock = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "–";
  const minutes = Math.floor(Math.max(0, value) / 60);
  const remainder = Math.floor(Math.max(0, value) % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};
const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
const time = (value, locale) => value ? new Date(value).toLocaleString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "numeric", month: "short" }) : "–";

function Metric({ label, value, hint, tone = "default" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "warning" ? "text-amber-200" : tone === "bad" ? "text-rose-300" : "text-[var(--sc-text)]";
  return <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{label}</div><div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>{hint && <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{hint}</div>}</div>;
}

function AlertCard({ alert, locale }) {
  const tone = alert.severity === "high" ? "border-rose-400/25 bg-rose-400/10" : alert.severity === "medium" ? "border-amber-400/25 bg-amber-400/10" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]";
  return <article className={`rounded-[1.3rem] border p-5 ${tone}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{alert.severity} · {alert.id || alert.alert_type}</div><div className="text-xs text-[var(--sc-muted)]">{time(alert.generatedAt || alert.last_seen_at, locale)}</div></div><h3 className="mt-2 text-lg font-black text-[var(--sc-text)]">{alert.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--sc-text-secondary)]">{alert.message}</p><div className="mt-3 text-xs text-[var(--sc-muted)]">providers: {(alert.providers || alert.evidence?.alert?.providers || []).join(", ") || "–"} · informational-paper-only</div></article>;
}

export default function VerifiedLiveMonitorClient() {
  const { tr, locale } = useLanguage();
  const [eventId, setEventId] = useState("");
  const [monitor, setMonitor] = useState(null);
  const [cloud, setCloud] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState({ enabled: true, alertsEnabled: true, quietStart: "", quietEnd: "", maxAlertsPerHour: 3, minimumProbabilityMove: 0.05 });

  const readCloud = useCallback(async (selectedEventId = "") => {
    const query = new URLSearchParams();
    if (selectedEventId) query.set("eventId", selectedEventId);
    const response = await fetch(`/api/cloud/verified-live-monitor?${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status)) return null;
      throw new Error(payload?.error || "Live alert inbox unavailable");
    }
    const values = payload.preferences?.values || {};
    setSettings({
      enabled: values.enabled !== false,
      alertsEnabled: values.alerts_enabled !== false,
      quietStart: values.quiet_start ? String(values.quiet_start).slice(0, 5) : "",
      quietEnd: values.quiet_end ? String(values.quiet_end).slice(0, 5) : "",
      maxAlertsPerHour: Number(values.max_alerts_per_hour ?? 3),
      minimumProbabilityMove: Number(values.minimum_probability_move ?? 0.05)
    });
    setCloud(payload);
    return payload;
  }, []);

  const loadMonitor = useCallback(async (selectedEventId = eventId) => {
    const clean = String(selectedEventId || "").trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/verified-live-monitor?eventId=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Verified live evidence unavailable");
      setMonitor(payload);
      await readCloud(clean);
    } catch (loadError) {
      setMonitor(null);
      setError(loadError instanceof Error ? loadError.message : "Verified live evidence unavailable");
    } finally { setLoading(false); }
  }, [eventId, readCloud]);

  useEffect(() => {
    fetch("/api/verified-live-monitor/health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => setHealth(null));
    void readCloud();
  }, [readCloud]);

  async function saveSettings() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/cloud/verified-live-monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preference: true, settings })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Settings could not be saved");
      setMessage(tr({ fi: "Live Monitor -asetukset tallennettiin.", en: "Live Monitor settings were saved.", es: "Se guardaron los ajustes." }));
      await readCloud(eventId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Settings could not be saved");
    } finally { setSaving(false); }
  }

  async function markAlert(id, resolved = false) {
    const response = await fetch("/api/cloud/verified-live-monitor", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true, resolved }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Alert could not be updated");
    await readCloud(eventId);
  }

  const probabilityEntries = useMemo(() => Object.entries(monitor?.liveProbability?.probabilities || {}), [monitor]);
  const current = monitor?.current || null;

  return <div className="space-y-7">
    <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Verified Live Monitor V1 · paper-only</div>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{tr({ fi: "Varmennettu live-tila ilman vedonlyöntiohjausta", en: "Verified live state without betting instructions", es: "Estado en vivo verificado sin instrucciones de apuesta" })}</h1>
      <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "Seuraa tulosta, aikaa, erää, provider-viivettä, ristiriitoja ja näkyviä korjauksia. Live-todennäköisyys on erotettu pre-match-auditista, eikä näkymä ehdota panosta tai oikean rahan toimintaa.", en: "Monitor score, clock, period, provider delay, conflicts and visible corrections. Live probability stays separate from the pre-match audit and never suggests a stake or real-money action.", es: "Supervisa marcador, reloj, retrasos y conflictos sin sugerir importes." })}</p>
      <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">stakeSuggested=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">preMatchModelChanged=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">realMoneyExecution=false</span></div>
    </section>

    {health && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">Pipeline: <strong className="text-[var(--sc-text)]">{health.status}</strong> · snapshots 24h {health.last24Hours?.snapshots ?? 0} · alerts 24h {health.last24Hours?.alerts ?? 0} · provider {health.provider?.configured ? "configured" : "unconfigured"}</div>}
    {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}
    {message && <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-200">{message}</div>}

    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row"><label className="flex-1 text-sm font-bold text-[var(--sc-text-secondary)]">Event ID<input value={eventId} onChange={(event) => setEventId(event.target.value)} placeholder="provider event id" className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label><button type="button" onClick={() => void loadMonitor()} disabled={loading || !eventId.trim()} className="sc-button-primary self-end disabled:opacity-40">{loading ? tr({ fi: "Varmennetaan…", en: "Verifying…", es: "Verificando…" }) : tr({ fi: "Avaa live-audit", en: "Open live audit", es: "Abrir auditoría" })}</button></div>
      <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Event ID löytyy Scorecasterin ottelusivun osoitteesta tai seurantalistan auditista.", en: "The event ID is available in the Scorecaster event URL or watchlist audit.", es: "El ID aparece en la URL del evento." })}</p>
    </section>

    {monitor && <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Status" value={monitor.status} tone={monitor.suspended ? "bad" : "good"} hint={monitor.suspensionReason || "provider-majority verified"} /><Metric label="Score" value={current ? `${current.homeScore}–${current.awayScore}` : "–"} /><Metric label="Period / clock" value={current ? `${current.period ?? "–"} · ${clock(current.clockSeconds)}` : "–"} hint={current?.clockDirection || "unknown"} /><Metric label="Fresh providers" value={monitor.integrity?.freshProviderCount ?? 0} hint={`${monitor.integrity?.usableProviderCount ?? 0} usable`} /></section>

      {probabilityEntries.length > 0 && <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Live-only probability</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">Provider consensus</h2></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">not a pre-match feature</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{probabilityEntries.map(([label, value]) => <Metric key={label} label={label} value={pct(value)} />)}</div></section>}

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Varmennetut live-hälytykset", en: "Verified live alerts", es: "Alertas verificadas" })}</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{(monitor.alerts || []).map((alert) => <AlertCard key={`${alert.id}:${alert.generatedAt}`} alert={alert} locale={locale} />)}{!monitor.alerts?.length && <div className="text-sm text-[var(--sc-muted)]">No verified alert changes.</div>}</div></section>

      <section className="grid gap-4 lg:grid-cols-2"><div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-xl font-black text-[var(--sc-text)]">Providers</h2><div className="mt-4 space-y-3">{(monitor.providers || []).map((provider) => <div key={provider.providerId} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-[var(--sc-text)]">{provider.providerId}</strong><span className="text-xs text-[var(--sc-muted)]">{provider.freshness}</span></div><div className="mt-2 text-sm text-[var(--sc-text-secondary)]">{provider.status} · {provider.homeScore}–{provider.awayScore} · period {provider.period ?? "–"} · {clock(provider.clockSeconds)}</div><div className="mt-1 text-xs text-[var(--sc-faint)]">updated {time(provider.providerUpdatedAt, locale)} · age {provider.freshnessSeconds ?? "–"}s</div></div>)}</div></div><div className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><h2 className="text-xl font-black text-[var(--sc-text)]">Integrity</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Rejected" value={monitor.rejected?.length || 0} /><Metric label="Regressions" value={monitor.integrity?.regressions?.length || 0} /><Metric label="Corrections" value={monitor.integrity?.corrections?.length || 0} /><Metric label="Conflict" value={monitor.integrity?.providerConflict ? "yes" : "no"} tone={monitor.integrity?.providerConflict ? "bad" : "good"} /></div></div></section>

      <details className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><summary className="cursor-pointer list-none text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Live-aikajana ja näkyvät korjaukset", en: "Live timeline and visible corrections", es: "Cronología y correcciones" })}</summary><div className="mt-4 space-y-3">{(monitor.timeline || []).map((row) => <div key={row.id} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[var(--sc-text)]">{row.providerId} · {row.status}</strong><span className="text-xs text-[var(--sc-muted)]">{time(row.observedAt, locale)}</span></div><div className="mt-2 text-sm text-[var(--sc-text-secondary)]">{row.homeScore}–{row.awayScore} · period {row.period ?? "–"} · {clock(row.clockSeconds)} · {row.freshness}</div>{row.correction && <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">Correction: {row.correctionReason} · supersedes {row.supersedesId}</div>}</div>)}</div></details>
    </>}

    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Authenticated alert controls</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Omat live-hälytykset", en: "My live alerts", es: "Mis alertas" })}</h2></div>{!cloud && <Link href="/login" className="sc-button-secondary">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>{cloud && <><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="flex items-center gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} />Monitor enabled</label><label className="flex items-center gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={settings.alertsEnabled} onChange={(event) => setSettings((current) => ({ ...current, alertsEnabled: event.target.checked }))} />Alerts enabled</label><label className="text-sm font-bold text-[var(--sc-text-secondary)]">Max alerts / hour<input type="number" min="0" max="6" value={settings.maxAlertsPerHour} onChange={(event) => setSettings((current) => ({ ...current, maxAlertsPerHour: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label><label className="text-sm font-bold text-[var(--sc-text-secondary)]">Quiet start UTC<input type="time" value={settings.quietStart} onChange={(event) => setSettings((current) => ({ ...current, quietStart: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label><label className="text-sm font-bold text-[var(--sc-text-secondary)]">Quiet end UTC<input type="time" value={settings.quietEnd} onChange={(event) => setSettings((current) => ({ ...current, quietEnd: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label><label className="text-sm font-bold text-[var(--sc-text-secondary)]">Minimum probability move<input type="number" min="0.01" max="0.25" step="0.01" value={settings.minimumProbabilityMove} onChange={(event) => setSettings((current) => ({ ...current, minimumProbabilityMove: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label></div><button type="button" onClick={() => void saveSettings()} disabled={saving || !cloud.preferences?.available} className="sc-button-primary mt-5 disabled:opacity-40">{saving ? "Saving…" : "Save live alert settings"}</button><div className="mt-6 grid gap-4 lg:grid-cols-2">{(cloud.alerts || []).map((alert) => <div key={alert.id} className="space-y-3"><AlertCard alert={alert} locale={locale} /><div className="flex gap-2"><button type="button" onClick={() => void markAlert(alert.id, false)} className="sc-button-secondary">Mark read</button><button type="button" onClick={() => void markAlert(alert.id, true)} className="sc-button-secondary">Resolve</button></div></div>)}</div></>}</section>

    <div className="flex flex-wrap gap-3"><Link href="/events" className="sc-button-secondary">Events</Link><Link href="/market-microstructure" className="sc-button-secondary">Market Microstructure</Link><a href={eventId ? `/api/verified-live-monitor?eventId=${encodeURIComponent(eventId)}` : "/api/verified-live-monitor/health"} className="sc-button-primary">Audit JSON</a></div>
  </div>;
}
