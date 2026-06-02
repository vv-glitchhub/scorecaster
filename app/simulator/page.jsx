import Panel from "../components/Panel";
import {
  simulateMatch,
  compareToMarket,
  formatNumber
} from "../../lib/simulator-engine";
import { simulateTournament, runSingleTournament } from "../../lib/tournament-engine";
import { formatPercent } from "../../lib/analysis-engine";

const simulations = [
  {
    odds: 2.1,
    data: simulateMatch({
      homeTeam: "Carolina Hurricanes",
      awayTeam: "Vegas Golden Knights",
      homeRating: 58,
      awayRating: 55,
      homeAdvantage: 3
    })
  },
  {
    odds: 1.85,
    data: simulateMatch({
      homeTeam: "Brazil",
      awayTeam: "Germany",
      homeRating: 60,
      awayRating: 58,
      homeAdvantage: 0
    })
  },
  {
    odds: 2.05,
    data: simulateMatch({
      homeTeam: "France",
      awayTeam: "Argentina",
      homeRating: 61,
      awayRating: 60,
      homeAdvantage: 0
    })
  }
];

const worldCupTeams = [
  { name: "France", rating: 61 },
  { name: "Japan", rating: 53 },
  { name: "Brazil", rating: 60 },
  { name: "Netherlands", rating: 57 },
  { name: "Argentina", rating: 60 },
  { name: "USA", rating: 54 },
  { name: "Germany", rating: 58 },
  { name: "Spain", rating: 59 }
];

const tournamentResults = simulateTournament({
  teams: worldCupTeams,
  simulations: 1000
});

const exampleBracket = runSingleTournament(worldCupTeams);

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
          Match & Tournament Simulator
        </h1>

        <p className="mt-3 text-slate-300">
          Simuloi yksittäisiä otteluita ja koko turnauksia, kuten MM-kisojen
          pudotuspelipuuta.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Match Simulations</div>
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
          <div className="text-sm text-slate-400">Tournament Runs</div>
          <div className="mt-2 text-3xl font-black text-sky-300">1,000</div>
          <div className="mt-1 text-sm text-slate-500">World Cup example</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Top Champion</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {tournamentResults[0]?.team}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatPercent(tournamentResults[0]?.championProbability)}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Match Simulation Results" subtitle="Single-game probability model">
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
                      <div className="text-sm text-slate-400">Projected Score</div>
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
          <Panel title="World Cup Tournament" subtitle="Champion probabilities">
            <div className="space-y-3">
              {tournamentResults.slice(0, 8).map((team) => (
                <div
                  key={team.team}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{team.team}</div>
                    <div className="text-sm text-slate-400">
                      Rating {team.rating}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-slate-500">Semi</div>
                      <div className="font-bold text-sky-300">
                        {formatPercent(team.semifinalProbability)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Final</div>
                      <div className="font-bold text-purple-300">
                        {formatPercent(team.finalProbability)}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Win</div>
                      <div className="font-bold text-emerald-300">
                        {formatPercent(team.championProbability)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Example Bracket" subtitle="One simulated tournament path">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Semifinalists: {exampleBracket.semifinalists.join(", ")}
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Finalists: {exampleBracket.finalists.join(", ")}
              </div>
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Champion:{" "}
                <span className="font-bold text-emerald-300">
                  {exampleBracket.champion}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <Panel title="V1 Limitation" subtitle="Important">
        <p className="text-sm text-slate-300">
          Turnaussimulaattori käyttää vielä yksinkertaistettuja rating-arvoja.
          Seuraavassa versiossa mukaan lisätään oikea joukkueformaatti,
          lohkovaihe, loukkaantumiset, lepo, matkustus, kokoonpanot ja live-kertoimet.
        </p>
      </Panel>
    </div>
  );
}
