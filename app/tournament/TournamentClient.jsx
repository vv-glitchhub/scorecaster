"use client";

import { useState } from "react";
import Panel from "../components/Panel";
import { simulateTournament, runSingleTournament } from "../../lib/tournament-engine";
import { formatPercent } from "../../lib/analysis-engine";

const defaultTeamsText = [
  "France,61",
  "Japan,53",
  "Brazil,60",
  "Netherlands,57",
  "Argentina,60",
  "USA,54",
  "Germany,58",
  "Spain,59"
].join("\n");

function parseTeams(text) {
  return text
    .split("\n")
    .map((line) => line.split(",").map((item) => item.trim()))
    .filter((parts) => parts.length >= 2 && parts[0])
    .map(([name, rating = 55]) => ({
      name,
      rating: Number(rating || 55)
    }));
}

export default function TournamentClient() {
  const [teamsText, setTeamsText] = useState(defaultTeamsText);
  const [runs, setRuns] = useState(1000);

  const teams = parseTeams(teamsText);
  const validBracket = teams.length > 1 && teams.length % 2 === 0;

  const results = validBracket
    ? simulateTournament({ teams, simulations: Number(runs || 1000) })
    : [];

  const exampleBracket = validBracket ? runSingleTournament(teams) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Tournament Simulator V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Tournament Simulator
        </h1>

        <p className="mt-3 text-slate-300">
          Syötä joukkueet ja ratingit. Scorecaster simuloi turnauksen ja arvioi
          mestaritodennäköisyydet.
        </p>
      </section>

      <Panel title="Tournament Setup" subtitle="Yksi joukkue per rivi">
        <textarea
          value={teamsText}
          onChange={(event) => setTeamsText(event.target.value)}
          className="min-h-48 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none"
          placeholder="Finland,56"
        />

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
            Simulation runs
          </div>

          <input
            type="number"
            min="100"
            step="100"
            value={runs}
            onChange={(event) => setRuns(Number(event.target.value || 1000))}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
          />
        </div>

        {!validBracket && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
            Turnauksessa pitää olla parillinen määrä joukkueita.
          </div>
        )}
      </Panel>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Champion Probabilities" subtitle="Simulated tournament results">
          <div className="space-y-3">
            {results.map((team) => (
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

        <div className="space-y-6">
          <Panel title="Example Bracket" subtitle="One simulated path">
            {!exampleBracket ? (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Syötä kelvollinen turnaus.
              </div>
            ) : (
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
            )}
          </Panel>

          <Panel title="V1 Notes" subtitle="Important">
            <p className="text-sm text-slate-300">
              Tournament V1 käyttää yksinkertaista rating-mallia. Seuraavaksi
              voidaan lisätä lohkovaihe, rankingit, oikeat otteluohjelmat ja
              live-kertoimet.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
