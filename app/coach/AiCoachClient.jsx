"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(digits)} %` : "–";
const decimal = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const money = (value, locale) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value)) : "–";
const timeValue = (value) => value ? String(value).slice(0, 5) : "";

function Metric({ label, value, hint, tone = "default" }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warning" ? "text-amber-200" : tone === "bad" ? "text-rose-300" : "text-[var(--sc-text)]";
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{label}</div>
      <div className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{hint}</div>}
    </div>
  );
}

function SampleBadge({ value, tr }) {
  const label = value === "usable"
    ? tr({ fi: "Käyttökelpoinen otos", en: "Usable sample", es: "Muestra utilizable" })
    : value === "provisional"
      ? tr({ fi: "Alustava havainto", en: "Provisional finding", es: "Hallazgo provisional" })
      : tr({ fi: "Liian pieni otos", en: "Insufficient sample", es: "Muestra insuficiente" });
  return <span className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1.5 text-xs font-black text-[var(--sc-text-secondary)]">{label}</span>;
}

function InsightCard({ item, tr }) {
  const tone = item.tone === "strength"
    ? "border-emerald-400/25 bg-emerald-400/10"
    : item.tone === "caution"
      ? "border-amber-400/25 bg-amber-400/10"
      : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]";
  return (
    <article className={`rounded-[1.35rem] border p-5 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{item.tone}</div>
        <SampleBadge value={item.confidence} tr={tr} />
      </div>
      <h3 className="mt-3 text-xl font-black text-[var(--sc-text)]">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--sc-text-secondary)]">{item.message}</p>
      <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)]/35 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-faint)]">{tr({ fi: "Prosessitoimi", en: "Process action", es: "Acción de proceso" })}</div>
        <div className="mt-1 text-sm font-bold leading-6 text-[var(--sc-text)]">{item.action}</div>
      </div>
      {item.denominator !== null && <div className="mt-3 text-xs text-[var(--sc-muted)]">Evidence {item.numerator ?? 0}/{item.denominator} · modelChange=false · automaticStakeChange=false</div>}
    </article>
  );
}

function SliceTable({ title, rows = [], tr }) {
  return (
    <details className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <summary className="cursor-pointer list-none text-xl font-black text-[var(--sc-text)]">{title}</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[var(--sc-faint)]"><tr><th className="px-2 py-2">Slice</th><th className="px-2 py-2">n</th><th className="px-2 py-2">CLV</th><th className="px-2 py-2">Brier</th><th className="px-2 py-2">Yield</th><th className="px-2 py-2">Status</th></tr></thead>
          <tbody>{rows.slice(0, 30).map((row) => <tr key={`${row.dimension}:${row.value}`} className="border-t border-[var(--sc-border)] text-[var(--sc-text-secondary)]"><td className="px-2 py-3 font-black text-[var(--sc-text)]">{row.value}</td><td className="px-2 py-3">{row.eligible}</td><td className="px-2 py-3">{pct(row.meanPriceClv)}</td><td className="px-2 py-3">{decimal(row.meanBrier)}</td><td className="px-2 py-3">{pct(row.paperYield)}</td><td className="px-2 py-3">{row.sampleState}</td></tr>)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei riittävää evidenssiä.", en: "No sufficient evidence.", es: "Sin evidencia suficiente." })}</div>}
    </details>
  );
}

export default function AiCoachClient() {
  const { tr, locale } = useLanguage();
  const [days, setDays] = useState("365");
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    enabled: true,
    notificationsEnabled: false,
    quietStart: "",
    quietEnd: "",
    maxNotificationsPerWeek: 2,
    minimumSample: 20
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai-coach?days=${encodeURIComponent(days)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "AI Coach unavailable");
      setData(payload);
      const values = payload.preferences?.values || {};
      setForm({
        enabled: values.enabled !== false,
        notificationsEnabled: values.notifications_enabled === true,
        quietStart: timeValue(values.quiet_start),
        quietEnd: timeValue(values.quiet_end),
        maxNotificationsPerWeek: Number(values.max_notifications_per_week ?? 2),
        minimumSample: Number(values.minimum_sample ?? 20)
      });
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "AI Coach unavailable");
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/ai-coach/health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  async function savePreferences() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ai-coach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Preferences could not be saved");
      setMessage(tr({ fi: "AI Coach -asetukset tallennettiin.", en: "AI Coach settings were saved.", es: "Se guardaron los ajustes de AI Coach." }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Preferences could not be saved");
    } finally { setSaving(false); }
  }

  const report = data?.report || null;
  const overview = report?.overview || {};
  const exclusions = useMemo(() => Object.entries(report?.evidence?.exclusions || {}).sort((a, b) => b[1] - a[1]), [report]);

  return (
    <div className="space-y-7">
      <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">AI Coach V1 · paper-only</div>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{tr({ fi: "Paranna päätösprosessia, älä jahtaa tuloksia", en: "Improve the process, not chase outcomes", es: "Mejora el proceso, no persigas resultados" })}</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "AI Coach käyttää vain omaa paperihistoriaasi, varmennettua closing-evidenssiä ja näkyviä turvallisuuspäätöksiä. Se ei muuta mallia, päätöksiä tai panoksia eikä kehota tappioiden jahtaamiseen.", en: "AI Coach uses only your own paper history, verified closing evidence and visible safety decisions. It cannot change models, decisions or stakes and never recommends loss chasing.", es: "AI Coach usa solo tu historial simulado y evidencia verificada; no cambia modelos ni importes." })}</p>
        <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">own records only</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">automaticStakeChange=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">profitGuarantee=false</span></div>
      </section>

      {health && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">Pipeline: <strong className="text-[var(--sc-text)]">{health.status}</strong> · reports {health.reportRows ?? 0} · latest evidence {health.latestReport?.evidenceCount ?? 0}</div>}
      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-emerald-200">{message}</div>}

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Aikajakso", en: "Time window", es: "Periodo" })}<select value={days} onChange={(event) => setDays(event.target.value)} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]"><option value="90">90 days</option><option value="365">365 days</option><option value="730">730 days</option><option value="1825">5 years</option></select></label>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />{tr({ fi: "AI Coach käytössä", en: "AI Coach enabled", es: "AI Coach activado" })}</label>
            <label className="flex items-center gap-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={form.notificationsEnabled} onChange={(event) => setForm((current) => ({ ...current, notificationsEnabled: event.target.checked }))} />{tr({ fi: "Rajatut ilmoitukset", en: "Bounded notifications", es: "Notificaciones limitadas" })}</label>
            <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Hiljainen aika alkaa", en: "Quiet period starts", es: "Inicio silencioso" })}<input type="time" value={form.quietStart} onChange={(event) => setForm((current) => ({ ...current, quietStart: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label>
            <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Hiljainen aika päättyy", en: "Quiet period ends", es: "Fin silencioso" })}<input type="time" value={form.quietEnd} onChange={(event) => setForm((current) => ({ ...current, quietEnd: event.target.value }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label>
            <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Ilmoituksia viikossa enintään", en: "Maximum notifications per week", es: "Máximo semanal" })}<input type="number" min="0" max="7" value={form.maxNotificationsPerWeek} onChange={(event) => setForm((current) => ({ ...current, maxNotificationsPerWeek: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label>
            <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Vähimmäisotos vahvalle havainnolle", en: "Minimum sample for a strong finding", es: "Muestra mínima" })}<input type="number" min="10" max="500" value={form.minimumSample} onChange={(event) => setForm((current) => ({ ...current, minimumSample: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]" /></label>
          </div>
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void load()} disabled={loading} className="sc-button-secondary disabled:opacity-40">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä raportti", en: "Refresh report", es: "Actualizar informe" })}</button><button type="button" onClick={() => void savePreferences()} disabled={saving || !data?.preferences?.available} className="sc-button-primary disabled:opacity-40">{saving ? tr({ fi: "Tallennetaan…", en: "Saving…", es: "Guardando…" }) : tr({ fi: "Tallenna asetukset", en: "Save settings", es: "Guardar ajustes" })}</button></div>
        </div>
        {data?.preferences?.warning && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{data.preferences.warning}</div>}
      </section>

      {data?.enabled === false && <div className="rounded-[1.5rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 text-[var(--sc-text-secondary)]">{tr({ fi: "AI Coach on poistettu käytöstä. Asetus ei poista paperihistoriaasi.", en: "AI Coach is disabled. This setting does not delete your paper history.", es: "AI Coach está desactivado." })}</div>}

      {report && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={tr({ fi: "Kelvolliset havainnot", en: "Eligible observations", es: "Observaciones elegibles" })} value={overview.eligible || 0} hint={`${overview.excluded || 0} excluded`} />
            <Metric label="Price CLV" value={pct(overview.meanPriceClv)} tone={Number(overview.meanPriceClv) > 0 ? "good" : Number(overview.meanPriceClv) < 0 ? "bad" : "default"} />
            <Metric label="Paper yield" value={pct(overview.paperYield)} hint={`${money(overview.totalProfit, locale)} / ${money(overview.totalStake, locale)}`} />
            <Metric label={tr({ fi: "Maksimidrawdown", en: "Maximum drawdown", es: "Drawdown máximo" })} value={money(overview.maximumDrawdown, locale)} />
            <Metric label="Brier" value={decimal(overview.meanBrier)} hint={tr({ fi: "Pienempi on parempi", en: "Lower is better", es: "Menor es mejor" })} />
            <Metric label="Log loss" value={decimal(overview.meanLogLoss)} hint={tr({ fi: "Pienempi on parempi", en: "Lower is better", es: "Menor es mejor" })} />
            <Metric label={tr({ fi: "Osumaprosentti", en: "Hit rate", es: "Tasa de acierto" })} value={pct(overview.hitRate)} />
            <Metric label={tr({ fi: "Otoksen tila", en: "Sample status", es: "Estado de muestra" })} value={overview.sampleState || "insufficient"} />
          </section>

          <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Evidence-based coaching</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Prosessihavainnot", en: "Process findings", es: "Hallazgos de proceso" })}</h2></div><SampleBadge value={overview.sampleState} tr={tr} /></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">{report.insights.map((item) => <InsightCard key={item.id} item={item} tr={tr} />)}{report.insights.length === 0 && <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Vahvaa prosessihavaintoa ei vielä ole. Kerää lisää kronologista paperi- ja closing-evidenssiä.", en: "There is no strong process finding yet. Collect more chronological paper and closing evidence.", es: "Aún no hay un hallazgo fuerte." })}</div>}</div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SliceTable title={tr({ fi: "Lajit", en: "Sports", es: "Deportes" })} rows={report.slices.sport} tr={tr} />
            <SliceTable title={tr({ fi: "Sarjat", en: "Leagues", es: "Ligas" })} rows={report.slices.league} tr={tr} />
            <SliceTable title={tr({ fi: "Markkinat", en: "Markets", es: "Mercados" })} rows={report.slices.market} tr={tr} />
            <SliceTable title={tr({ fi: "Vedonvälittäjät", en: "Bookmakers", es: "Casas" })} rows={report.slices.bookmaker} tr={tr} />
            <SliceTable title={tr({ fi: "Kerroinalueet", en: "Odds ranges", es: "Rangos de cuota" })} rows={report.slices.oddsBand} tr={tr} />
            <SliceTable title={tr({ fi: "Päätösluokat", en: "Decision classes", es: "Clases de decisión" })} rows={report.slices.decision} tr={tr} />
          </section>

          <details className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
            <summary className="cursor-pointer list-none text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Evidenssi ja poissulkemiset", en: "Evidence and exclusions", es: "Evidencia y exclusiones" })}</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Received" value={report.evidence.observationsReceived} /><Metric label="Decision audit" value={report.evidence.decisionAuditRows} /><Metric label="Price-choice audit" value={report.evidence.priceChoiceRows} /></div>
            <div className="mt-4 space-y-2">{exclusions.map(([reason, count]) => <div key={reason} className="flex items-center justify-between rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm"><span className="text-[var(--sc-text-secondary)]">{reason}</span><strong className="text-[var(--sc-text)]">{count}</strong></div>)}{exclusions.length === 0 && <div className="text-sm text-[var(--sc-muted)]">No exclusions.</div>}</div>
          </details>

          <div className="flex flex-wrap gap-3"><Link href="/calibration" className="sc-button-secondary">CLV & Calibration</Link><Link href="/risk-lab" className="sc-button-secondary">Risk Lab</Link><Link href="/model-lab" className="sc-button-secondary">Model Lab</Link><a href="/api/ai-coach?includeAudit=1" className="sc-button-primary">Audit JSON</a></div>
        </>
      )}
    </div>
  );
}
