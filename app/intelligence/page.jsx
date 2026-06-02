import Panel from "../components/Panel";

const researchMatches = [
  {
    id: 1,
    league: "Liiga",
    match: "Tappara vs Ilves",
    market: "H2H",
    edge: "+7.4%",
    volatility: "Medium",
    thesis: "Market may be overreacting to Ilves recent form.",
    risks: ["Goalie confirmation", "Rivalry volatility", "Late line movement"]
  },
  {
    id: 2,
    league: "NHL",
    match: "Rangers vs Bruins",
    market: "H2H",
    edge: "+4.9%",
    volatility: "High",
    thesis: "Public side may be overpriced.",
    risks: ["High public volume", "Travel fatigue unclear", "Lineup uncertainty"]
  },
  {
    id: 3,
    league: "Football",
    match: "Arsenal vs Chelsea",
    market: "Totals",
    edge: "+3.8%",
    volatility: "Low",
    thesis: "Pace profile supports lower total than market expects.",
    risks: ["Early goal state", "Rotation", "Weather"]
  }
];

export default function IntelligencePage() {
  const selected = researchMatches[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Intelligence Terminal V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Research Workspace
        </h1>

        <p className="mt-3 text-slate-300">
          Tutki pelejä, rakenna oma vetoidea, vertaile bull/bear-casea ja
          tarkista riskit ennen panosta.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[300px_1fr_360px]">
        <Panel title="Match Explorer" subtitle="Research queue">
          <div className="space-y-3">
            {researchMatches.map((game) => (
              <div
                key={game.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">{game.league}</div>
                  <div className="text-xs text-slate-400">{game.market}</div>
                </div>

                <div className="mt-2 font-bold">{game.match}</div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-emerald-300">{game.edge}</span>
                  <span className="text-slate-400">{game.volatility}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Match Intelligence" subtitle="Selected research case">
          <div className="space-y-5">
            <div>
              <div className="text-2xl font-black">{selected.match}</div>
              <div className="mt-1 text-sm text-slate-400">
                {selected.league} · {selected.market} · Research mode
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Detected Edge</div>
                <div className="mt-2 text-2xl font-black text-emerald-300">
                  {selected.edge}
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Volatility</div>
                <div className="mt-2 text-2xl font-black text-yellow-300">
                  {selected.volatility}
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Confidence</div>
                <div className="mt-2 text-2xl font-black">Medium</div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-sm text-slate-400">Action</div>
                <div className="mt-2 text-2xl font-black text-sky-300">
                  Watch
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div className="font-bold text-sky-300">AI Thesis</div>
              <p className="mt-2 text-sm text-slate-300">{selected.thesis}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="font-bold text-emerald-300">Bull Case</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>• Current market price may be inefficient.</li>
                  <li>• Model edge is positive before final confirmation.</li>
                  <li>• Waiting for better odds can improve CLV.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                <div className="font-bold text-red-300">Bear Case</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {selected.risks.map((risk) => (
                    <li key={risk}>• {risk}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="font-bold text-yellow-300">
                Pre-bet Checklist
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>• Confirm lineup / goalie / starting players.</li>
                <li>• Check if odds moved against the thesis.</li>
                <li>• Compare stake size against bankroll risk.</li>
                <li>• Avoid betting if motivation is emotional recovery.</li>
              </ul>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Research Notes" subtitle="Manual thinking area">
            <textarea
              className="min-h-44 w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-200 outline-none placeholder:text-slate-500"
              placeholder="Kirjoita oma vetoidea, riski tai havainto tähän..."
            />

            <button className="mt-4 w-full rounded-xl bg-purple-400 px-4 py-3 font-bold text-slate-950 hover:bg-purple-300">
              Save Research Idea
            </button>
          </Panel>

          <Panel title="V1 Limitation" subtitle="Important">
            <p className="text-sm text-slate-300">
              Intelligence V1 on tutkimusnäkymä. Seuraava versio yhdistää
              suoraan oikeat ottelut Betting Workspacesta ja tallentaa käyttäjän
              research-notesit.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
