import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import { DEFAULT_BANKROLL_SETTINGS, calculateDailyExposureLimit, calculateStakeLimit, calculateLeagueExposureLimit } from '../../lib/production-risk-rules';

export default function RiskPage() {
  const settings = DEFAULT_BANKROLL_SETTINGS;
  const maxStake = calculateStakeLimit(settings);
  const maxDailyExposure = calculateDailyExposureLimit(settings);
  const maxLeagueExposure = calculateLeagueExposureLimit(settings);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Production Risk Layer
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          Bankroll, exposure and responsible decision controls.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          This page defines the default Scorecaster safety rules. The system should prefer SKIP over forcing a weak pick.
          Betting decisions must stay inside bankroll, edge, confidence and exposure limits.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Default Bankroll" value={`€${settings.bankroll}`} subtitle="Paper mode default" tone="green" />
        <StatCard title="Max Single Stake" value={`€${maxStake.toFixed(2)}`} subtitle={`${settings.maxStakePercent}% bankroll`} tone="blue" />
        <StatCard title="Daily Exposure" value={`€${maxDailyExposure.toFixed(2)}`} subtitle={`${settings.maxDailyExposurePercent}% bankroll`} />
        <StatCard title="League Exposure" value={`€${maxLeagueExposure.toFixed(2)}`} subtitle={`${settings.maxSingleLeagueExposurePercent}% bankroll`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Risk Decision Logic" subtitle="OK / CAUTION / SKIP">
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-2xl bg-emerald-400/10 p-4 text-emerald-200">OK: edge, confidence, stake and exposure are inside limits.</div>
            <div className="rounded-2xl bg-yellow-400/10 p-4 text-yellow-100">CAUTION: pick is possible, but confidence or league exposure needs attention.</div>
            <div className="rounded-2xl bg-red-400/10 p-4 text-red-100">SKIP: edge is too weak, stake is too large or daily exposure would be exceeded.</div>
          </div>
        </Panel>

        <Panel title="Responsible Use Rules" subtitle="No chasing, no guarantees">
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-2xl bg-white/[0.04] p-4">Scorecaster must show risk before stake.</div>
            <div className="rounded-2xl bg-white/[0.04] p-4">The agent must be allowed to say no bet.</div>
            <div className="rounded-2xl bg-white/[0.04] p-4">Paper trading mode should be the default for new users.</div>
            <div className="rounded-2xl bg-white/[0.04] p-4">The app should never promise guaranteed profit.</div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
