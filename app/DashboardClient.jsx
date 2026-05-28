"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";
import Panel from "./components/Panel";

const modules = [
  { title: "Betting Workspace", href: "/betting", description: "Analyze odds, EV, Kelly, edge and bet slip.", tag: "Core" },
  { title: "Intelligence Terminal", href: "/intelligence", description: "Research matches, risks, AI thesis and market ideas.", tag: "Research" },
  { title: "Live Market Pulse", href: "/live", description: "Track line movement, volatility and live signals.", tag: "Realtime" },
  { title: "Simulator", href: "/simulator", description: "Run match simulations and probability models.", tag: "Model" },
  { title: "Tracking", href: "/tracking", description: "Follow bankroll, ROI, CLV and bet history.", tag: "Performance" },
  { title: "AI Agent", href: "/agent", description: "Paper betting agent with 1000€ virtual bankroll.", tag: "Autonomous" }
];

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DashboardClient() {
  const [topPicks, setTopPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");

  useEffect(() => {
    async function loadTopPicks() {
      try {
        const res = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await res.json();

        setTopPicks(Array.isArray(data.data) ? data.data : []);
        setSource(data.source || "api");
      } catch (error) {
        setSource("error");
      } finally {
        setLoading(false);
      }
    }

    loadTopPicks();
  }, []);

  const bestEdge = topPicks[0]?.edge ? formatPercent(topPicks[0].edge) : "-";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl md:p-8">
        <div className="max-w-4xl">
          <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
            AI-powered sports intelligence
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Scorecaster Command Center
          </h1>

          <p className="mt-4 text-lg text-slate-300">
            Yksi näkymä vedonlyöntianalyysiin, markkinasignaaleihin,
            simulointiin, seurantaan ja autonomiseen AI-agenttiin.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/betting"
              className="rounded-xl bg-emerald-400 px-5 py-3 text-center font-bold text-slate-950 hover:bg-emerald-300"
            >
              Open Betting Workspace
            </Link>

            <Link
              href="/intelligence"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
            >
              Open Intelligence Terminal
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="AI Bankroll" value="1000€" subtitle="Paper betting mode" tone="green" />
        <StatCard title="Top Edge" value={bestEdge} subtitle="Best model edge today" tone="blue" />
        <StatCard title="Top Picks" value={String(topPicks.length)} subtitle={`Source: ${source}`} />
        <StatCard title="System Mode" value={loading ? "Loading" : "Live"} subtitle="API connected" tone="green" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Scorecaster Modules" subtitle="Choose your workflow">
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.08]"
              >
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {module.tag}
                </div>

                <div className="text-xl font-black">{module.title}</div>

                <p className="mt-2 text-sm text-slate-400">
                  {module.description}
                </p>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Top AI Picks" subtitle="Best detected opportunities">
            <div className="space-y-3">
              {loading && (
                <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                  Loading top picks...
                </div>
              )}

              {!loading && topPicks.length === 0 && (
                <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                  Ei löytynyt top pickejä juuri nyt.
                </div>
              )}

              {topPicks.slice(0, 5).map((pick, index) => (
                <div
                  key={`${pick.match}-${pick.selection}-${index}`}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="text-xs text-slate-500">
                    {pick.leagueTitle}
                  </div>
                  <div className="mt-1 font-bold">{pick.match}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {pick.selection} @ {pick.odds}
                  </div>
                  <div className="mt-3 font-black text-emerald-300">
                    Edge {formatPercent(pick.edge)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="System Status" subtitle="Current mode">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Multi-sport odds API connected.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Market engine V2 active: H2H, spreads and totals.
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4">
                Next: save selected bets into tracking/Supabase.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
