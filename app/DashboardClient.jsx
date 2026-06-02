"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "./components/StatCard";
import Panel from "./components/Panel";
import { getTrackedBets } from "../lib/tracking-storage";
import { calculateTrackingStats } from "../lib/tracking-engine";
import { formatMoney, formatPercent } from "../lib/analysis-engine";

const modules = [
  {
    title: "Betting Workspace",
    href: "/betting",
    description: "Live odds, EV, Kelly, risk warnings and bet slip.",
    tag: "Core"
  },
  {
    title: "Intelligence Terminal",
    href: "/intelligence",
    description: "Research matches, risks, AI thesis and betting ideas.",
    tag: "Research"
  },
  {
    title: "Live Market Pulse",
    href: "/live",
    description: "Track line movement, volatility and live signals.",
    tag: "Realtime"
  },
  {
    title: "Simulator",
    href: "/simulator",
    description: "Run match simulations and probability models.",
    tag: "Model"
  },
  {
    title: "Tracking",
    href: "/tracking",
    description: "Follow bankroll, ROI, CLV, streaks and bet history.",
    tag: "Performance"
  },
  {
    title: "AI Agent",
    href: "/agent",
    description: "Paper betting agent with learning reports.",
    tag: "Autonomous"
  }
];

export default function DashboardClient() {
  const [topPicks, setTopPicks] = useState([]);
  const [topPicksLoading, setTopPicksLoading] = useState(true);
  const [topPicksSource, setTopPicksSource] = useState("loading");
  const [trackingStats, setTrackingStats] = useState(null);

  useEffect(() => {
    async function loadTopPicks() {
      try {
        const res = await fetch("/api/top-picks", { cache: "no-store" });
        const data = await res.json();

        setTopPicks(Array.isArray(data.data) ? data.data : []);
        setTopPicksSource(data.source || "api");
      } catch {
        setTopPicksSource("error");
      } finally {
        setTopPicksLoading(false);
      }
    }

    function loadTracking() {
      const bets = getTrackedBets();
      setTrackingStats(calculateTrackingStats(bets));
    }

    loadTopPicks();
    loadTracking();
  }, []);

  const bestEdge = topPicks[0]?.edge ? formatPercent(topPicks[0].edge) : "-";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl md:p-8">
        <div className="max-w-4xl">
          <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
            Scorecaster V1 Command Center
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            AI Sports Intelligence Terminal
          </h1>

          <p className="mt-4 text-lg text-slate-300">
            Yksi näkymä kertoimiin, value-analyysiin, riskienhallintaan,
            trackingiin, CLV:hen ja AI-agenttiin.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/betting"
              className="rounded-xl bg-emerald-400 px-5 py-3 text-center font-bold text-slate-950 hover:bg-emerald-300"
            >
              Open Betting Workspace
            </Link>

            <Link
              href="/tracking"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-bold text-white hover:bg-white/10"
            >
              Open Tracking
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Top Edge"
          value={bestEdge}
          subtitle={`Source: ${topPicksSource}`}
          tone="green"
        />
        <StatCard
          title="Top Picks"
          value={topPicksLoading ? "..." : String(topPicks.length)}
          subtitle="Across selected leagues"
          tone="blue"
        />
        <StatCard
          title="Tracked Bets"
          value={trackingStats ? String(trackingStats.totalBets) : "0"}
          subtitle={trackingStats ? `${trackingStats.openBets} open` : "Local tracking"}
        />
        <StatCard
          title="Tracking ROI"
          value={trackingStats ? formatPercent(trackingStats.roi) : "0.0%"}
          subtitle={trackingStats ? formatMoney(trackingStats.totalProfit) : "No bets yet"}
          tone={trackingStats?.totalProfit >= 0 ? "green" : "red"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
              {topPicksLoading && (
                <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                  Loading top picks...
                </div>
              )}

              {!topPicksLoading && topPicks.length === 0 && (
                <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                  Ei top pickejä juuri nyt. Kokeile Betting-sivulla eri sarjaa.
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

                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-black text-emerald-300">
                      Edge {formatPercent(pick.edge)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {pick.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="MVP Status" subtitle="15-day completion focus">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">
                Betting Workspace: odds, markets, Kelly, risk and tracking connected.
              </div>
              <div className="rounded-xl bg-sky-400/10 p-4">
                Tracking V2: ROI, CLV, streaks, filters and settlement active.
              </div>
              <div className="rounded-xl bg-yellow-400/10 p-4">
                Next focus: polish Agent, Simulator, Live and Intelligence pages.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
