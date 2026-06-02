import Panel from "../components/Panel";
import {
  simulateMatch,
  compareToMarket,
  formatNumber
} from "../../lib/simulator-engine";
import { formatPercent } from "../../lib/analysis-engine";

const simulations = [
  {
    odds: 2.1,
    data: simulateMatch({
      homeTeam: "Tappara",
      awayTeam: "Ilves",
      homeRating: 58,
      awayRating: 54,
      homeAdvantage: 3
    })
  },
  {
    odds: 1.92,
    data: simulateMatch({
      homeTeam: "HIFK",
      awayTeam: "Kärpät",
      homeRating: 52,
      awayRating: 51,
      homeAdvantage: 3
    })
  },
  {
    odds: 2.25,
    data: simulateMatch({
      homeTeam: "Rangers",
      awayTeam: "Bruins",
      homeRating: 53,
      awayRating: 56,
      homeAdvantage: 3
    })
  }
];

export default function SimulatorPage() {
  const main = simulations[0].data;
  const market = compareToMarket(main.homeWinProbability, simulations[0].odds);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Simulator V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Match Simulation Engine
        </h1>

        <p className="mt-3 text-slate-300">
          Simuloi otteluita, vertaa mallin todennäköisyyttä markkinan implied
          probabilityyn ja löydä mahdollinen edge.
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
          <div className="text-sm text-slate-400">Model Prob.</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatPercent(market.modelProbability)}
          </div>
          <div className="mt-1 text-sm text-slate-500">{main.homeTeam}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Market Prob.</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(market.marketProbability)}
          </div>
          <div className="mt-1 text-sm text-slate-500">@ {simulations[0].odds}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Simulation Edge</div>
          <div
            className={`mt-2 text-3xl font-black ${
              market.edge >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatPercent(market.edge)}
          </div>
          <div className="mt-1 text-sm text-slate-500">Model vs market</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Simulation Results" subtitle="Projected outcomes">
          <div className="space-y-4">
            {simulations.map((item) => {
              const sim = item.data;
              const edge = compareToMarket(sim.homeWinProbability, item.odds);

              return (
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
                      <div className="text-sm text-slate-400">
                        Projected Score
                      </div>
                      <div className="mt-1 text-xl font-black">
                        {formatNumber(sim.averageHomeScore)} -{" "}
                        {formatNumber(sim.averageAwayScore)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-5">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">
                        {sim.homeTeam} Win
                      </div>
                      <div className="mt-2 text-xl font-black text-emerald-300">
                        {formatPercent(sim.homeWinProbability)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">
                        {sim.awayTeam} Win
                      </div>
                      <div className="mt-2 text-xl font-black text-sky-300">
                        {formatPercent(sim.awayWinProbability)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Draw</div>
                      <div className="mt-2 text-xl font-black">
                        {formatPercent(sim.drawProbability)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Total</div>
                      <div className="mt-2 text-xl font-black text-yellow-300">
                        {formatNumber(sim.projectedTotal)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Edge</div>
                      <div
                        className={`mt-2 text-xl font-black ${
                          edge.edge >= 0 ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {formatPercent(edge.edge)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="AI Simulation Notes" subtitle="Model interpretation">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Simulation layer estimates fair probability before comparing
                against bookmaker odds.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Positive simulation edge means model probability is higher than
                market implied probability.
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4">
                Next upgrade: connect live odds and selected match data directly
                from Betting Workspace.
              </div>
            </div>
          </Panel>

          <Panel title="V1 Limitation" subtitle="Important">
            <p className="text-sm text-slate-300">
              Simulator V1 uses simplified ratings and random scoring. It is not
              yet a full predictive model. Real team data, injuries, fatigue and
              form are future upgrades.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
