import Panel from "../components/Panel";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

const startingBankroll = 1000;
const unitSize = 25;

const picks = [
  {
    id: 1,
    match: "Tappara vs Ilves",
    selection: "Tappara ML",
    odds: 2.1,
    edge: 0.074,
    confidence: "Medium-high",
    stake: 25,
    result: "win",
    reasoning: [
      "Market may be overreacting to Ilves recent form.",
      "Tappara has rest advantage.",
      "Home-side price appears inefficient."
    ],
    lesson:
      "Model read the market correctly. Rest advantage and market overreaction were useful signals."
  },
  {
    id: 2,
    match: "HIFK vs Kärpät",
    selection: "Under 5.5",
    odds: 1.92,
    edge: 0.051,
    confidence: "Medium",
    stake: 20,
    result: "loss",
    reasoning: [
      "Pace projected lower than market expectation.",
      "Goalie form supported under.",
      "Total looked slightly inflated."
    ],
    lesson:
      "Model underestimated late-game scoring volatility. Totals need stronger volatility adjustment."
  },
  {
    id: 3,
    match: "Rangers vs Bruins",
    selection: "Bruins ML",
    odds: 2.25,
    edge: 0.049,
    confidence: "Medium",
    stake: 15,
    result: "pending",
    reasoning: [
      "Public money appears heavy on Rangers.",
      "Bruins matchup profile is stronger than price suggests.",
      "High volatility keeps stake lower."
    ],
    lesson: null
  }
];

function calculateProfit(pick) {
  if (pick.result === "win") return pick.stake * (pick.odds - 1);
  if (pick.result === "loss") return -pick.stake;
  return 0;
}

function getStats() {
  const settled = picks.filter((pick) => pick.result !== "pending");
  const wins = settled.filter((pick) => pick.result === "win");
  const totalStake = settled.reduce((sum, pick) => sum + pick.stake, 0);
  const profit = settled.reduce((sum, pick) => sum + calculateProfit(pick), 0);

  return {
    bankroll: startingBankroll + profit,
    profit,
    totalPicks: picks.length,
    pending: picks.filter((pick) => pick.result === "pending").length,
    winRate: settled.length ? wins.length / settled.length : 0,
    roi: totalStake ? profit / totalStake : 0
  };
}

export default function AgentPage() {
  const stats = getStats();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          AI Paper Betting Agent
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Autonomous Agent
        </h1>

        <p className="mt-3 text-slate-300">
          Agentti käyttää 1000€ paper-bankrollia, tekee omia vetoideoita,
          seuraa tuloksia ja muodostaa oppimismuistiota.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Agent Bankroll</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(stats.bankroll)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Start: {formatMoney(startingBankroll)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Profit</div>
          <div
            className={`mt-2 text-3xl font-black ${
              stats.profit >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatMoney(stats.profit)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            ROI {formatPercent(stats.roi)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Win Rate</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(stats.winRate)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Settled picks only
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Pending Picks</div>
          <div className="mt-2 text-3xl font-black">
            {stats.pending}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Total: {stats.totalPicks}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_370px]">
        <Panel title="Agent Picks" subtitle="Paper betting decisions and reasoning">
          <div className="space-y-4">
            {picks.map((pick) => {
              const profit = calculateProfit(pick);

              return (
                <div
                  key={pick.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xl font-black">{pick.match}</div>
                      <div className="mt-2 text-sm text-slate-400">
                        {pick.selection} @ {pick.odds}
                      </div>
                      <div className="mt-3 font-bold text-emerald-300">
                        Edge {formatPercent(pick.edge)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                      <div className="text-sm text-slate-400">Stake</div>
                      <div className="mt-1 text-xl font-black">
                        {formatMoney(pick.stake)}
                      </div>
                      <div className="mt-2 text-sm capitalize text-slate-400">
                        {pick.result}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Confidence</div>
                      <div className="mt-2 text-xl font-black">
                        {pick.confidence}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Profit</div>
                      <div
                        className={`mt-2 text-xl font-black ${
                          profit >= 0 ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {pick.result === "pending" ? "-" : formatMoney(profit)}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4">
                      <div className="text-sm text-slate-400">Mode</div>
                      <div className="mt-2 text-xl font-black text-purple-300">
                        Paper
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
                        {pick.lesson}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Daily Agent Report" subtitle="Auto-generated summary">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Agent found 3 value candidates and controlled stake sizing.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Best current signal: market overreaction + positive edge.
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4">
                Main weakness: volatility handling in totals markets.
              </div>
            </div>
          </Panel>

          <Panel title="Agent Memory" subtitle="Learning foundation">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Strong area: moneyline markets with clear market overreaction.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Weak area: high-variance totals without late-game adjustment.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Next upgrade: connect agent picks to real `/api/top-picks`.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
