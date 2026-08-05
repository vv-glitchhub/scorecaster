"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const num = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const dateTime = (value) => value ? new Date(value).toLocaleString() : "–";

function MetricCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{value}</div>
      {detail && <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div>}
    </div>
  );
}

function ProbabilityStrip({ result }) {
  const probabilities = result.model.probabilities;
  const home = probabilities.home * 100;
  const draw = probabilities.draw * 100;
  const away = probabilities.away * 100;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{home.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">{result.event.home}</div></div>
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{draw.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">Draw</div></div>
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{away.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">{result.event.away}</div></div>
      </div>
      <div className="mt-5 flex h-4 overflow-hidden rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" aria-label="Match X-Ray 1X2 probability distribution">
        <div className="bg-emerald-400" style={{ width: `${home}%` }} />
        <div className="bg-amber-300" style={{ width: `${draw}%` }} />
        <div className="bg-sky-400" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}

function TeamEvidence({ title, profile }) {
  const visible = profile.metrics.filter((metric) => metric.displayable);
  return (
    <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{title}</div>
          <h3 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{profile.team}</h3>
        </div>
        <span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-black text-[var(--sc-muted)]">
          n={profile.sampleSize ?? "?"} · weight {num(profile.sampleWeight, 2)}
        </span>
      </div>
      {profile.sampleWarning && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">{profile.sampleWarning}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((metric) => (
          <div key={metric.key} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4">
            <div className="text-xs font-black text-[var(--sc-text)]">{metric.label}</div>
            <div className="mt-1 text-lg font-black text-[var(--sc-text)]">{num(metric.value, 2)} <span className="text-xs text-[var(--sc-muted)]">{metric.unit}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-[var(--sc-border)] pt-4 text-xs leading-6 text-[var(--sc-muted)]">
        <div><strong className="text-[var(--sc-text)]">Source:</strong> {profile.sourceId}</div>
        <div><strong className="text-[var(--sc-text)]">Observed:</strong> {dateTime(profile.observedAt)}</div>
        <div><strong className="text-[var(--sc-text)]">Window:</strong> {dateTime(profile.windowStart)} → {dateTime(profile.windowEnd)}</div>
      </div>
    </section>
  );
}

function ScoreMatrix({ matrix }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[520px] border-separate border-spacing-1 text-center text-xs">
        <thead>
          <tr><th className="p-2 text-[var(--sc-faint)]">H\A</th>{matrix.rows[0].cells.map((cell) => <th key={cell.awayGoals} className="p-2 text-[var(--sc-faint)]">{cell.awayGoals}</th>)}</tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.homeGoals}>
              <th className="p-2 text-[var(--sc-faint)]">{row.homeGoals}</th>
              {row.cells.map((cell) => (
                <td key={`${cell.homeGoals}-${cell.awayGoals}`} className="rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-2 font-bold text-[var(--sc-text-secondary)]" title={`${cell.homeGoals}-${cell.awayGoals}`}>
                  {pct(cell.probability, 1)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MatchXRayClient() {
  const { tr } = useLanguage();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [neutral, setNeutral] = useState(false);
  const [homeOdds, setHomeOdds] = useState("");
  const [drawOdds, setDrawOdds] = useState("");
  const [awayOdds, setAwayOdds] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasOdds = [homeOdds, drawOdds, awayOdds].every((value) => Number(value) > 1);
  const strongest = useMemo(() => {
    if (!result?.model?.probabilities) return null;
    return Object.entries(result.model.probabilities).sort((left, right) => right[1] - left[1])[0];
  }, [result]);

  async function analyze(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ home: home.trim(), away: away.trim() });
      if (neutral) params.set("neutral", "true");
      if (kickoff) params.set("kickoff", new Date(kickoff).toISOString());
      if (hasOdds) {
        params.set("homeOdds", homeOdds);
        params.set("drawOdds", drawOdds);
        params.set("awayOdds", awayOdds);
      }
      const response = await fetch(`/api/xray?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Match X-Ray unavailable");
      setResult(payload);
    } catch (cause) {
      setError(cause?.message || "Match X-Ray unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match X-Ray V1</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({ fi: "Näe, mistä ottelun todennäköisyys muodostuu.", en: "See what the match probability is built from.", es: "Mira de qué se construye la probabilidad del partido." })}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">
          {tr({ fi: "X-Ray yhdistää aikaleimatut joukkuearviot, sample-korjatun vireen, hyökkäys–puolustus-parit, odotetut maalit, tulosmatriisin ja herkkyystestit. Puuttuvaa taktiikka- tai kontekstidataa ei keksitä.", en: "X-Ray combines timestamped team ratings, sample-adjusted form, attack-defence matchups, expected goals, a score matrix and sensitivity tests. Missing tactical or context data is never invented.", es: "X-Ray combina ratings con fecha, forma ajustada por muestra, emparejamientos ataque-defensa, goles esperados, matriz de marcadores y pruebas de sensibilidad. No inventa datos faltantes." })}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-emerald-100">timestamped evidence</span>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1 text-amber-100">baseline · not league-calibrated</span>
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-[var(--sc-muted)]">paper-only</span>
        </div>
      </section>

      <form onSubmit={analyze} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Kotijoukkue", en: "Home team", es: "Equipo local" })}<input required maxLength={120} value={home} onChange={(event) => setHome(event.target.value)} className="sc-input mt-2" placeholder="Arsenal" /></label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Vierasjoukkue", en: "Away team", es: "Equipo visitante" })}<input required maxLength={120} value={away} onChange={(event) => setAway(event.target.value)} className="sc-input mt-2" placeholder="Chelsea" /></label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Ottelun alkamisaika (valinnainen)", en: "Kickoff time (optional)", es: "Hora de inicio (opcional)" })}<input type="datetime-local" value={kickoff} onChange={(event) => setKickoff(event.target.value)} className="sc-input mt-2" /></label>
          <label className="flex min-h-12 items-center gap-3 self-end rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={neutral} onChange={(event) => setNeutral(event.target.checked)} />{tr({ fi: "Neutraali pelipaikka", en: "Neutral venue", es: "Sede neutral" })}</label>
        </div>
        <details className="mt-4 rounded-2xl border border-[var(--sc-border)] p-4">
          <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Valinnainen no-vig-markkinavertailu", en: "Optional no-vig market benchmark", es: "Referencia de mercado no-vig opcional" })}</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-black text-[var(--sc-faint)]">1<input type="number" min="1.01" step="0.01" value={homeOdds} onChange={(event) => setHomeOdds(event.target.value)} className="sc-input mt-2" /></label>
            <label className="text-xs font-black text-[var(--sc-faint)]">X<input type="number" min="1.01" step="0.01" value={drawOdds} onChange={(event) => setDrawOdds(event.target.value)} className="sc-input mt-2" /></label>
            <label className="text-xs font-black text-[var(--sc-faint)]">2<input type="number" min="1.01" step="0.01" value={awayOdds} onChange={(event) => setAwayOdds(event.target.value)} className="sc-input mt-2" /></label>
          </div>
        </details>
        <button disabled={loading || !home.trim() || !away.trim()} className="sc-button-primary mt-5 disabled:opacity-40">{loading ? tr({ fi: "Rakennetaan X-Ray…", en: "Building X-Ray…", es: "Creando X-Ray…" }) : tr({ fi: "Avaa Match X-Ray", en: "Open Match X-Ray", es: "Abrir Match X-Ray" })}</button>
      </form>

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>}

      {result && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{result.xrayVersion}</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{result.event.home} vs {result.event.away}</h2></div><span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100">observation only</span></div>
            <div className="mt-7"><ProbabilityStrip result={result} /></div>
            {strongest && <p className="mt-5 text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Suurin 1X2-todennäköisyys", en: "Largest 1X2 probability", es: "Mayor probabilidad 1X2" })}: <strong className="text-[var(--sc-text)]">{strongest[0].toUpperCase()} {pct(strongest[1])}</strong></p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Home xG" value={num(result.model.expectedGoals.home)} />
            <MetricCard label="Away xG" value={num(result.model.expectedGoals.away)} />
            <MetricCard label={tr({ fi: "X-Ray datan laatu", en: "X-Ray evidence quality", es: "Calidad de evidencia X-Ray" })} value={pct(result.evidenceQuality.score)} detail={result.evidenceQuality.method} />
            <MetricCard label={tr({ fi: "Taktiikkadatan kattavuus", en: "Tactical metric coverage", es: "Cobertura táctica" })} value={pct(result.evidenceQuality.optionalMetricCoverage)} />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <TeamEvidence title={tr({ fi: "Kotijoukkueen evidenssi", en: "Home evidence", es: "Evidencia local" })} profile={result.teams.home} />
            <TeamEvidence title={tr({ fi: "Vierasjoukkueen evidenssi", en: "Away evidence", es: "Evidencia visitante" })} profile={result.teams.away} />
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Otteluparin erot", en: "Matchup evidence", es: "Evidencia del emparejamiento" })}</h3>
              <div className="mt-4 space-y-2">{result.matchupEvidence.map((row) => <div key={row.id} className="rounded-xl bg-[var(--sc-surface-soft)] px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-[var(--sc-text)]">{row.label}</span><span className="text-xs font-black uppercase text-[var(--sc-brand)]">{row.direction}</span></div><div className="mt-1 text-xs text-[var(--sc-muted)]">{num(row.value, 3)} {row.unit}</div></div>)}</div>
            </div>
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Suurimmat tekijät", en: "Largest factors", es: "Factores principales" })}</h3>
              <div className="mt-4 space-y-2">{result.factors.slice(0, 6).map((factor) => <div key={factor.id} className="rounded-xl bg-[var(--sc-surface-soft)] px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-[var(--sc-text)]">{factor.label}</span><span className="text-xs font-black uppercase text-[var(--sc-brand)]">{factor.direction}</span></div><div className="mt-1 text-xs text-[var(--sc-muted)]">strength {num(factor.strength, 2)} · {num(factor.value, 2)} {factor.unit}</div></div>)}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Poisson-tulosmatriisi", en: "Poisson scoreline matrix", es: "Matriz Poisson de marcadores" })}</h3><span className="text-xs font-bold text-[var(--sc-muted)]">covered {pct(result.scorelineMatrix.coveredProbabilityMass, 2)}</span></div>
            <div className="mt-4"><ScoreMatrix matrix={result.scorelineMatrix} /></div>
            <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">Outside 0–{result.scorelineMatrix.maxGoalsPerTeam}: {pct(result.scorelineMatrix.outsideGridProbability, 2)}</p>
          </section>

          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Herkkyysskenaariot", en: "Sensitivity scenarios", es: "Escenarios de sensibilidad" })}</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Muut kuin baseline ovat hypoteettisia testejä, eivät havaittua evidenssiä.", en: "Anything except baseline is a hypothetical test, not observed evidence.", es: "Todo salvo la base es una prueba hipotética, no evidencia observada." })}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">{result.scenarios.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-sm font-black text-[var(--sc-text)]">{item.label}</div><div className="mt-3 space-y-1 text-xs text-[var(--sc-muted)]"><div>1: {pct(item.probabilities.home)} ({item.deltaFromBaseline.home >= 0 ? "+" : ""}{pct(item.deltaFromBaseline.home)})</div><div>X: {pct(item.probabilities.draw)} ({item.deltaFromBaseline.draw >= 0 ? "+" : ""}{pct(item.deltaFromBaseline.draw)})</div><div>2: {pct(item.probabilities.away)} ({item.deltaFromBaseline.away >= 0 ? "+" : ""}{pct(item.deltaFromBaseline.away)})</div></div><div className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{item.status}</div></div>)}</div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6"><h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Riskit", en: "Risks", es: "Riesgos" })}</h3><div className="mt-4 space-y-2">{result.risks.length ? result.risks.map((risk) => <div key={risk.id} className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-3 text-sm leading-6 text-amber-50/90"><strong>{risk.severity}:</strong> {risk.message}</div>) : <p className="text-sm text-[var(--sc-muted)]">No additional X-Ray risk flags.</p>}</div></div>
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6"><h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia faltante" })}</h3><p className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Näitä arvoja ei korvattu AI-arvauksilla.", en: "These values were not replaced with AI guesses.", es: "Estos valores no se sustituyeron con conjeturas de IA." })}</p><div className="mt-4 flex flex-wrap gap-2">{result.unknowns.length ? result.unknowns.map((item) => <span key={item} className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-bold text-[var(--sc-muted)]">{item}</span>) : <span className="text-sm text-[var(--sc-muted)]">No optional metric gaps.</span>}</div></div>
          </section>

          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Auditointi ja rajat", en: "Audit and boundaries", es: "Auditoría y límites" })}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Closing line used" value={String(result.audit.closingLineUsed)} /><MetricCard label="Post-kickoff data" value={String(result.audit.postKickoffDataUsed)} /><MetricCard label="Invented metrics" value={String(result.audit.inventedMetrics)} /><MetricCard label="Reproducible" value={String(result.audit.reproducible)} /></div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold"><Link href="/probabilities" className="text-[var(--sc-brand)] hover:underline">Open 1X2 model</Link><Link href="/sources" className="text-[var(--sc-brand)] hover:underline">Source registry</Link><a href={`/api/xray?home=${encodeURIComponent(result.event.home)}&away=${encodeURIComponent(result.event.away)}`} className="text-[var(--sc-brand)] hover:underline">Public audit JSON</a></div>
          </section>
        </div>
      )}
    </div>
  );
}
