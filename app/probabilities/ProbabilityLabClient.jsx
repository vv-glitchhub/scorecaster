"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";
const num = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function Metric({ label, value, tone = "default" }) {
  const toneClass = tone === "good" ? "text-emerald-200" : tone === "warn" ? "text-amber-100" : "text-[var(--sc-text)]";
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className={`mt-2 text-xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProbabilityBar({ result }) {
  const probabilities = result?.probabilities || {};
  const home = Math.max(0, Number(probabilities.home || 0) * 100);
  const draw = Math.max(0, Number(probabilities.draw || 0) * 100);
  const away = Math.max(0, Number(probabilities.away || 0) * 100);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{home.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">{result.teams.home}</div></div>
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{draw.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">Draw</div></div>
        <div><div className="text-3xl font-black text-[var(--sc-text)]">{away.toFixed(0)}%</div><div className="mt-1 text-xs font-bold text-[var(--sc-muted)]">{result.teams.away}</div></div>
      </div>
      <div className="mt-5 flex h-4 overflow-hidden rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)]" aria-label="1X2 probability distribution">
        <div className="bg-emerald-400" style={{ width: `${home}%` }} title={`Home ${home.toFixed(1)}%`} />
        <div className="bg-amber-300" style={{ width: `${draw}%` }} title={`Draw ${draw.toFixed(1)}%`} />
        <div className="bg-sky-400" style={{ width: `${away}%` }} title={`Away ${away.toFixed(1)}%`} />
      </div>
    </div>
  );
}

export default function ProbabilityLabClient() {
  const { tr } = useLanguage();
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [neutral, setNeutral] = useState(false);
  const [homeOdds, setHomeOdds] = useState("");
  const [drawOdds, setDrawOdds] = useState("");
  const [awayOdds, setAwayOdds] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasAllMarketOdds = [homeOdds, drawOdds, awayOdds].every((value) => Number(value) > 1);
  const strongest = useMemo(() => {
    if (!result?.probabilities) return null;
    return Object.entries(result.probabilities).sort((left, right) => right[1] - left[1])[0];
  }, [result]);

  async function calculate(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const params = new URLSearchParams({ home: home.trim(), away: away.trim() });
      if (neutral) params.set("neutral", "true");
      if (hasAllMarketOdds) {
        params.set("homeOdds", homeOdds);
        params.set("drawOdds", drawOdds);
        params.set("awayOdds", awayOdds);
      }
      const response = await fetch(`/api/1x2?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.reason || "Probability model unavailable");
      setResult(payload);
    } catch (cause) {
      setError(cause?.message || "Probability model unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-6 sm:p-8">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Transparent 1X2 Baseline V1</div>
        <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">
          {tr({ fi: "Kotivoitto, tasapeli ja vierasvoitto ilman piilotettua kaavaa.", en: "Home, draw and away probabilities without a hidden formula.", es: "Probabilidades local, empate y visitante sin fórmula oculta." })}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--sc-muted)]">
          {tr({
            fi: "Malli yhdistää Elo–Davidson-arvion ja Poisson-tulosmatriisin. Markkinakertoimet näytetään erillisenä no-vig-vertailuna, eivätkä ne muuta mallin omaa todennäköisyyttä.",
            en: "The model combines an Elo-Davidson estimate with a Poisson score matrix. Market odds are shown as a separate no-vig benchmark and do not alter the model probability.",
            es: "El modelo combina Elo-Davidson y una matriz Poisson. Las cuotas aparecen como referencia no-vig separada y no cambian la probabilidad del modelo."
          })}
        </p>
        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-50/85">
          {tr({
            fi: "Baseline ei ole vielä liigakohtaisesti kalibroitu. Se on havainto- ja auditointikerros eikä saa yksin nostaa kohdetta PLAY-luokkaan.",
            en: "This baseline is not yet league-calibrated. It is an observation and audit layer and cannot promote a pick to PLAY by itself.",
            es: "La base aún no está calibrada por liga. Es una capa de observación y auditoría y no puede promover PLAY por sí sola."
          })}
        </div>
      </section>

      <form onSubmit={calculate} className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Kotijoukkue", en: "Home team", es: "Equipo local" })}<input value={home} onChange={(event) => setHome(event.target.value)} required maxLength={120} className="sc-input mt-2" placeholder="Arsenal" /></label>
          <label className="text-sm font-black text-[var(--sc-text-secondary)]">{tr({ fi: "Vierasjoukkue", en: "Away team", es: "Equipo visitante" })}<input value={away} onChange={(event) => setAway(event.target.value)} required maxLength={120} className="sc-input mt-2" placeholder="Chelsea" /></label>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 text-sm font-bold text-[var(--sc-text-secondary)]"><input type="checkbox" checked={neutral} onChange={(event) => setNeutral(event.target.checked)} />{tr({ fi: "Neutraali pelipaikka", en: "Neutral venue", es: "Sede neutral" })}</label>

        <details className="mt-4 rounded-2xl border border-[var(--sc-border)] p-4">
          <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Valinnainen markkinavertailu", en: "Optional market benchmark", es: "Referencia de mercado opcional" })}</summary>
          <p className="mt-2 text-xs leading-6 text-[var(--sc-muted)]">{tr({ fi: "Anna kaikki kolme 1X2-kerrointa. Scorecaster poistaa marginaalin ja näyttää eron malliin.", en: "Enter all three 1X2 odds. Scorecaster removes the margin and shows the difference from the model.", es: "Introduce las tres cuotas 1X2. Scorecaster elimina el margen y muestra la diferencia." })}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-black text-[var(--sc-faint)]">1<input type="number" min="1.01" step="0.01" value={homeOdds} onChange={(event) => setHomeOdds(event.target.value)} className="sc-input mt-2" /></label>
            <label className="text-xs font-black text-[var(--sc-faint)]">X<input type="number" min="1.01" step="0.01" value={drawOdds} onChange={(event) => setDrawOdds(event.target.value)} className="sc-input mt-2" /></label>
            <label className="text-xs font-black text-[var(--sc-faint)]">2<input type="number" min="1.01" step="0.01" value={awayOdds} onChange={(event) => setAwayOdds(event.target.value)} className="sc-input mt-2" /></label>
          </div>
        </details>

        <button disabled={loading || !home.trim() || !away.trim()} className="sc-button-primary mt-5 disabled:opacity-40">{loading ? tr({ fi: "Lasketaan…", en: "Calculating…", es: "Calculando…" }) : tr({ fi: "Laske avoin 1X2-arvio", en: "Calculate open 1X2 estimate", es: "Calcular estimación 1X2" })}</button>
      </form>

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-sm text-rose-100">{error}</div>}

      {result && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{result.modelVersion}</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{result.teams.home} vs {result.teams.away}</h2></div><span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-100">baseline · observation only</span></div>
            <div className="mt-7"><ProbabilityBar result={result} /></div>
            {strongest && <p className="mt-5 text-sm leading-7 text-[var(--sc-muted)]">{tr({ fi: "Suurin yksittäinen lopputulos", en: "Largest single outcome", es: "Resultado individual mayor" })}: <strong className="text-[var(--sc-text)]">{strongest[0].toUpperCase()} {pct(strongest[1])}</strong></p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Home fair odds" value={num(result.fairOdds.home)} />
            <Metric label="Draw fair odds" value={num(result.fairOdds.draw)} />
            <Metric label="Away fair odds" value={num(result.fairOdds.away)} />
            <Metric label={tr({ fi: "Evidenssiluottamus", en: "Evidence confidence", es: "Confianza de evidencia" })} value={pct(result.components.evidenceQuality.confidence)} tone="warn" />
            <Metric label="Home xG" value={num(result.expectedGoals.home)} />
            <Metric label="Away xG" value={num(result.expectedGoals.away)} />
            <Metric label="Elo rating diff" value={num(result.components.eloDavidson.ratingDifference, 0)} />
            <Metric label="Poisson mass" value={pct(result.components.poisson.coveredProbabilityMass, 2)} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Todennäköisimmät tulokset", en: "Most likely scorelines", es: "Marcadores más probables" })}</h3>
              <div className="mt-4 space-y-2">{result.mostLikelyScorelines.map((row) => <div key={`${row.homeGoals}-${row.awayGoals}`} className="flex items-center justify-between rounded-xl bg-[var(--sc-surface-soft)] px-4 py-3"><span className="font-black text-[var(--sc-text)]">{row.homeGoals}–{row.awayGoals}</span><span className="text-sm font-bold text-[var(--sc-muted)]">{pct(row.probability)}</span></div>)}</div>
            </div>
            <div className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Vaikutustekijät", en: "Contributions", es: "Contribuciones" })}</h3>
              <div className="mt-4 space-y-2">{result.contributions.map((item) => <div key={item.id} className="rounded-xl bg-[var(--sc-surface-soft)] px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-[var(--sc-text)]">{item.id}</span><span className="text-xs font-black uppercase text-[var(--sc-brand)]">{item.direction}</span></div><div className="mt-1 text-xs text-[var(--sc-muted)]">{num(item.value, 3)} {item.unit || ""}</div></div>)}</div>
            </div>
          </section>

          {result.marketBenchmark && (
            <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
              <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Malli vastaan no-vig-markkina", en: "Model versus no-vig market", es: "Modelo frente al mercado no-vig" })}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">{["home", "draw", "away"].map((key) => <div key={key} className="rounded-2xl bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase text-[var(--sc-faint)]">{key}</div><div className="mt-2 text-sm text-[var(--sc-muted)]">Model {pct(result.probabilities[key])}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">Market {pct(result.marketBenchmark.probabilities[key])}</div><div className={`mt-2 text-lg font-black ${result.marketEdges[key] > 0 ? "text-emerald-200" : "text-rose-200"}`}>Edge {pct(result.marketEdges[key])}</div></div>)}</div>
              <p className="mt-4 text-xs text-[var(--sc-muted)]">Market overround before normalization: {pct(result.marketBenchmark.overround)}</p>
            </section>
          )}

          <section className="rounded-3xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 sm:p-6">
            <h3 className="text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Kaikki laskukaavat", en: "All formulas", es: "Todas las fórmulas" })}</h3>
            <div className="mt-4 space-y-2">{result.formulas.map((formula) => <code key={formula} className="block overflow-x-auto rounded-xl bg-[var(--sc-surface-soft)] p-3 text-xs leading-6 text-[var(--sc-text-secondary)]">{formula}</code>)}</div>
            <h4 className="mt-6 font-black text-[var(--sc-text)]">{tr({ fi: "Rajoitukset", en: "Limitations", es: "Limitaciones" })}</h4>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--sc-muted)]">{result.limitations.map((item) => <li key={item}>• {item}</li>)}</ul>
            <div className="mt-5 rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm text-[var(--sc-text-secondary)]"><strong className="text-[var(--sc-text)]">Public audit API:</strong> <code>/api/1x2?home=TEAM&amp;away=TEAM</code></div>
          </section>
        </div>
      )}
    </div>
  );
}
