"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { addTrackedBet, getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { calculateAgentScore } from "../../lib/agent-score";
import { buildAgentV5Pick } from "../../lib/agent-v5-engine";
import { enrichPickWithLiveIntelligence } from "../../lib/agent-intelligence-loader";
import { reportToMarkdown } from "../../lib/agent-report-engine";
import { saveAgentReport } from "../../lib/report-storage";
import { createDailyAgentBriefing } from "../../lib/daily-briefing-engine";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

const AGENT_BANKROLL = 1000;

function getStake(edge, finalScore) {
  const baseStake = AGENT_BANKROLL * 0.01;
  const edgeBonus = Math.max(0, Number(edge || 0)) * AGENT_BANKROLL * 0.1;
  const scoreBonus =
    Math.max(0, Number(finalScore || 0)) * AGENT_BANKROLL * 0.08;

  return Math.min(baseStake + edgeBonus + scoreBonus, AGENT_BANKROLL * 0.04);
}

function getDecisionColor(decision) {
  if (decision === "BET") return "text-emerald-300";
  if (decision === "WATCH") return "text-sky-300";
  if (decision === "WAIT") return "text-yellow-300";
  return "text-red-300";
}

function getDecisionBorder(decision) {
  if (decision === "BET") return "border-emerald-400/30 bg-emerald-400/10";
  if (decision === "WATCH") return "border-sky-400/30 bg-sky-400/10";
  if (decision === "WAIT") return "border-yellow-400/30 bg-yellow-400/10";
  return "border-red-400/30 bg-red-400/10";
}

function getReadinessColor(level) {
  if (level === "High") return "text-emerald-300";
  if (level === "Medium") return "text-yellow-300";
  return "text-red-300";
}

function createDefaultContext() {
  return {
    form: 1,
    injuries: 0,
    fatigue: 0,
    motivation: 1,
    lineup: 0,
    travel: 0,
    weather: 0,
    news: [],
    sources: [
      { type: "odds_market", name: "Odds market" },
      { type: "betting_media", name: "Betting market signal" }
    ]
  };
}

export default function AgentClient() {
  const [picks, setPicks] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [message, setMessage] = useState("");
  const [expandedReportId, setExpandedReportId] = useState(null);

  useEffect(() => {
    async function loadAgentPicks() {
      try {
        const trackedBets = getTrackedBets();
        const learningData = calculateAgentPerformance(trackedBets);
        setLearning(learningData);

        const res = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await res.json();
        const rawPicks = Array.isArray(data.data) ? data.data : [];

        const v5Picks = rawPicks.map((pick) => {
          const score = calculateAgentScore({
            pick,
            learning: learningData
          });

          return buildAgentV5Pick({
            pick: {
              ...pick,
              ...score
            },
            learningBoost: score.confidenceBoost,
            movementSignal: pick.movementSignal || "Stable",
            contextInput: createDefaultContext(),
            marketInput: {
              clv: pick.clv || 0,
              polymarketDifference: pick.polymarketDifference || 0
            },
            newsItems: pick.newsItems || [],
            injuries: pick.injuries || [],
            lineup: {
              startersConfirmed: Boolean(pick.startersConfirmed),
              goalieConfirmed: Boolean(pick.goalieConfirmed),
              keyPlayersAvailable: pick.keyPlayersAvailable !== false,
              lineupStability: Number(pick.lineupStability || 0)
            }
          });
        });

        const enrichedPicks = await Promise.all(
          v5Picks.map((pick) => enrichPickWithLiveIntelligence(pick))
        );

        setPicks(enrichedPicks.sort((a, b) => b.finalScore - a.finalScore));
        setSource(data.source || "api");
      } catch (error) {
        setSource("error");
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadAgentPicks();
  }, []);

  function addPickToTracking(pick) {
    const stake = getStake(pick.edge, pick.finalScore);

    addTrackedBet({
      match: pick.match,
      selection: pick.selection,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      edge: pick.edge,
      ev: pick.ev,
      stake,
      bankroll: AGENT_BANKROLL,
      kellyMode: "agent-v5-paper",
      source: "AI Agent V5",
      sportKey: pick.sportKey,
      marketKey: pick.marketKey,
      league: pick.league,
      leagueTitle: pick.leagueTitle,
      agentScore: pick.finalScore,
      confidenceBoost: pick.confidenceBoost,
      decision: pick.decision,
      decisionReason: pick.decisionReason,
      sourceTrust: pick.sourceTrust,
      contextScore: pick.context?.contextScore,
      marketScore: pick.marketScore,
      intelligenceScore: pick.intelligenceScore,
      newsScore: pick.newsScore,
      injuryScore: pick.injuryScore,
      lineupScore: pick.lineupScore,
      readinessLevel: pick.readiness?.level,
      readinessScore: pick.readiness?.score,
      missingData: pick.readiness?.missing || [],
      riskLevel: pick.riskLevel,
      riskWarnings: [
        "AI Agent V5 uses paper betting only.",
        "Decision is based on model, context, market intelligence, live intelligence, news, injuries, lineup, data readiness, learning and risk rules.",
        "This is not a guaranteed profitable bet."
      ]
    });

    setMessage(`${pick.selection} added to tracking as Agent V5 paper pick.`);
  }

  async function copyReport(pick) {
    const markdown = reportToMarkdown(pick.report);
    await navigator.clipboard.writeText(markdown);
    setMessage("Agent report copied.");
  }

  function saveReport(pick) {
    saveAgentReport(pick.report);
    setMessage("Agent report saved.");
  }

  const actionablePicks = picks.filter((pick) =>
    ["BET", "WATCH", "WAIT"].includes(pick.decision)
  );

  const betCount = picks.filter((pick) => pick.decision === "BET").length;
  const watchCount = picks.filter((pick) => pick.decision === "WATCH").length;
  const waitCount = picks.filter((pick) => pick.decision === "WAIT").length;
  const passCount = picks.filter((pick) => pick.decision === "PASS").length;

  const totalStake = picks
    .filter((pick) => pick.decision === "BET")
    .reduce((sum, pick) => sum + getStake(pick.edge, pick.finalScore), 0);

  const topPick = picks[0];
  const briefing = createDailyAgentBriefing(picks);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          AI Agent V5 · Live Intelligence
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Autonomous Intelligence Agent
        </h1>

        <p className="mt-3 text-slate-300">
          Agentti yhdistää live-kertoimet, learningin, kontekstin,
          markkinasignaalit, data readinessin, uutiset, loukkaantumiset,
          kokoonpanot ja intelligence API:n.
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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">BET</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {betCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Planned stake {formatMoney(totalStake)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">WATCH</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {watchCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">Potential value</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">WAIT</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {waitCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">Needs confirmation</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">PASS</div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {passCount}
          </div>
          <div className="mt-1 text-sm text-slate-500">No clear advantage</div>
        </div>
      </section>

      <Panel title="Daily Agent Briefing" subtitle="Today's decision summary">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Total Picks</div>
            <div className="mt-2 text-2xl font-black">{briefing.total}</div>
          </div>

          <div className="rounded-xl bg-emerald-400/10 p-4">
            <div className="text-sm text-slate-400">BET</div>
            <div className="mt-2 text-2xl font-black text-emerald-300">
              {briefing.betCount}
            </div>
          </div>

          <div className="rounded-xl bg-sky-400/10 p-4">
            <div className="text-sm text-slate-400">WATCH</div>
            <div className="mt-2 text-2xl font-black text-sky-300">
              {briefing.watchCount}
            </div>
          </div>

          <div className="rounded-xl bg-red-400/10 p-4">
            <div className="text-sm text-slate-400">Low Data</div>
            <div className="mt-2 text-2xl font-black text-red-300">
              {briefing.lowReadinessCount}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-slate-300">
          {briefing.summary}
        </div>

        {briefing.bestPick && (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-slate-300">
            Best case:{" "}
            <span className="font-bold text-emerald-300">
              {briefing.bestPick.match}
            </span>{" "}
            — {briefing.bestPick.selection} @ {briefing.bestPick.odds}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 lg:grid-cols-[1fr_370px]">
        <Panel title="Agent Decisions" subtitle="Ranked live picks with reports">
          <div className="space-y-4">
            {loading && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Loading agent decisions...
              </div>
            )}

            {!loading && actionablePicks.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                No actionable picks right now.
              </div>
            )}

            {actionablePicks.map((pick, index) => {
              const stake = getStake(pick.edge, pick.finalScore);
              const expanded = expandedReportId === pick.id;

              return (
                <div
                  key={pick.id || `${pick.match}-${pick.selection}-${index}`}
                  className={`rounded-2xl border p-5 ${getDecisionBorder(
                    pick.decision
                  )}`}
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

                      <div
                        className={`mt-3 text-2xl font-black ${getDecisionColor(
                          pick.decision
                        )}`}
                      >
                        {pick.decision}
                      </div>

                      <div className="mt-2 text-sm text-slate-300">
                        {pick.decisionReason}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                      <div className="text-sm text-slate-400">Paper Stake</div>
                      <div className="mt-1 text-xl font-black">
                        {pick.decision === "BET" ? formatMoney(stake) : "-"}
                      </div>
                      <div className="mt-2 text-sm text-purple-300">
                        V5 Score {formatPercent(pick.finalScore)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-6">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Edge</div>
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
                      <div className="text-sm text-slate-400">Context</div>
                      <div className="mt-2 text-xl font-black text-yellow-300">
                        {formatPercent(pick.context?.contextScore || 0)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Market</div>
                      <div className="mt-2 text-xl font-black text-purple-300">
                        {formatPercent(pick.marketScore || 0)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Intel</div>
                      <div className="mt-2 text-xl font-black text-emerald-300">
                        {formatPercent(pick.intelligenceScore || 0)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Data</div>
                      <div
                        className={`mt-2 text-xl font-black ${getReadinessColor(
                          pick.readiness?.level
                        )}`}
                      >
                        {pick.readiness?.level || "Low"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <div className="font-bold text-emerald-300">
                      Live Intelligence Notes
                    </div>

                    <ul className="mt-3 space-y-1 text-sm text-slate-300">
                      {(pick.intelligenceNotes || []).map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
                    <div className="font-bold text-purple-300">
                      Market Intelligence
                    </div>

                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {(pick.marketNotes || []).map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                    <div className="font-bold text-yellow-300">
                      Data Readiness
                    </div>

                    <p className="mt-2 text-sm text-slate-300">
                      {pick.readinessRecommendation}
                    </p>

                    {pick.readiness?.missing?.length > 0 && (
                      <div className="mt-3 text-sm text-slate-400">
                        Missing data:{" "}
                        <span className="font-bold text-red-300">
                          {pick.readiness.missing.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {pick.decision === "BET" && (
                      <button
                        onClick={() => addPickToTracking(pick)}
                        className="rounded-xl bg-purple-400 px-4 py-3 font-bold text-slate-950 hover:bg-purple-300"
                      >
                        Add BET To Tracking
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setExpandedReportId(expanded ? null : pick.id)
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-slate-300 hover:bg-white/10"
                    >
                      {expanded ? "Hide Report" : "Show Report"}
                    </button>

                    <button
                      onClick={() => copyReport(pick)}
                      className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 font-bold text-sky-300 hover:bg-sky-400/20"
                    >
                      Copy Report
                    </button>

                    <button
                      onClick={() => saveReport(pick)}
                      className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-3 font-bold text-purple-300 hover:bg-purple-400/20"
                    >
                      Save Report
                    </button>
                  </div>

                  {expanded && (
                    <pre className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-slate-300">
                      {reportToMarkdown(pick.report)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Best Current Case" subtitle="Highest ranked V5 decision">
            {!topPick ? (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                No pick available.
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="font-bold">{topPick.match}</div>
                  <div className="mt-1 text-slate-400">
                    {topPick.selection} @ {topPick.odds}
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${getDecisionBorder(
                    topPick.decision
                  )}`}
                >
                  Decision:{" "}
                  <span
                    className={`font-bold ${getDecisionColor(
                      topPick.decision
                    )}`}
                  >
                    {topPick.decision}
                  </span>
                </div>

                <div className="rounded-xl bg-purple-400/10 p-4">
                  Final Score:{" "}
                  <span className="font-bold text-purple-300">
                    {formatPercent(topPick.finalScore)}
                  </span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Agent V5 Logic" subtitle="What changed">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Agent now calls the Intelligence API for each pick.
              </div>

              <div className="rounded-xl bg-sky-400/10 p-4">
                Intelligence loader is ready for real news, injury, lineup and
                Polymarket APIs.
              </div>

              <div className="rounded-xl bg-yellow-400/10 p-4">
                Placeholder fetchers return safe empty data until real APIs are
                connected.
              </div>
            </div>
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
