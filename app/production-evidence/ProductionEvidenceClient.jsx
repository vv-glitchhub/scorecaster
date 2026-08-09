"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "../components/LanguageProvider";
import ProviderDiagnosticsPanel from "./ProviderDiagnosticsPanel";

const stateTone = {
  enabled: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  degraded: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  disabled: "border-rose-400/35 bg-rose-400/10 text-rose-100",
  ready: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  blocked: "border-rose-400/35 bg-rose-400/10 text-rose-100"
};

const percent = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "—";
const age = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(0)} min` : "—";
const decimal = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

function Tone({ state = "degraded", children }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${stateTone[state] || stateTone.degraded}`}>{children}</span>;
}

function DownloadButton({ href, children }) {
  return <a href={href} className="rounded-full border border-[var(--sc-border)] bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10">{children}</a>;
}

export default function ProductionEvidenceClient() {
  const { language } = useLocale();
  const tr = (copy) => copy?.[language] || copy?.en || copy?.fi || "";
  const [days, setDays] = useState(30);
  const [sport, setSport] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ days: String(days) });
    if (sport) params.set("sport", sport);
    setLoading(true);
    setError(null);
    fetch(`/api/production-evidence?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || body?.ok === false) throw new Error(body?.error || "Production evidence unavailable");
        return body;
      })
      .then(setData)
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") setError(requestError);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [days, sport]);

  const sports = useMemo(() => {
    const values = (data?.leagues || []).map((league) => league.sport).filter(Boolean);
    return [...new Set(values)].sort();
  }, [data?.leagues]);

  const releaseParams = new URLSearchParams({ days: String(days), format: "release" });
  const csvParams = new URLSearchParams({ days: String(days), format: "csv" });
  if (sport) {
    releaseParams.set("sport", sport);
    csvParams.set("sport", sport);
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="sc-surface overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">Production Evidence V1</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{tr({ fi: "Julkaisukelpoisuus näkyviin ilman arvailua", en: "Release readiness without hand-waving", es: "Preparación de producción sin suposiciones" })}</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--sc-text-secondary)]">{tr({ fi: "Providerit, liigat, workerit, closing-linja ja nimittäjät samassa fail-closed-näkymässä. Puuttuva evidence heikentää tai estää valmiuden — sitä ei täytetä oletuksilla.", en: "Providers, leagues, worker cycles, closing lines and denominators in one fail-closed view. Missing evidence degrades or blocks readiness; it is never imputed.", es: "Proveedores, ligas, workers, cierre y denominadores en una vista fail-closed. La evidencia faltante degrada o bloquea; nunca se inventa." })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadButton href={`/api/production-evidence?${csvParams.toString()}`}>CSV</DownloadButton>
            <DownloadButton href={`/api/production-evidence?${releaseParams.toString()}`}>Release JSON</DownloadButton>
            <Link href="/model-lab" className="rounded-full border border-[var(--sc-border)] px-3 py-2 text-xs font-black hover:bg-white/5">Model Lab</Link>
            <Link href="/" className="rounded-full border border-[var(--sc-border)] px-3 py-2 text-xs font-black hover:bg-white/5">Today</Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sc-surface-soft rounded-2xl p-4 text-sm"><span className="block text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Window</span><select value={days} onChange={(event) => setDays(Number(event.target.value))} className="mt-2 w-full bg-transparent font-black outline-none"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option></select></label>
          <label className="sc-surface-soft rounded-2xl p-4 text-sm"><span className="block text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Sport</span><select value={sport} onChange={(event) => setSport(event.target.value)} className="mt-2 w-full bg-transparent font-black outline-none"><option value="">All sports</option>{sports.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="sc-surface-soft rounded-2xl p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Release state</p><div className="mt-2"><Tone state={data?.releaseState || "degraded"}>{loading ? "LOADING" : (data?.releaseState || "UNKNOWN").toUpperCase()}</Tone></div></div>
          <div className="sc-surface-soft rounded-2xl p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Generated</p><p className="mt-2 text-sm font-black">{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p></div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error.message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Leagues</p><p className="mt-2 text-2xl font-black">{data?.summary?.leagues ?? 0}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">{data?.summary?.enabledLeagues ?? 0} enabled</p></div>
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Fixtures verified</p><p className="mt-2 text-2xl font-black">{percent(data?.summary?.verifiedFixtureIdentityRate)}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">event identity denominator</p></div>
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Multi-provider</p><p className="mt-2 text-2xl font-black">{percent(data?.summary?.multiProviderEventRate)}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">independent price coverage</p></div>
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Closing coverage</p><p className="mt-2 text-2xl font-black">{percent(data?.summary?.closingLineCoverage)}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">{data?.summary?.closingEvents ?? 0}/{data?.summary?.closingEligibleEvents ?? 0} eligible</p></div>
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Worker success</p><p className="mt-2 text-2xl font-black">{percent(data?.worker?.successRate)}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">{data?.worker?.cycles ?? 0} completed cycles</p></div>
        <div className="sc-surface rounded-2xl p-4"><p className="text-xs text-[var(--sc-muted)]">Provider health</p><p className="mt-2 text-2xl font-black">{percent(data?.summary?.averageProviderAvailability)}</p><p className="mt-1 text-xs text-[var(--sc-faint)]">{data?.summary?.providerCount ?? 0} observed providers</p></div>
      </section>

      {data?.blockers?.length ? (
        <section className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-5">
          <h2 className="text-lg font-black text-rose-100">{tr({ fi: "Julkaisublokkerit", en: "Release blockers", es: "Bloqueos de lanzamiento" })}</h2>
          <ul className="mt-3 space-y-2 text-sm text-rose-50/90">{data.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">League scorecards</p><h2 className="mt-1 text-2xl font-black">{tr({ fi: "Liigakohtainen data trust", en: "League-level data trust", es: "Confianza de datos por liga" })}</h2></div>
          <p className="text-xs text-[var(--sc-faint)]">enabled → degraded → disabled</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {(data?.leagues || []).map((league) => (
            <article key={`${league.sport}:${league.league}`} className="sc-surface rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{league.sport}</p><h3 className="mt-1 text-xl font-black">{league.league}</h3></div><Tone state={league.state}>{league.state}</Tone></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Score</span><strong className="mt-1 block text-lg">{decimal(league.score)}</strong></div><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Events</span><strong className="mt-1 block text-lg">{league.events}</strong></div><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Identity</span><strong className="mt-1 block">{percent(league.verifiedIdentityRate)}</strong></div><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Multi-provider</span><strong className="mt-1 block">{percent(league.multiProviderRate)}</strong></div><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Coverage</span><strong className="mt-1 block">{percent(league.averageCoverageScore)}</strong></div><div className="sc-surface-soft rounded-xl p-3"><span className="block text-xs text-[var(--sc-muted)]">Closing</span><strong className="mt-1 block">{percent(league.closingLineCoverage)}</strong></div></div>
              <p className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">identity n={league.denominators?.identity ?? 0} · multi-provider n={league.denominators?.multiProvider ?? 0} · closing n={league.denominators?.closingLine ?? 0} · fresh {age(league.latestAgeMinutes)}</p>
              {league.reasons?.length ? <ul className="mt-3 space-y-1 text-xs text-[var(--sc-muted)]">{league.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul> : <p className="mt-3 text-xs text-emerald-200">All configured league gates pass.</p>}
            </article>
          ))}
          {!loading && !data?.leagues?.length ? <p className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Liigaevidenssiä ei ole vielä.", en: "No league evidence yet.", es: "Todavía no hay evidencia de ligas." })}</p> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="sc-surface rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">Protected worker</p><h2 className="mt-1 text-xl font-black">Unified Data cadence</h2></div><Tone state={data?.worker?.state || "degraded"}>{data?.worker?.state || "unknown"}</Tone></div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[var(--sc-muted)]">Completed cycles</dt><dd className="mt-1 font-black">{data?.worker?.cycles ?? 0}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Success</dt><dd className="mt-1 font-black">{percent(data?.worker?.successRate)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Latest age</dt><dd className="mt-1 font-black">{age(data?.worker?.latestAgeMinutes)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Target</dt><dd className="mt-1 font-black">{percent(data?.worker?.target)}</dd></div></dl>
          <p className="mt-4 text-xs leading-5 text-[var(--sc-faint)]">{data?.worker?.successes ?? 0} success · {data?.worker?.partial ?? 0} partial · {data?.worker?.failed ?? 0} failed · {data?.worker?.inFlight ?? 0} in flight</p>
        </article>
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.providers || []).map((provider) => (
            <article key={provider.provider} className="sc-surface rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[var(--sc-muted)]">Provider</p><h3 className="mt-1 font-black">{provider.provider}</h3></div><Tone state={provider.state}>{provider.state}</Tone></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[var(--sc-muted)]">Availability</dt><dd className="mt-1 font-black">{percent(provider.availabilityRate)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Freshness</dt><dd className="mt-1 font-black">{age(provider.latestAgeMinutes)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Trust</dt><dd className="mt-1 font-black">{percent(provider.trust)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Evidence</dt><dd className="mt-1 font-black">{provider.successfulObservations}/{provider.denominator}</dd></div></dl>
              <p className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">{provider.families?.join(" · ")}</p>
            </article>
          ))}
          {!loading && !data?.providers?.length ? <p className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Provider-havaintoja ei ole käytettävissä.", en: "Provider observations are unavailable.", es: "No hay observaciones de proveedores." })}</p> : null}
        </div>
      </section>

      <ProviderDiagnosticsPanel data={data} tr={tr} />

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="sc-surface rounded-3xl p-5 sm:p-6">
          <h2 className="text-xl font-black">{tr({ fi: "Näkyvät nimittäjät", en: "Visible denominators", es: "Denominadores visibles" })}</h2>
          <dl className="mt-4 space-y-3 text-sm leading-6 text-[var(--sc-text-secondary)]">
            {Object.entries(data?.methodology || {}).map(([key, value]) => <div key={key} className="sc-surface-soft rounded-xl p-3"><dt className="font-black text-[var(--sc-text)]">{key}</dt><dd className="mt-1">{value}</dd></div>)}
          </dl>
        </div>
        <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 sm:p-6">
          <h2 className="text-xl font-black text-amber-100">Paper-only safety</h2>
          <p className="mt-3 text-sm leading-7 text-amber-50/90">{tr({ fi: "Valmiusraportti ei muuta mallin todennäköisyyttä, päätösluokkaa tai panosta. Se ei käytä closing-linjaa ottelua edeltävään päätökseen, välitä vedonvälittäjätunnuksia tai toteuta oikean rahan vetoja.", en: "The readiness report cannot change model probabilities, decision classes or stakes. It never uses closing lines for pre-match decisions, handles bookmaker credentials or executes real-money bets.", es: "El informe no cambia probabilidades, decisiones ni apuestas, no usa el cierre antes del partido ni ejecuta apuestas reales." })}</p>
        </div>
      </section>
    </div>
  );
}
