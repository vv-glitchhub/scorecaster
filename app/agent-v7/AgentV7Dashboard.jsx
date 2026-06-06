"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function AgentV7Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/agent-v7-summary?bankroll=1000", {
          cache: "no-store"
        });
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const bestBets = summary?.bestBets || [];
  const watchlist = summary?.watchlist || [];
  const liveOpportunities = summary?.liveOpportunities || [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Agent V7 · Summary API
        </div>
        <h1 className="text-4xl font-black tracking-tight">Agent V7 Dashboard</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Päivän vedot, portfolio, live-signaalit ja järjestelmän tila yhdessä näkymässä.
        </p>
        <div className="mt-4 text-sm text-slate-400">
          {loading ? "Loading..." : `Updated ${summary?.generatedAt || ""}`}
          {error && <span className="ml-3 text-red-300">{error}</span>}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">System Health</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {summary?.health ? `${summary.health.passed}/${summary.health.total}` : "-"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Best Bets</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">{summary?.summary?.bestBets ?? "-"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Watchlist</div>
          <div className="mt-2 text-3xl font-black text-sky-300">{summary?.summary?.watchlist ?? "-"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Live Signals</div>
          <div className="mt-2 text-3xl font-black text-purple-300">{summary?.summary?.liveOpportunities ?? "-"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Allocated</div>
          <div className="mt-2 text-3xl font-black text-yellow-300">{money(summary?.summary?.allocated)}</div>
        </div>
      </section>

      <Panel title="Live Opportunities" subtitle="Agent V7 paper-only signals">
        <div className="space-y-3">
          {liveOpportunities.length === 0 && <div className="text-sm text-slate-400">No live opportunities above threshold.</div>}
          {liveOpportunities.map((item, index) => (
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
                  <div className="text-sm text-emerald-300">{money(item.suggestedLiveStake)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Best Bets" subtitle="Portfolio allocations">
        <div className="space-y-3">
          {bestBets.length === 0 && <div className="text-sm text-slate-400">No BET-level picks right now.</div>}
          {bestBets.map((pick, index) => (
            <div key={`${pick.selection}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-black text-white">{pick.selection}</div>
                  <div className="text-sm text-slate-400">{pick.homeTeam} vs {pick.awayTeam}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-emerald-300">{pick.decision}</div>
                  <div className="font-black text-white">{money(pick.suggestedStake)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Historical Odds" subtitle="Movement snapshot">
        <div className="grid gap-3 md:grid-cols-4 text-sm text-slate-300">
          <div>Snapshots: <span className="font-bold text-white">{summary?.historical?.summary?.count ?? 0}</span></div>
          <div>Games: <span className="font-bold text-white">{summary?.historical?.summary?.games ?? 0}</span></div>
          <div>Movement: <span className="font-bold text-sky-300">{summary?.historical?.movement?.movement || "unknown"}</span></div>
          <div>Score: <span className="font-bold text-white">{Number(summary?.historical?.movement?.movementScore || 0).toFixed(3)}</span></div>
        </div>
      </Panel>
    </div>
  );
}
