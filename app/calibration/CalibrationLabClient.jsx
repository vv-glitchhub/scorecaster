"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const pp = (value, digits = 1) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${(Number(value) * 100).toFixed(digits)} pp` : "–";
const decimal = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const money = (value, locale) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value)) : "–";

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

function SampleBadge({ status, tr }) {
  const level = status?.level || "insufficient";
  const label = level === "usable"
    ? tr({ fi: "Käyttökelpoinen otos", en: "Usable sample", es: "Muestra utilizable" })
    : level === "provisional"
      ? tr({ fi: "Alustava otos", en: "Provisional sample", es: "Muestra provisional" })
      : tr({ fi: "Liian pieni otos", en: "Insufficient sample", es: "Muestra insuficiente" });
  return <span className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1.5 text-xs font-black text-[var(--sc-text-secondary)]">{label} · {status?.count || 0}/{status?.minimumRequired || 0}</span>;
}

function ReliabilityBins({ bins = [], tr }) {
  const populated = bins.filter((bin) => bin.count > 0);
  return (
    <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Reliability</div><h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Kalibraatiokorit", en: "Calibration bins", es: "Intervalos de calibración" })}</h2></div>
        <span className="text-xs text-[var(--sc-muted)]">Wilson 95%</span>
      </div>
      {populated.length === 0 ? (
        <div className="mt-5 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ratkaistuja kelvollisia havaintoja ei ole vielä.", en: "No eligible settled observations yet.", es: "Aún no hay observaciones elegibles." })}</div>
      ) : (
        <div className="mt-5 space-y-3">
          {populated.map((bin) => (
            <div key={bin.index} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
              <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr_auto] sm:items-center">
                <div className="font-black text-[var(--sc-text)]">{Math.round(bin.lower * 100)}–{Math.round(bin.upper * 100)} %</div>
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Predicted</div><div className="font-black text-[var(--sc-text)]">{pct(bin.predicted)}</div></div>
                <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Observed</div><div className="font-black text-[var(--sc-text)]">{pct(bin.observed)}</div></div>
                <div className="text-xs text-[var(--sc-muted)]">n={bin.count} · gap {pp(bin.absoluteGap)}</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sc-border)]"><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width: `${Math.max(2, Math.min(100, Number(bin.observed || 0) * 100))}%` }} /></div>
              {bin.observedInterval && <div className="mt-2 text-xs text-[var(--sc-faint)]">95% CI {pct(bin.observedInterval.lower)} – {pct(bin.observedInterval.upper)}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SliceTable({ title, rows = [], tr }) {
  return (
    <details className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
      <summary className="cursor-pointer list-none text-xl font-black text-[var(--sc-text)]">{title}</summary>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[var(--sc-faint)]"><tr><th className="px-2 py-2">Slice</th><th className="px-2 py-2">n</th><th className="px-2 py-2">Price CLV</th><th className="px-2 py-2">Brier</th><th className="px-2 py-2">Log loss</th><th className="px-2 py-2">Yield</th><th className="px-2 py-2">Status</th></tr></thead>
          <tbody>{rows.slice(0, 50).map((row) => <tr key={row.name} className="border-t border-[var(--sc-border)] text-[var(--sc-text-secondary)]"><td className="px-2 py-3 font-black text-[var(--sc-text)]">{row.name}</td><td className="px-2 py-3">{row.count}</td><td className="px-2 py-3">{pct(row.averagePriceClv)}</td><td className="px-2 py-3">{decimal(row.brierScore)}</td><td className="px-2 py-3">{decimal(row.logLoss)}</td><td className="px-2 py-3">{pct(row.yield)}</td><td className="px-2 py-3">{row.sampleStatus?.level}</td></tr>)}</tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="mt-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei havaintoja.", en: "No observations.", es: "Sin observaciones." })}</div>}
    </details>
  );
}

export default function CalibrationLabClient() {
  const { tr, locale } = useLanguage();
  const [days, setDays] = useState("365");
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/calibration?days=${encodeURIComponent(days)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Calibration evidence unavailable");
      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "Calibration evidence unavailable");
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/calibration/health", { cache: "no-store" }).then((response) => response.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const overall = data?.overall || {};
  const exclusions = useMemo(() => Object.entries(data?.exclusions || {}).sort((left, right) => right[1] - left[1]), [data]);

  return (
    <div className="space-y-7">
      <section className="sc-hero rounded-[2rem] p-6 sm:p-9">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">CLV & Calibration Lab V1</div>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--sc-text)] sm:text-6xl">{tr({ fi: "Voittiko päätös closing-markkinan?", en: "Did the decision beat the closing market?", es: "¿La decisión superó al mercado de cierre?" })}</h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "Todellinen pre-start closing-evidenssi, CLV, Brier, log loss ja luotettavuuskäyrät erottavat päätösprosessin laadun lyhyen aikavälin voitoista. Simuloitua closing-linjaa ei käytetä.", en: "Real pre-start closing evidence, CLV, Brier score, log loss and reliability bins separate process quality from short-term wins. Simulated closing lines are never used.", es: "Evidencia real de cierre, CLV, Brier y log loss sin cierres simulados." })}</p>
        <div className="mt-5 flex flex-wrap gap-2"><SampleBadge status={overall.sampleStatus} tr={tr} /><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">automaticPromotion=false</span><span className="rounded-full border border-[var(--sc-border)] px-3 py-1.5 text-xs font-black text-[var(--sc-muted)]">paper-only</span></div>
      </section>

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Aikajakso", en: "Time window", es: "Periodo" })}<select value={days} onChange={(event) => setDays(event.target.value)} className="mt-2 block rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-[var(--sc-text)]"><option value="90">90 days</option><option value="365">365 days</option><option value="730">730 days</option><option value="1825">5 years</option></select></label>
          <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void load()} disabled={loading} className="sc-button-secondary disabled:opacity-40">{loading ? tr({ fi: "Ladataan…", en: "Loading…", es: "Cargando…" }) : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><a href={`/api/calibration?days=${days}&format=csv`} className="sc-button-primary">{tr({ fi: "Vie CSV", en: "Export CSV", es: "Exportar CSV" })}</a></div>
        </div>
      </section>

      {health && <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">Pipeline: <strong className="text-[var(--sc-text)]">{health.status}</strong> · eligible {health.eligibleObservationCount ?? 0} · excluded {health.exclusionCount ?? 0}</div>}
      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}

      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={tr({ fi: "Kelvolliset", en: "Eligible", es: "Elegibles" })} value={data.eligible || 0} hint={`${data.excluded || 0} excluded`} />
            <Metric label="Price CLV" value={pct(overall.averagePriceClv)} hint={`${pct(overall.positivePriceClvRate)} positive`} tone={Number(overall.averagePriceClv) > 0 ? "good" : Number(overall.averagePriceClv) < 0 ? "bad" : "default"} />
            <Metric label="Probability CLV" value={pp(overall.averageProbabilityClv)} />
            <Metric label="Brier score" value={decimal(overall.brierScore)} hint={tr({ fi: "Pienempi on parempi", en: "Lower is better", es: "Menor es mejor" })} />
            <Metric label="Log loss" value={decimal(overall.logLoss)} hint={tr({ fi: "Pienempi on parempi", en: "Lower is better", es: "Menor es mejor" })} />
            <Metric label={tr({ fi: "Osumaprosentti", en: "Hit rate", es: "Tasa de acierto" })} value={pct(overall.hitRate)} hint={overall.hitRateInterval ? `${pct(overall.hitRateInterval.lower)}–${pct(overall.hitRateInterval.upper)}` : "Wilson 95%"} />
            <Metric label="Yield" value={pct(overall.yield)} hint={`${money(overall.profit, locale)} / ${money(overall.stake, locale)}`} />
            <Metric label={tr({ fi: "Maksimidrawdown", en: "Max drawdown", es: "Drawdown máximo" })} value={money(overall.maximumDrawdown, locale)} />
          </section>

          <ReliabilityBins bins={data.calibrationBins} tr={tr} />

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Exclusions</div>
              <h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Miksi havaintoja jätettiin pois?", en: "Why were observations excluded?", es: "¿Por qué se excluyeron?" })}</h2>
              <div className="mt-4 space-y-2">{exclusions.map(([reason, count]) => <div key={reason} className="flex items-center justify-between rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-sm"><span className="text-[var(--sc-text-secondary)]">{reason}</span><strong className="text-[var(--sc-text)]">{count}</strong></div>)}{exclusions.length === 0 && <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei poissulkemisia.", en: "No exclusions.", es: "Sin exclusiones." })}</div>}</div>
            </div>
            <div className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Champion / Challenger</div>
              <h2 className="mt-1 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Vain ihmisen arvioitava vertailu", en: "Human-reviewed comparison only", es: "Comparación revisada por humanos" })}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--sc-text-secondary)]">{data.championChallenger?.note}</p>
              <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">comparisonAvailable={String(data.championChallenger?.comparisonAvailable)} · automaticPromotion={String(data.championChallenger?.automaticPromotion)}</div>
            </div>
          </section>

          <SliceTable title={tr({ fi: "Liigoittain", en: "By league", es: "Por liga" })} rows={data.slices?.league} tr={tr} />
          <SliceTable title={tr({ fi: "Lajeittain", en: "By sport", es: "Por deporte" })} rows={data.slices?.sport} tr={tr} />
          <SliceTable title={tr({ fi: "Malliversioittain", en: "By model version", es: "Por versión" })} rows={data.slices?.modelVersion} tr={tr} />
          <SliceTable title={tr({ fi: "Kerroinalueittain", en: "By odds range", es: "Por rango de cuota" })} rows={data.slices?.oddsRange} tr={tr} />
        </>
      )}

      <section className="sc-surface rounded-[1.7rem] p-5 sm:p-6">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Methodology</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><Metric label="Price CLV" value="entry odds × close p − 1" /><Metric label="Probability CLV" value="close p − entry p" /><Metric label="Binary Brier" value="(p − y)²" /><Metric label="Log loss" value="−[y ln p + (1−y) ln(1−p)]" /></div>
        <p className="mt-4 text-xs leading-5 text-[var(--sc-faint)]">{tr({ fi: "Closing-tieto on viimeinen kelvollinen ennen ottelua kerätty tarjoajakonsensus. Nykyhintaa, käyttäjän syöttämää closing-kerrointa tai simuloitua closing-linjaa ei käytetä.", en: "Closing evidence is the final eligible provider consensus captured before kickoff. Current odds, user-entered closing odds and simulated closing lines are not accepted.", es: "El cierre procede únicamente del consenso final capturado antes del inicio." })}</p>
      </section>
    </div>
  );
}
