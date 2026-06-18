import Panel from "../components/Panel";
import { formatPercent } from "../../lib/analysis-engine";
import { predictFixtures } from "../../lib/prediction-slip-engine";

async function getMonteCarlo() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const response = await fetch(`${siteUrl}/api/monte-carlo?simulations=10000&bankroll=1000`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message, result: {} };
  }
}

const worldCupFixtures = [
  { homeTeam: "Brazil", awayTeam: "Germany", homeRating: 60, awayRating: 58 },
  { homeTeam: "France", awayTeam: "Argentina", homeRating: 61, awayRating: 60 },
  { homeTeam: "Spain", awayTeam: "Netherlands", homeRating: 59, awayRating: 57 },
  { homeTeam: "USA", awayTeam: "Japan", homeRating: 54, awayRating: 53 },
  { homeTeam: "England", awayTeam: "Portugal", homeRating: 59, awayRating: 58 },
  { homeTeam: "Croatia", awayTeam: "Belgium", homeRating: 55, awayRating: 55 }
];

const predictions = predictFixtures(worldCupFixtures);

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default async function SimulatorPage() {
  const monteCarlo = await getMonteCarlo();
  const result = monteCarlo?.result || {};
  const bankroll = result?.bankrollSimulation || {};
  const ci = result?.confidenceIntervals || {};
  const interpretation = result?.interpretation || {};

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-8">
        <div className="mb-3 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-300">
          Simulator V2 · Monte Carlo
        </div>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Monte Carlo Risk Lab</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          10 000 simulation paper-trading risk model for bankroll range, risk of ruin, confidence intervals and portfolio outcomes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Simulations" value={result?.input?.simulations || 10000} subtitle="Monte Carlo runs" />
        <Card title="Mean Bankroll" value={money(bankroll.mean)} subtitle="Expected paper outcome" />
        <Card title="Risk of Ruin" value={formatPercent(bankroll.riskOfRuin || 0)} subtitle={`Threshold ${money(bankroll.ruinThreshold)}`} />
        <Card title="95% Range" value={`${money(ci.bankroll95?.low)} - ${money(ci.bankroll95?.high)}`} subtitle="Confidence interval" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Portfolio Monte Carlo" subtitle="Bankroll outcome distribution">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Metric label="Median" value={money(bankroll.median)} />
            <Metric label="P05" value={money(bankroll.p05)} />
            <Metric label="P95" value={money(bankroll.p95)} />
            <Metric label="Std Dev" value={money(bankroll.standardDeviation)} />
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Interpretation</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              {(interpretation.notes || ["No simulation notes available."]).map((note, index) => (
                <div key={index} className="rounded-xl bg-white/[0.04] p-3">{note}</div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Simulation Inputs" subtitle="Current model setup">
          <div className="space-y-3 text-sm text-slate-300">
            <Metric label="Bankroll" value={money(result?.input?.bankroll)} />
            <Metric label="Picks" value={result?.input?.picks || 0} />
            <Metric label="Mode" value={monteCarlo?.mode || "portfolio"} />
            <Metric label="Source" value={monteCarlo?.source || "unknown"} />
          </div>
        </Panel>
      </section>

      <Panel title="Match Prediction Slip" subtitle="Classic fixture probability model">
        <div className="space-y-4">
          {predictions.map((game) => (
            <div key={`${game.homeTeam}-${game.awayTeam}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xl font-black">{game.homeTeam} vs {game.awayTeam}</div>
                  <div className="mt-1 text-sm text-slate-400">Projected score: {game.projectedScore}</div>
                </div>
                <div className="rounded-xl bg-slate-950 px-6 py-4 text-center">
                  <div className="text-sm text-slate-400">Merkki</div>
                  <div className="mt-1 text-4xl font-black text-emerald-300">{game.prediction}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Metric label="1" value={formatPercent(game.homeWinProbability)} />
                <Metric label="X" value={formatPercent(game.drawProbability)} />
                <Metric label="2" value={formatPercent(game.awayWinProbability)} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-950 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-black text-sky-300">{value}</div>
    </div>
  );
}
