import Panel from "../components/Panel";
import {
  createAgentPick,
  settleAgentPick,
  summarizeAgent
} from "../../lib/agent-engine";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

const rawPicks = [
  createAgentPick({
    id: 1,
    match: "Tappara vs Ilves",
    league: "Liiga",
    market: "Moneyline",
    selection: "Tappara ML",
    odds: 2.1,
    modelProbability: 0.55,
    volatility: "medium",
    reasoning: [
      "Tappara has stronger rest advantage.",
      "Market may be overreacting to Ilves recent form.",
      "Defensive matchup slightly favors Tappara."
    ]
  }),
  createAgentPick({
    id: 2,
    match: "HIFK vs Kärpät",
    league: "Liiga",
    market: "Totals",
    selection: "Under 5.5",
    odds: 1.92,
    modelProbability: 0.56,
    volatility: "medium",
    reasoning: [
      "Both teams trending lower tempo.",
      "Recent goalie form supports under.",
      "Market total appears slightly inflated."
    ]
  }),
  createAgentPick({
    id: 3,
    match: "Rangers vs Bruins",
    league: "NHL",
    market: "Moneyline",
    selection: "Bruins ML",
    odds: 2.25,
    modelProbability: 0.5,
    volatility: "high",
    reasoning: [
      "Public money appears heavy on Rangers.",
      "Bruins matchup quality better than market price.",
      "High volatility limits stake size."
    ]
  })
];

const picks = [
  settleAgentPick(rawPicks[0], "win"),
  settleAgentPick(rawPicks[1], "loss"),
  rawPicks[2]
];

export default function AgentPage() {
  const summary = summarizeAgent(picks);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Autonomous Paper Betting
        </div>

        <h1 className="text-4xl font-black tracking-tight">AI Agent</h1>

        <p className="mt-3 text-slate-300">
          Agentti käyttää 1000€ leikkirahaa, tekee paper-vetoja, seuraa tuloksia
          ja oppii virheistään.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Agent Bankroll</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(summary.bankroll)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Start: {formatMoney(summary.startingBankroll)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Profit / Loss</div>
          <div
            className={`mt-2 text-3xl font-black ${
              summary.totalProfit >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatMoney(summary.totalProfit)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Settled: {summary.settledPicks}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Win Rate</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(summary.winRate)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {summary.wins}W / {summary.losses}L
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Pending Picks</div>
          <div className="mt-2 text-3xl font-black">
            {summary.pendingPicks}
          </div>
          <div className="mt-1 text-sm text-slate-500">Awaiting results</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Agent Picks" subtitle="Autonomous paper betting decisions">
          <div className="space-y-4">
            {picks.map((pick) => (
              <div
                key={pick.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xl font-black">{pick.match}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {pick.league} · {pick.market}
                    </div>
                    <div className="mt-3 text-lg font-bold text-emerald-300">
                      {pick.selection} @ {pick.odds}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950 p-4 text-right">
                    <div className="text-sm text-slate-400">Stake</div>
                    <div className="mt-1 text-2xl font-black">
                      {formatMoney(pick.suggestedStake)}
                    </div>
                    <div className="mt-2 text-sm capitalize text-slate-400">
                      {pick.status}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Model Prob.</div>
                    <div className="mt-2 text-xl font-black">
                      {formatPercent(pick.modelProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Market Prob.</div>
                    <div className="mt-2 text-xl font-black">
                      {formatPercent(pick.marketProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Edge</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatPercent(pick.edge)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Confidence</div>
                    <div className="mt-2 text-xl font-black">
                      {pick.confidence}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
                  <div className="font-bold text-sky-300">Reasoning</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {pick.reasoning.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                {pick.lesson && (
                  <div className="mt-5 rounded-xl border border-purple-400/20 bg-purple-400/5 p-4">
                    <div className="font-bold text-purple-300">
                      Lesson Learned
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {pick.lesson.summary}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {pick.lesson.futureAdjustment}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Agent Memory" subtitle="What the AI is learning">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Strongest current area: Liiga moneyline markets.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Weakness detected: high-volatility rivalry games.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Next adjustment: lower stake size when lineup uncertainty is high.
              </div>
            </div>
          </Panel>

          <Panel title="Daily Agent Report" subtitle="Auto-generated summary">
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Agent found 3 possible value spots. Two were settled and one is
                still pending.
              </p>
              <p>
                The model performed well when market edge aligned with rest and
                matchup factors.
              </p>
              <p className="text-emerald-300">
                Current priority: improve confidence scoring before increasing
                stake sizes.
              </p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
