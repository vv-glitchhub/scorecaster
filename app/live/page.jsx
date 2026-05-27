import Panel from "../components/Panel";

const liveSignals = [
  {
    id: 1,
    match: "Tappara vs Ilves",
    league: "Liiga",
    market: "Moneyline",
    movement: "2.10 → 1.92",
    signal: "Sharp movement",
    volatility: "High",
    alert: "Odds dropping fast on Tappara ML"
  },
  {
    id: 2,
    match: "HIFK vs Kärpät",
    league: "Liiga",
    market: "Total 5.5",
    movement: "1.82 → 1.95",
    signal: "Total drift",
    volatility: "Medium",
    alert: "Under price improving"
  },
  {
    id: 3,
    match: "Rangers vs Bruins",
    league: "NHL",
    market: "Moneyline",
    movement: "2.35 → 2.20",
    signal: "Public fade",
    volatility: "High",
    alert: "Market moving against public side"
  }
];

export default function LivePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-sm text-red-300">
          Live Market Pulse
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Realtime Intelligence
        </h1>

        <p className="mt-3 text-slate-300">
          Seuraa kertoimien liikettä, markkinavolatiliteettia ja AI:n löytämiä live-signaaleja.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Signals</div>
          <div className="mt-2 text-3xl font-black text-red-300">12</div>
          <div className="mt-1 text-sm text-slate-500">Detected today</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Sharp Moves</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">4</div>
          <div className="mt-1 text-sm text-slate-500">High confidence</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Volatility</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">High</div>
          <div className="mt-1 text-sm text-slate-500">Market unstable</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Value</div>
          <div className="mt-2 text-3xl font-black text-sky-300">3</div>
          <div className="mt-1 text-sm text-slate-500">Possible spots</div>
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
                    <div className="mt-1 text-xl font-black text-emerald-300">
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
                High volatility detected in Liiga markets.
              </div>
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Sharp movement appears strongest on Tappara ML.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Best current strategy: wait for confirmation before increasing stake.
              </div>
            </div>
          </Panel>

          <Panel title="Alert Feed" subtitle="Realtime warnings">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Tappara odds moved more than 8% in short window.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Public/market disagreement detected in NHL moneyline.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Total market drifting upward despite low-tempo trend.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
