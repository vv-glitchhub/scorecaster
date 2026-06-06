"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";

export default function AgentV7Dashboard() {
  const [health, setHealth] = useState(null);
  const [daily, setDaily] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [healthRes, dailyRes, liveRes] = await Promise.all([
          fetch("/api/system-health", { cache: "no-store" }),
          fetch("/api/daily-picks?bankroll=1000", { cache: "no-store" }),
          fetch("/api/live-betting?bankroll=1000", { cache: "no-store" })
        ]);

        setHealth(await healthRes.json());
        setDaily(await dailyRes.json());
        setLive(await liveRes.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const bestBets = daily?.bestBets || [];
  const watchlist = daily?.watchlist || [];
  const liveOpportunities = live?.live?.opportunities || [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Agent V7 · Data Fusion
        </div>
        <h1 className="text-4xl font-black tracking-tight">Agent V7 Dashboard</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Päivän vedot, portfolio, live-signaalit ja järjestelmän tila yhdessä näkymässä.
        </p>
        <div className="mt-4 text-sm text-slate-400">
          {loading ? "Loading..." : "Loaded."}
          {error && <span className="ml-3 text-red-300">{error}</span>}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">System Health</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {health?.summary ? `${health.summary.passed}/${health.summary.total}` : "-"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Best Bets</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">{bestBets.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Watchlist</div>
          <div className="mt-2 text-3xl font-black text-sky-300">{watchlist.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Signals</div>
          <div className="mt-2 text-3xl font-black text-purple-300">{liveOpportunities.length}</div>
        </div>
      </section>

      <Panel title="Best Bets" subtitle="Agent V7 paper allocations">
        <div className="space-y-3">
          {bestBets.length === 0 && <div className="text-sm text-slate-400">No BET-level picks right now.</div>}
          {bestBets.slice(0, 8).map((pick, index) => (
            <div key={`${pick.selection}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-black text-white">{pick.selection}</div>
                  <div className="text-sm text-slate-400">{pick.homeTeam} vs {pick.awayTeam}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-emerald-300">{pick.decision}</div>
                  <div className="font-black text-white">{Number(pick.suggestedStake || 0).toFixed(2)} €</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Live Betting" subtitle="Paper-only live watch signals">
        <div className="space-y-3">
          {liveOpportunities.length === 0 && <div className="text-sm text-slate-400">No live opportunities above threshold.</div>}
          {liveOpportunities.slice(0, 8).map((item, index) => (
            <div key={`${item.selection}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-black text-white">{item.selection}</div>
                  <div className="text-sm text-slate-400">{item.homeTeam} vs {item.awayTeam}</div>
                  <div className="mt-2 text-sm text-slate-300">{item.trigger}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-purple-300">Live score</div>
                  <div className="font-black text-white">{Number(item.liveScore || 0).toFixed(3)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
