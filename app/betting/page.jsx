import Panel from "../components/Panel";

const matches = [
  {
    id: 1,
    home: "Tappara",
    away: "Ilves",
    market: "Moneyline",
    homeOdds: 2.1,
    awayOdds: 1.8,
    edge: "+7.4%",
    ev: "+11%",
    confidence: "Medium-high"
  },
  {
    id: 2,
    home: "HIFK",
    away: "Kärpät",
    market: "Totals",
    homeOdds: 1.92,
    awayOdds: 1.92,
    edge: "+5.1%",
    ev: "+8%",
    confidence: "Medium"
  },
  {
    id: 3,
    home: "Lukko",
    away: "TPS",
    market: "Handicap",
    homeOdds: 2.35,
    awayOdds: 1.62,
    edge: "+4.8%",
    ev: "+6%",
    confidence: "Medium"
  }
];

export default function BettingPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
              Betting Workspace
            </div>

            <h1 className="text-4xl font-black tracking-tight">
              AI Betting Terminal
            </h1>

            <p className="mt-3 text-slate-300">
              Analyze markets, detect value, compare odds and track AI edge.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
              H2H
            </button>

            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
              Totals
            </button>

            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
              Handicap
            </button>

            <button className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300">
              Live
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xl font-black">
                    {match.home} vs {match.away}
                  </div>

                  <div className="mt-2 text-sm text-slate-400">
                    {match.market}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 hover:bg-white/[0.08]">
                    <div className="text-sm text-slate-400">
                      {match.home}
                    </div>

                    <div className="mt-1 text-lg font-black">
                      {match.homeOdds}
                    </div>
                  </button>

                  <button className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 hover:bg-white/[0.08]">
                    <div className="text-sm text-slate-400">
                      {match.away}
                    </div>

                    <div className="mt-1 text-lg font-black">
                      {match.awayOdds}
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="text-sm text-slate-400">AI Edge</div>

                  <div className="mt-2 text-2xl font-black text-emerald-300">
                    {match.edge}
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="text-sm text-slate-400">Expected Value</div>

                  <div className="mt-2 text-2xl font-black text-sky-300">
                    {match.ev}
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="text-sm text-slate-400">Confidence</div>

                  <div className="mt-2 text-2xl font-black">
                    {match.confidence}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-slate-300">
                <span className="font-bold text-emerald-300">
                  AI Analysis:
                </span>{" "}
                Market may be undervaluing recent fatigue impact and defensive
                matchup edge.
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <Panel
            title="Bet Slip"
            subtitle="AI-assisted bankroll management"
          >
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="font-bold">
                  Tappara ML
                </div>

                <div className="mt-1 text-sm text-slate-400">
                  Odds: 2.10
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="text-sm text-slate-400">
                    Suggested Stake
                  </div>

                  <div className="mt-2 text-xl font-black text-emerald-300">
                    35€
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="text-sm text-slate-400">
                    Kelly %
                  </div>

                  <div className="mt-2 text-xl font-black text-sky-300">
                    3.5%
                  </div>
                </div>
              </div>

              <button className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-300">
                Add To Bet Slip
              </button>
            </div>
          </Panel>

          <Panel
            title="Market Pulse"
            subtitle="Realtime intelligence"
          >
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Sharp money detected on Tappara ML.
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                Market volatility increasing rapidly.
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                Public heavily backing Ilves.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
