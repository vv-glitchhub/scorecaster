"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const presentNumber = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const percent = (value) => presentNumber(value) ? `${(Number(value) * 100).toFixed(1)} %` : "—";
const decimal = (value, digits = 1) => presentNumber(value) ? Number(value).toFixed(digits) : "—";
const age = (value) => presentNumber(value) ? `${Math.round(Number(value))} min` : "—";

function tone(value) {
  if (["ready", "enabled", "healthy"].includes(value)) return "border-emerald-400/35 bg-emerald-400/10 text-emerald-200";
  if (["blocked", "disabled", "failed"].includes(value)) return "border-rose-400/35 bg-rose-400/10 text-rose-200";
  return "border-amber-400/35 bg-amber-400/10 text-amber-100";
}

function StatusPill({ value }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] ${tone(value)}`}>{value || "unknown"}</span>;
}

function Metric({ label, value, detail }) {
  return (
    <div className="sc-surface-soft rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--sc-text)]">{value ?? "—"}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[var(--sc-faint)]">{detail}</p> : null}
    </div>
  );
}

function ReasonList({ reasons = [], empty }) {
  if (!reasons.length) return <span className="text-emerald-300">{empty}</span>;
  return <ul className="space-y-1">{reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>;
}

export default function ProductionEvidenceClient() {
  const { tr } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("30");
  const [sportInput, setSportInput] = useState("");
  const [sport, setSport] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ days });
      if (sport) query.set("sport", sport);
      const response = await fetch(`/api/production-evidence?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "Production evidence unavailable");
      setData(body);
    } catch (caught) {
      setError(caught?.message || "Production evidence unavailable");
    } finally {
      setLoading(false);
    }
  }, [days, sport]);

  useEffect(() => { void load(); }, [load]);

  const csvQuery = new URLSearchParams({ days, format: "csv" });
  if (sport) csvQuery.set("sport", sport);
  const csvUrl = `/api/production-evidence?${csvQuery}`;
  const releaseQuery = new URLSearchParams({ days, format: "release" });
  if (sport) releaseQuery.set("sport", sport);
  const releaseUrl = `/api/production-evidence?${releaseQuery}`;

  const summary = data?.summary || {};
  const worker = data?.worker || {};

  return (
    <div className="space-y-6">
      <section className="sc-surface overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="sc-kicker">Production Evidence V1</div>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.055em] text-[var(--sc-text)] sm:text-5xl">
              {tr({ fi: "Todiste ennen tuotantolupausta", en: "Evidence before a production claim", es: "Evidencia antes de afirmar producción" })}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-text-secondary)] sm:text-base">
              {tr({
                fi: "Tämä näkymä mittaa jokaisen liigan datan tuoreuden, tapahtumatunnisteet, vedonvälittäjäkattavuuden, worker-ajot ja closing-line-evidenssin näkyvillä nimittäjillä. Puuttuva tieto heikentää tai estää valmiuden.",
                en: "This view measures data freshness, fixture identity, bookmaker coverage, worker cycles and closing-line evidence for every league with visible denominators. Missing evidence degrades or blocks readiness.",
                es: "Esta vista mide frescura, identidad, cobertura, ciclos y evidencia de cierre con denominadores visibles. La evidencia faltante degrada o bloquea la preparación."
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={loading ? "loading" : data?.releaseState} />
            <StatusPill value="paper-only" />
          </div>
        </div>
      </section>

      <section className="sc-surface-soft rounded-2xl p-4">
        <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto_auto_auto]" onSubmit={(event) => { event.preventDefault(); setSport(sportInput.trim().toLowerCase()); }}>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
            {tr({ fi: "Aikaikkuna", en: "Time window", es: "Ventana" })}
            <select value={days} onChange={(event) => setDays(event.target.value)} className="sc-input mt-2" aria-label={tr({ fi: "Aikaikkuna", en: "Time window", es: "Ventana" })}>
              <option value="7">7 {tr({ fi: "päivää", en: "days", es: "días" })}</option>
              <option value="30">30 {tr({ fi: "päivää", en: "days", es: "días" })}</option>
              <option value="90">90 {tr({ fi: "päivää", en: "days", es: "días" })}</option>
              <option value="180">180 {tr({ fi: "päivää", en: "days", es: "días" })}</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
            {tr({ fi: "Lajisuodatin", en: "Sport filter", es: "Filtro de deporte" })}
            <input value={sportInput} onChange={(event) => setSportInput(event.target.value)} className="sc-input mt-2" placeholder="soccer_epl" maxLength={80} />
          </label>
          <button type="submit" className="sc-button-primary self-end">{tr({ fi: "Käytä", en: "Apply", es: "Aplicar" })}</button>
          <a href={csvUrl} className="sc-button-secondary self-end" download>CSV</a>
          <a
            href={releaseUrl}
            className="sc-button-secondary self-end"
            download
            aria-label={tr({ fi: "Lataa release-evidenssi JSON", en: "Download release evidence JSON", es: "Descargar evidencia de release JSON" })}
            title={tr({
              fi: "Koneellisesti luettava paketti. Puuttuvat tuotantotodisteet pysyvät unverified-tilassa.",
              en: "Machine-readable package. Missing production proof remains unverified.",
              es: "Paquete legible por máquina. La evidencia de producción faltante permanece sin verificar."
            })}
          >
            Release JSON
          </a>
        </form>
      </section>

      {error ? <div role="alert" className="rounded-2xl border border-rose-400/35 bg-rose-400/10 p-4 text-rose-200">{error}</div> : null}
      {(data?.warnings || []).length ? <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-amber-100"><ReasonList reasons={data.warnings} empty="" /></div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label={tr({ fi: "Yhteenveto", en: "Summary", es: "Resumen" })}>
        <Metric label={tr({ fi: "Sallitut liigat", en: "Enabled leagues", es: "Ligas habilitadas" })} value={`${summary.enabledLeagues ?? 0}/${summary.leagues ?? 0}`} />
        <Metric label={tr({ fi: "Worker onnistui", en: "Worker success", es: "Éxito del worker" })} value={percent(worker.successRate)} detail={`${worker.successes ?? 0}/${worker.denominator ?? 0}`} />
        <Metric label={tr({ fi: "Varmennettu identiteetti", en: "Verified identity", es: "Identidad verificada" })} value={percent(summary.verifiedFixtureIdentityRate)} detail={`${summary.events ?? 0} events`} />
        <Metric label={tr({ fi: "Monilähdetapahtumat", en: "Multi-provider events", es: "Eventos multifuente" })} value={percent(summary.multiProviderEventRate)} />
        <Metric label="Closing-line coverage" value={percent(summary.closingLineCoverage)} detail={`${summary.closingEvents ?? 0}/${summary.closingEligibleEvents ?? 0}`} />
        <Metric label={tr({ fi: "Aktiiviset incidentit", en: "Active incidents", es: "Incidentes activos" })} value={summary.activeIncidents ?? 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="sc-surface rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-muted)]">League readiness</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">{tr({ fi: "Liigakohtaiset portit", en: "League-level gates", es: "Puertas por liga" })}</h2>
            </div>
            <span className="text-xs text-[var(--sc-faint)]">{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">
                <tr><th className="p-3">Sport / league</th><th className="p-3">State</th><th className="p-3">Score</th><th className="p-3">Events</th><th className="p-3">Identity</th><th className="p-3">Multi-provider</th><th className="p-3">Closing</th><th className="p-3">Freshness</th><th className="p-3">Evidence gaps</th></tr>
              </thead>
              <tbody>
                {(data?.leagues || []).map((league) => (
                  <tr key={`${league.sport}:${league.league}`} className="border-t border-[var(--sc-border)] align-top">
                    <td className="p-3"><div className="font-black text-[var(--sc-text)]">{league.league}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{league.sport}</div></td>
                    <td className="p-3"><StatusPill value={league.state} /></td>
                    <td className="p-3 font-black">{decimal(league.score)}</td>
                    <td className="p-3">{league.events}</td>
                    <td className="p-3">{percent(league.verifiedIdentityRate)}<div className="text-xs text-[var(--sc-faint)]">{league.verifiedIdentities}/{league.denominators?.identity}</div></td>
                    <td className="p-3">{percent(league.multiProviderRate)}<div className="text-xs text-[var(--sc-faint)]">{league.multiProviderEvents}/{league.denominators?.multiProvider}</div></td>
                    <td className="p-3">{percent(league.closingLineCoverage)}<div className="text-xs text-[var(--sc-faint)]">{league.closingEvents}/{league.denominators?.closingLine}</div></td>
                    <td className="p-3">{age(league.latestAgeMinutes)}</td>
                    <td className="max-w-xs p-3 text-xs leading-5 text-[var(--sc-muted)]"><ReasonList reasons={league.reasons} empty={tr({ fi: "Kaikki portit läpi", en: "All gates pass", es: "Todas las puertas pasan" })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !data?.leagues?.length ? <p className="p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Yhdellekään liigalle ei ole vielä riittävää tuotantoevidenssiä.", en: "No league has sufficient production evidence yet.", es: "Ninguna liga tiene evidencia suficiente todavía." })}</p> : null}
          </div>
        </div>

        <div className="space-y-5">
          <section className="sc-surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">Protected worker</h2><StatusPill value={worker.state} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Cycles" value={worker.cycles ?? 0} />
              <Metric label="Success" value={percent(worker.successRate)} />
              <Metric label="Failed" value={worker.failed ?? 0} />
              <Metric label="Latest age" value={age(worker.latestAgeMinutes)} />
            </div>
          </section>
          <section className="sc-surface rounded-3xl p-5">
            <h2 className="text-xl font-black">{tr({ fi: "Järjestelmän blokkerit", en: "System blockers", es: "Bloqueos del sistema" })}</h2>
            <div className="mt-4 text-sm leading-6 text-[var(--sc-muted)]"><ReasonList reasons={data?.blockers || []} empty={tr({ fi: "Ei järjestelmätason blokkereita", en: "No system-level blockers", es: "Sin bloqueos del sistema" })} /></div>
          </section>
        </div>
      </section>

      <section className="sc-surface rounded-3xl p-5 sm:p-6">
        <h2 className="text-2xl font-black tracking-[-0.035em]">Provider evidence</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.providers || []).map((provider) => (
            <article key={provider.provider} className="sc-surface-soft rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="font-black">{provider.provider}</h3><StatusPill value={provider.state} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[var(--sc-muted)]">Availability</dt><dd className="mt-1 font-black">{percent(provider.availabilityRate)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Freshness</dt><dd className="mt-1 font-black">{age(provider.latestAgeMinutes)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Trust</dt><dd className="mt-1 font-black">{percent(provider.trust)}</dd></div><div><dt className="text-xs text-[var(--sc-muted)]">Evidence</dt><dd className="mt-1 font-black">{provider.successfulObservations}/{provider.denominator}</dd></div></dl>
              <p className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">{provider.families?.join(" · ")}</p>
            </article>
          ))}
          {!loading && !data?.providers?.length ? <p className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Provider-havaintoja ei ole käytettävissä.", en: "Provider observations are unavailable.", es: "No hay observaciones de proveedores." })}</p> : null}
        </div>
      </section>

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
