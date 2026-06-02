import Panel from "../components/Panel";

const liveSignals = [
  {
    id: 1,
    match: "Tappara vs Ilves",
    league: "Liiga",
    market: "H2H",
    movement: "2.10 → 1.92",
    direction: "down",
    signal: "Sharp movement",
    volatility: "High",
    alert: "Tappara price is dropping quickly. Market may be correcting."
  },
  {
    id: 2,
    match: "HIFK vs Kärpät",
    league: "Liiga",
    market: "Totals",
    movement: "1.82 → 1.95",
    direction: "up",
    signal: "Total drift",
    volatility: "Medium",
    alert: "Under price is improving. Wait for confirmation before entry."
  },
  {
    id: 3,
    match: "Rangers vs Bruins",
    league: "NHL",
    market: "H2H",
    movement: "2.35 → 2.20",
    direction: "down",
    signal: "Public fade",
    volatility: "High",
    alert: "Market moving against public side. Possible value signal."
  }
];

function directionClass(direction) {
  if (direction === "up") return "text-emerald-300";
  if (direction === "down") return "text-red-300";
  return "text-slate-300";
}

export default function LivePage() {
  const highVolatility = liveSignals.filter(
    (item) => item.volatility === "High"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-sm text-red-300">
          Live Market Pulse V1
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Realtime Intelligence
        </h1>

        <p className="mt-3 text-slate-300">
          Seuraa kertoimien liikettä, volatiliteettia, markkinahälytyksiä ja
          mahdollisia live-value signaaleja.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Signals</div>
          <div className="mt-2 text-3xl font-black text-red-300">
            {liveSignals.length}
          </div>
          <div className="mt-1 text-sm text-slate-500">Active alerts</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">High Volatility</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">
            {highVolatility}
          </div>
          <div className="mt-1 text-sm text-slate-500">Risky markets</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Best Action</div>
          <div className="mt-2 text-3xl font-black text-sky-300">Watch</div>
          <div className="mt-1 text-sm text-slate-500">Do not force bets</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Mode</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">V1</div>
          <div className="mt-1 text-sm text-slate-500">Static intelligence layer</div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Live Market Signals" subtitle="Line movement and volatility">
          <div className="space-y-4">
            {liveSignals.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xl font-black">{item.match}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {item.league} · {item.market}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 px-4 py-3 text-right">
                    <div className="text-sm text-slate-400">Movement</div>
                    <div
                      className={`mt-1 text-xl font-black ${directionClass(
                        item.direction
                      )}`}
                    >
                      {item.movement}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Signal</div>
                    <div className="mt-2 text-xl font-black">{item.signal}</div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">Volatility</div>
                    <div className="mt-2 text-xl font-black text-yellow-300">
                      {item.volatility}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <div className="text-sm text-slate-400">AI Alert</div>
                    <div className="mt-2 text-sm text-slate-300">
                      {item.alert}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Market Pulse Summary" subtitle="AI interpretation">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-red-400/10 p-4">
                High volatility means position sizing should stay conservative.
              </div>
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Price movement can reveal market correction before final result.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Best workflow: detect movement here, confirm edge in Betting,
                then track the bet.
              </div>
            </div>
          </Panel>

          <Panel title="V1 Limitation" subtitle="Important">
            <p className="text-sm text-slate-300">
              Live Pulse V1 is a static intelligence view. Next upgrade connects
              directly to Betting Workspace snapshots and real odds movement
              history.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
