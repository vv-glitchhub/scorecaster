import StatCard from "./components/StatCard";
import Panel from "./components/Panel";

const topPicks = [
  {
    match: "Tappara vs Ilves",
    pick: "Tappara ML",
    odds: "2.10",
    edge: "+7.4%",
    confidence: "Medium-high"
  },
  {
    match: "HIFK vs Kärpät",
    pick: "Under 5.5",
    odds: "1.92",
    edge: "+5.1%",
    confidence: "Medium"
  },
  {
    match: "Lukko vs TPS",
    pick: "Lukko -1.5",
    odds: "2.35",
    edge: "+4.8%",
    confidence: "Medium"
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl md:p-8">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
            AI-powered sports intelligence
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Scorecaster
          </h1>

          <p className="mt-4 text-lg text-slate-300">
            Betting analytics, market intelligence, simulations and autonomous
            AI learning agent.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="AI Bankroll"
          value="1000€"
          subtitle="Paper betting mode"
          tone="green"
        />
        <StatCard
          title="Top Edge"
          value="+7.4%"
          subtitle="Best model edge today"
          tone="blue"
        />
        <StatCard
          title="Open Bets"
          value="3"
          subtitle="AI monitored picks"
        />
        <StatCard
          title="Risk Level"
          value="Medium"
          subtitle="Market volatility"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="Top AI Picks" subtitle="Best detected opportunities today">
          <div className="space-y-3">
            {topPicks.map((pick) => (
              <div
                key={pick.match}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-bold">{pick.match}</div>
                    <div className="text-sm text-slate-400">{pick.pick}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-black text-emerald-300">
                      {pick.edge}
                    </div>
                    <div className="text-sm text-slate-400">@ {pick.odds}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-400">
                  Confidence: {pick.confidence}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Market Pulse" subtitle="Realtime market intelligence">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-white/[0.04] p-4">
              Sharp movement detected on Tappara ML.
            </div>
            <div className="rounded-xl bg-white/[0.04] p-4">
              Odds volatility: Medium-high.
            </div>
            <div className="rounded-xl bg-white/[0.04] p-4">
              Public market leaning too heavily on Ilves.
            </div>
          </div>
        </Panel>

        <Panel title="AI Agent Notes" subtitle="Learning system preview">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Agent is currently in paper betting mode with a 1000€ virtual
              bankroll.
            </p>
            <p>
              It will track predictions, results, CLV, mistakes and model
              weaknesses.
            </p>
            <p className="text-emerald-300">
              Next: connect real bet tracking and AI reasoning.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}
