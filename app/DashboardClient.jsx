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
    title: "Agent V9",
    href: "/agent-v7",
    description: "Ranked AI picks, scoring, confidence and learning-ready decisions.",
    tag: "AI Core"
  },
  {
    title: "Betting Workspace",
    href: "/betting",
    description: "Live odds, EV, Kelly, risk warnings and bet slip.",
    tag: "Core"
  },
  {
    title: "Analytics",
    href: "/analytics",
    description: "Learning, CLV, ROI and model performance dashboard.",
    tag: "Performance"
  },
  {
    title: "Paper Trading",
    href: "/paper-trading",
    description: "Controlled paper bankroll, exposure and simulated allocations.",
    tag: "Risk Lab"
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
    description: "Follow bankroll, ROI, CLV, streaks and history.",
    tag: "Memory"
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
        const res = await fetch("/api/agent-v9", { cache: "no-store" });
        const data = await res.json();

        setTopPicks(Array.isArray(data.data) ? data.data : []);
        setTopPicksSource(data.source || "agent-v9");
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

  const bestScore = topPicks[0]?.finalScore100 ? `${topPicks[0].finalScore100.toFixed(1)}` : "-";
  const bestEdge = topPicks[0]?.edge ? formatPercent(topPicks[0].edge) : "-";
  const betCount = topPicks.filter((pick) => pick.decision === "BET").length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_32%),linear-gradient(135deg,#020617,#0f172a_52%,#020617)] p-6 shadow-2xl md:p-10">
        <div className="absolute right-[-120px] top-[-120px] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[35%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
              Scorecaster Intelligence Platform · Agent V9
            </div>

            <h1 className="max-w-5xl text-4xl font-black tracking-tight md:text-7xl">
              AI-powered sports intelligence, risk and paper trading command center.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Scorecaster yhdistää live-kertoimet, EV:n, edgen, CLV:n, sharp moneyn,
              match contextin, Kelly-riskinhallinnan ja oppivan Agent V9 -rankingmoottorin
              yhdeksi selkeäksi päätösnäkymäksi.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/betting"
                className="rounded-2xl bg-emerald-400 px-6 py-4 text-center font-black text-slate-950 shadow-lg shadow-emerald-400/20 hover:bg-emerald-300"
              >
                Open Betting Workspace
              </Link>

              <Link
                href="/analytics"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center font-black text-white hover:bg-white/10"
              >
                View Analytics
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
            <div className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">
              Live System
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <div className="text-sm text-slate-400">Best Agent Score</div>
                <div className="mt-1 text-4xl font-black text-emerald-300">{bestScore}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <div className="text-sm text-slate-400">Top Edge</div>
                  <div className="mt-1 text-2xl font-black">{bestEdge}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <div className="text-sm text-slate-400">BET Signals</div>
                  <div className="mt-1 text-2xl font-black">{betCount}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                V9 scoring, learning weights, paper exposure and CLV tracking ready.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Agent Score" value={bestScore} subtitle={`Source: ${topPicksSource}`} tone="green" />
        <StatCard title="Top Picks" value={topPicksLoading ? "..." : String(topPicks.length)} subtitle="Agent V9 ranked" tone="blue" />
        <StatCard title="Tracked Bets" value={trackingStats ? String(trackingStats.totalBets) : "0"} subtitle={trackingStats ? `${trackingStats.openBets} open` : "Local tracking"} />
        <StatCard title="Tracking ROI" value={trackingStats ? formatPercent(trackingStats.roi) : "0.0%"} subtitle={trackingStats ? formatMoney(trackingStats.totalProfit) : "No bets yet"} tone={trackingStats?.totalProfit >= 0 ? "green" : "red"} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Panel title="Scorecaster Ecosystem" subtitle="The full analysis stack">
          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <Link key={module.href} href={module.href} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:bg-white/[0.08]">
                <div className="mb-3 inline-flex rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {module.tag}
                </div>
                <div className="text-xl font-black group-hover:text-emerald-300">{module.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{module.description}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Top Agent V9 Picks" subtitle="Ranked analytical opportunities">
            <div className="space-y-3">
              {topPicksLoading && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Loading Agent V9 picks...</div>}
              {!topPicksLoading && topPicks.length === 0 && <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Ei top pickejä juuri nyt. Kokeile Betting-sivulla eri sarjaa.</div>}
              {topPicks.slice(0, 5).map((pick, index) => (
                <div key={`${pick.match}-${pick.selection}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">{pick.leagueTitle || pick.league}</div>
                    <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{pick.gradeV9 || pick.qualityGrade || "N/A"}</div>
                  </div>
                  <div className="mt-2 font-bold">{pick.match}</div>
                  <div className="mt-1 text-sm text-slate-400">{pick.selection} @ {pick.odds}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">Score</div><div className="font-black">{pick.finalScore100 ? pick.finalScore100.toFixed(1) : "-"}</div></div>
                    <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">Edge</div><div className="font-black">{formatPercent(pick.edge)}</div></div>
                    <div className="rounded-xl bg-slate-950/60 p-2"><div className="text-slate-500">Decision</div><div className="font-black">{pick.decision}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="System Status" subtitle="Core engines">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-emerald-400/10 p-4">Agent V9: scoring, grade and decision layer active.</div>
              <div className="rounded-xl bg-sky-400/10 p-4">Learning V4: CLV, ROI and segment weighting ready.</div>
              <div className="rounded-xl bg-yellow-400/10 p-4">Paper Trading: bankroll, Kelly and exposure control active.</div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
