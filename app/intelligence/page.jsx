import Panel from "../components/Panel";

const matches = [
  {
    id: 1,
    league: "Liiga",
    match: "Tappara vs Ilves",
    time: "19:30",
    edge: "+7.4%",
    volatility: "Medium",
    status: "Upcoming"
  },
  {
    id: 2,
    league: "NHL",
    match: "Rangers vs Bruins",
    time: "02:00",
    edge: "+5.8%",
    volatility: "High",
    status: "Upcoming"
  },
  {
    id: 3,
    league: "Premier League",
    match: "Arsenal vs Chelsea",
    time: "18:00",
    edge: "+4.2%",
    volatility: "Low",
    status: "Upcoming"
  }
];

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Research Workspace
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Intelligence Terminal
        </h1>

        <p className="mt-3 text-slate-300">
          Tutki pelejä, markkinoita, AI-perusteluja, riskejä ja omia vetoideoita.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[300px_1fr_360px]">
        <Panel title="Match Explorer" subtitle="Browse games and markets">
          <div className="space-y-3">
            {matches.map((game) => (
              <button
                key={game.id}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">{game.league}</div>
                  <div className="text-xs text-slate-400">{game.time}</div>
                </div>

                <div className="mt-2 font-bold">{game.match}</div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-emerald-300">{game.edge}</span>
                  <span className="text-slate-400">{game.volatility}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Match Intelligence" subtitle="Selected market deep dive">
          <div className="space-y-5">
            <div>
              <div className="text-2xl font-black">Tappara vs Ilves</div>
              <div className="mt-1 text-sm text-slate-400">
                Liiga · Moneyline · Upcoming
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Model Prob.</div>
                <div className="mt-2 text-2xl font-black text-emerald-300">
                  55%
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Market Prob.</div>
                <div className="mt-2 text-2xl font-black">47.6%</div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">EV</div>
                <div className="mt-2 text-2xl font-black text-sky-300">
                  +11%
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Confidence</div>
                <div className="mt-2 text-2xl font-black">Medium+</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="font-bold text-emerald-300">
                  Why market may be wrong
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>• Market may overreact to Ilves recent win.</li>
                  <li>• Tappara has stronger rest advantage.</li>
                  <li>• Defensive matchup favors Tappara.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="font-bold text-red-300">Main risks</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>• Goalie confirmation still uncertain.</li>
                  <li>• Rivalry game increases volatility.</li>
                  <li>• Late line movement needs monitoring.</li>
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div className="font-bold text-sky-300">AI Thesis</div>
              <p className="mt-2 text-sm text-slate-300">
                Tappara ML has value if the market continues to price Ilves too
                strongly based on recent form. The edge depends mostly on rest
                advantage, matchup quality and closing odds behavior.
              </p>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="AI Analyst" subtitle="Bull case vs risk case">
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                <div className="font-bold text-emerald-300">Bull case</div>
                <p className="mt-2">
                  Tappara has stronger fundamentals and market edge appears
                  positive at current odds.
                </p>
              </div>

              <div className="rounded-xl bg-red-400/10 p-4">
                <div className="font-bold text-red-300">Bear case</div>
                <p className="mt-2">
                  If goalie news moves against Tappara, confidence should drop
                  immediately.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="My Research Notes" subtitle="Save your own ideas">
            <textarea
              className="min-h-40 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none placeholder:text-slate-500"
              placeholder="Kirjoita oma analyysi tai vetoidea tähän..."
            />

            <button className="mt-4 w-full rounded-xl bg-purple-400 px-4 py-3 font-bold text-slate-950 hover:bg-purple-300">
              Save Research Idea
            </button>
          </Panel>
        </div>
      </section>
    </div>
  );
}
