"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { addTrackedBet, getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { calculateAgentScore } from "../../lib/agent-score";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

const AGENT_BANKROLL = 1000;

function getStake(edge, agentScore) {
  const baseStake = AGENT_BANKROLL * 0.015;
  const edgeBonus = Math.max(0, Number(edge || 0)) * AGENT_BANKROLL * 0.12;
  const scoreBonus = Math.max(0, Number(agentScore || 0)) * AGENT_BANKROLL * 0.08;

  return Math.min(baseStake + edgeBonus + scoreBonus, AGENT_BANKROLL * 0.05);
}

function getAgentDecision(pick) {
  if (!pick) return "No decision";

  if (pick.agentScore >= 0.1) return "Strong paper pick";
  if (pick.agentScore >= 0.06) return "Paper pick";
  if (pick.agentScore >= 0.03) return "Watchlist";
  return "No bet";
}

function getAgentReasoning(pick) {
  return [
    `Model detected ${formatPercent(pick.edge)} raw edge.`,
    `EV is ${formatPercent(pick.ev)}.`,
    `Learning boost is ${formatPercent(pick.confidenceBoost)} from previous tracking history.`,
    `Final agent score is ${formatPercent(pick.agentScore)}.`,
    `Best bookmaker: ${pick.bookmaker || "unknown"}.`,
    "Agent uses paper betting only and does not place real money bets."
  ];
}

export default function AgentClient() {
  const [picks, setPicks] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadAgentPicks() {
      try {
        const trackedBets = getTrackedBets();
        const learningData = calculateAgentPerformance(trackedBets);
        setLearning(learningData);

        const res = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await res.json();

        const rawPicks = Array.isArray(data.data) ? data.data : [];

        const scoredPicks = rawPicks
          .map((pick) => {
            const score = calculateAgentScore({
              pick,
              learning: learningData
            });

            return {
              ...pick,
              ...score
            };
          })
          .sort((a, b) => b.agentScore - a.agentScore);

        setPicks(scoredPicks);
        setSource(data.source || "api");
      } catch {
        setSource("error");
      } finally {
        setLoading(false);
      }
    }

    loadAgentPicks();
  }, []);

  function addPickToTracking(pick) {
    const stake = getStake(pick.edge, pick.agentScore);

    addTrackedBet({
      match: pick.match,
      selection: pick.selection,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      edge: pick.edge,
      ev: pick.ev,
      stake,
      bankroll: AGENT_BANKROLL,
      kellyMode: "agent-paper",
      source: "AI Agent V3",
      sportKey: pick.sportKey,
      marketKey: pick.marketKey,
      league: pick.league,
      leagueTitle: pick.leagueTitle,
      agentScore: pick.agentScore,
      confidenceBoost: pick.confidenceBoost,
      riskLevel: "Paper",
      riskWarnings: [
        "AI Agent uses paper betting only.",
        "This is a learning signal, not a guaranteed profitable bet."
      ]
    });

    setMessage(`${pick.selection} added to tracking as Agent V3 paper pick.`);
  }

  const agentPicks = picks.filter((pick) => pick.agentScore >= 0.03);
  const topPick = agentPicks[0];

  const totalStake = agentPicks.reduce(
    (sum, pick) => sum + getStake(pick.edge, pick.agentScore),
    0
  );

  const bestSport =
    learning &&
    Object.entries(learning.bySport || {}).sort(
      (a, b) => b[1].profit - a[1].profit
    )[0];

  const bestMarket =
    learning &&
    Object.entries(learning.byMarket || {}).sort(
      (a, b) => b[1].profit - a[1].profit
    )[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          AI Agent V3 · Learning Mode
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Autonomous Learning Agent
        </h1>

        <p className="mt-3 text-slate-300">
          Agentti hakee live-pickit `/api/top-picks`-rajapinnasta, lukee
          tracking-historian ja painottaa kohteita sen mukaan missä se on
          aiemmin onnistunut.
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          Source: <span className="font-bold text-emerald-300">{source}</span>
          {loading && <span className="ml-2 text-yellow-300">Loading...</span>}
          {learning && (
            <span className="ml-3 text-slate-400">
              Learning sample:{" "}
              <span className="font-bold text-sky-300">
                {learning.sampleSize}
              </span>{" "}
              settled bets
            </span>
          )}
          {!loading && picks.length === 0 && (
            <div className="mt-2 text-red-300">
              Agentti ei löytänyt live-kohteita juuri nyt.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Paper Bankroll</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(AGENT_BANKROLL)}
          </div>
          <div className="mt-1 text-sm text-slate-500">Agent mode</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Candidates</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {picks.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">From API</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Agent Picks</div>
          <div className="mt-2 text-3xl font-black text-purple-300">
            {agentPicks.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">Score ≥ 3%</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Planned Exposure</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {formatMoney(totalStake)}
          </div>
          <div className="mt-1 text-sm text-slate-500">If all tracked</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_370px]">
        <Panel title="Agent Ranked Picks" subtitle="Live data + learning score">
          <div className="space-y-4">
            {loading && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Loading agent picks...
              </div>
            )}

            {!loading && agentPicks.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                No agent-grade picks right now.
              </div>
            )}

            {agentPicks.map((pick, index) => {
              const stake = getStake(pick.edge, pick.agentScore);
              const decision = getAgentDecision(pick);

              return (
                <div
                  key={`${pick.match}-${pick.selection}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xl font-black">{pick.match}</div>

                      <div className="mt-2 text-sm text-slate-400">
                        {pick.leagueTitle || pick.sportTitle || pick.league} ·{" "}
                        {pick.selection} @ {pick.odds}
                      </div>

                      <div className="mt-1 text-sm text-emerald-300">
                        Best bookmaker: {pick.bookmaker || "unknown"}
                      </div>

                      <div className="mt-3 font-bold text-purple-300">
                        Agent Score {formatPercent(pick.agentScore)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                      <div className="text-sm text-slate-400">Paper Stake</div>
                      <div className="mt-1 text-xl font-black">
                        {formatMoney(stake)}
                      </div>
                      <div className="mt-2 text-sm text-purple-300">
                        {decision}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Raw Edge</div>
                      <div className="mt-2 text-xl font-black text-emerald-300">
                        {formatPercent(pick.edge)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">EV</div>
                      <div className="mt-2 text-xl font-black text-sky-300">
                        {formatPercent(pick.ev)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Learning Boost</div>
                      <div
                        className={`mt-2 text-xl font-black ${
                          pick.confidenceBoost >= 0
                            ? "text-emerald-300"
                            : "text-red-300"
                        }`}
                      >
                        {formatPercent(pick.confidenceBoost)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Confidence</div>
                      <div className="mt-2 text-xl font-black">
                        {pick.confidence || "Medium"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
                    <div className="font-bold text-sky-300">Agent Reasoning</div>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {getAgentReasoning(pick).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => addPickToTracking(pick)}
                    className="mt-5 w-full rounded-xl bg-purple-400 px-4 py-3 font-bold text-slate-950 hover:bg-purple-300"
                  >
                    Add Agent Pick To Tracking
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Agent Learning Memory" subtitle="What the agent has learned">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Learning sample:{" "}
                <span className="font-bold text-sky-300">
                  {learning?.sampleSize || 0}
                </span>{" "}
                settled bets.
              </div>

              <div className="rounded-xl bg-emerald-400/10 p-4">
                Best sport:{" "}
                <span className="font-bold text-emerald-300">
                  {bestSport ? bestSport[0] : "not enough data"}
                </span>
              </div>

              <div className="rounded-xl bg-purple-400/10 p-4">
                Best market:{" "}
                <span className="font-bold text-purple-300">
                  {bestMarket ? bestMarket[0] : "not enough data"}
                </span>
              </div>

              <div className="rounded-xl bg-yellow-400/10 p-4">
                Agent V3 adjusts ranking, not real money staking. It remains
                paper mode.
              </div>
            </div>
          </Panel>

          <Panel title="Best Current Pick" subtitle="Highest ranked agent idea">
            {!topPick ? (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                No top pick available.
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="font-bold">{topPick.match}</div>
                  <div className="mt-1 text-slate-400">
                    {topPick.selection} @ {topPick.odds}
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-400/10 p-4">
                  Agent Score:{" "}
                  <span className="font-bold text-emerald-300">
                    {formatPercent(topPick.agentScore)}
                  </span>
                </div>
              </div>
            )}
          </Panel>

          {message && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">
              {message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
