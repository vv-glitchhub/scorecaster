import Panel from "../components/Panel";
import {
  simulateMatch,
  formatPercent,
  formatNumber
} from "../../lib/simulator-engine";

const simulations = [
  simulateMatch({
    homeTeam: "Tappara",
    awayTeam: "Ilves",
    homeRating: 58,
    awayRating: 54
  }),
  simulateMatch({
    homeTeam: "HIFK",
    awayTeam: "Kärpät",
    homeRating: 52,
    awayRating: 51
  }),
  simulateMatch({
    homeTeam: "Rangers",
    awayTeam: "Bruins",
    homeRating: 53,
    awayRating: 56
  })
];

export default function SimulatorPage() {
  const main = simulations[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Monte Carlo Simulator
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Match Simulator
        </h1>

        <p className="mt-3 text-slate-300">
          Simuloi otteluita, arvioi voittotodennäköisyyksiä ja löydä markkinan mahdollisia virheitä.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Simulations</div>
          <div className="mt-2 text-3xl font-black">
            {main.simulations.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-slate-500">Per matchup</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Home Win</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatPercent(main.homeWinProbability)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {main.homeTeam}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Away Win</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(main.awayWinProbability)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {main.awayTeam}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Upset Risk</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {formatPercent(main.upsetRisk)}
          </div>
          <div className="mt-1 text-sm text-slate-500">Model variance</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Simulation Results" subtitle="10 000 simulated games per matchup">
          <div className="space-y-4">
            {simulations.map((sim) => (
              <div
                key={`${sim.homeTeam}-${sim.awayTeam}`}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xl font-black">
                      {sim.homeTeam} vs {sim.awayTeam}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Monte Carlo · {sim.simulations.toLocaleString()} runs
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                    <div className="text-sm text-slate-400">Projected Score</div>
                    <div className="mt-1 text-xl font-black">
                      {formatNumber(sim.averageHomeScore)} - {formatNumber(sim.averageAwayScore)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">{sim.homeTeam} Win</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatPercent(sim.homeWinProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">{sim.awayTeam} Win</div>
                    <div className="mt-2 text-xl font-black text-sky-300">
                      {formatPercent(sim.awayWinProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Overtime</div>
                    <div className="mt-2 text-xl font-black">
                      {formatPercent(sim.overtimeProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Upset Risk</div>
                    <div className="mt-2 text-xl font-black text-yellow-300">
                      {formatPercent(sim.upsetRisk)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="AI Simulation Notes" subtitle="Model interpretation">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Tappara projects as stronger but upset risk remains meaningful.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Rangers vs Bruins shows away-side model advantage.
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4">
                High overtime probability can reduce confidence in moneyline bets.
              </div>
            </div>
          </Panel>

          <Panel title="Next Simulator Upgrade" subtitle="Future engine">
            <div className="space-y-3 text-sm text-slate-300">
              <p>Next version should include team form, injuries, goalie data, fatigue and odds comparison.</p>
              <p className="text-emerald-300">
                Goal: compare simulation probability against bookmaker implied probability.
              </p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
