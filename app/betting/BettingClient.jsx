"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import {
  analyzeBet,
  formatPercent,
  formatMoney
} from "../../lib/analysis-engine";

const fallbackMatches = [
  {
    id: "demo-1",
    home_team: "Tappara",
    away_team: "Ilves",
    sport_title: "Liiga",
    bookmakers: [
      {
        title: "DemoBook",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Tappara", price: 2.1 },
              { name: "Ilves", price: 1.8 }
            ]
          }
        ]
      }
    ]
  }
];

function getMainMarket(match) {
  return match?.bookmakers?.[0]?.markets?.[0];
}

export default function BettingClient() {
  const [matches, setMatches] = useState(fallbackMatches);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("demo");

  useEffect(() => {
    async function loadOdds() {
      try {
        const res = await fetch("/api/odds?sport=icehockey_nhl", {
          cache: "no-store"
        });

        const data = await res.json();

        const games = Array.isArray(data) ? data : data.data || data.events || [];

        if (games.length > 0) {
          setMatches(games);
          setSource(data.source || "api");
        }
      } catch (error) {
        setSource("fallback");
      } finally {
        setLoading(false);
      }
    }

    loadOdds();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Betting Workspace
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          AI Betting Terminal
        </h1>

        <p className="mt-3 text-slate-300">
          Real odds data, value detection, EV, Kelly and AI-ready market analysis.
        </p>

        <div className="mt-4 text-sm text-slate-400">
          Data source: <span className="text-emerald-300">{source}</span>
          {loading && <span className="ml-2 text-yellow-300">Loading...</span>}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-4">
          {matches.map((match, index) => {
            const market = getMainMarket(match);
            const outcomes = market?.outcomes || [];
            const home = match.home_team || match.home || "Home";
            const away = match.away_team || match.away || "Away";
            const homeOutcome =
              outcomes.find((outcome) => outcome.name === home) || outcomes[0];
            const awayOutcome =
              outcomes.find((outcome) => outcome.name === away) || outcomes[1];

            const homeOdds = Number(homeOutcome?.price || 2.0);
            const modelProbability = 0.55;

            const analysis = analyzeBet({
              selection: home,
              decimalOdds: homeOdds,
              modelProbability,
              volatility: "medium",
              bankroll: 1000
            });

            return (
              <div
                key={match.id || `${home}-${away}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xl font-black">
                      {home} vs {away}
                    </div>

                    <div className="mt-2 text-sm text-slate-400">
                      {match.sport_title || match.league || "Sport"} ·{" "}
                      {market?.key || "h2h"}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 hover:bg-white/[0.08]">
                      <div className="text-sm text-slate-400">{home}</div>
                      <div className="mt-1 text-lg font-black">{homeOdds}</div>
                    </button>

                    <button className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 hover:bg-white/[0.08]">
                      <div className="text-sm text-slate-400">{away}</div>
                      <div className="mt-1 text-lg font-black">
                        {awayOutcome?.price || "-"}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Market Prob.</div>
                    <div className="mt-2 text-2xl font-black">
                      {formatPercent(analysis.marketProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">AI Edge</div>
                    <div className="mt-2 text-2xl font-black text-emerald-300">
                      {formatPercent(analysis.edge)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">EV</div>
                    <div className="mt-2 text-2xl font-black text-sky-300">
                      {formatPercent(analysis.ev)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Stake</div>
                    <div className="mt-2 text-2xl font-black">
                      {formatMoney(analysis.suggestedStake)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-slate-300">
                  <span className="font-bold text-emerald-300">
                    AI Analysis:
                  </span>{" "}
                  Current model estimates {home} at{" "}
                  {formatPercent(modelProbability)}. Market implied probability is{" "}
                  {formatPercent(analysis.marketProbability)}.
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel title="Bet Slip" subtitle="AI-assisted bankroll management">
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="font-bold">Selected bet preview</div>
                <div className="mt-1 text-sm text-slate-400">
                  Click handling comes next.
                </div>
              </div>

              <button className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-300">
                Add To Bet Slip
              </button>
            </div>
          </Panel>

          <Panel title="Next Upgrade" subtitle="Interactive betting">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Select odds into bet slip.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Add manual stake input.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Save bet to tracking.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
