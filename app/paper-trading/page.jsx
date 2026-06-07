import Link from "next/link";

async function getJson(path) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "";

    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export default async function PaperTradingPage() {
  const [agent, portfolio, learning] = await Promise.all([
    getJson("/api/agent-v8"),
    getJson("/api/portfolio"),
    getJson("/api/learning-summary")
  ]);

  const bankroll = portfolio?.bankroll || 1000;
  const allocated = portfolio?.allocated || 0;
  const remaining = Math.max(0, bankroll - allocated);
  const openPicks = agent?.data?.slice(0, 12) || [];
  const summary = learning?.summary || {};

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Scorecaster Paper Trading</p>
            <h1 className="text-4xl font-bold">Paper Trading Dashboard</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Track Agent V8 picks as paper bets before risking real money. Use this view to monitor exposure, open picks and learning performance.
            </p>
          </div>
          <Link href="/analytics" className="rounded-xl border border-emerald-400/40 px-4 py-2 text-emerald-200 hover:bg-emerald-400/10">
            Open Analytics
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Card title="Paper Bankroll" value={money(bankroll)} subtitle="Simulation bankroll" />
          <Card title="Allocated" value={money(allocated)} subtitle="Current paper exposure" />
          <Card title="Remaining" value={money(remaining)} subtitle="Unallocated paper bankroll" />
          <Card title="Risk Mode" value={agent?.adaptiveWeights?.riskMode || "balanced"} subtitle="Agent V8 adaptive mode" />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card title="Open Picks" value={openPicks.length} subtitle="Current Agent V8 candidates" />
          <Card title="Best Bets" value={agent?.summary?.bestBets || 0} subtitle="BET-class paper picks" />
          <Card title="Watchlist" value={agent?.summary?.watchlist || 0} subtitle="WATCH-class paper picks" />
          <Card title="Learning Grade" value={summary.grade || "N/A"} subtitle={`ROI ${percent(summary.roi)}`} />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Open Paper Picks</h2>
              <p className="mt-1 text-sm text-slate-400">These are not real bets. They are candidates for tracking model quality, CLV and learning.</p>
            </div>
            <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200">Paper mode</span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {openPicks.length ? openPicks.map((pick) => <PickCard key={pick.id || `${pick.selection}-${pick.match}`} pick={pick} />) : (
              <p className="text-sm text-slate-400">No open paper picks yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold">Settled Performance</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Card title="Settled" value={summary.settled || 0} subtitle="Closed paper records" />
            <Card title="Wins" value={summary.wins || 0} subtitle="Winning records" />
            <Card title="Losses" value={summary.losses || 0} subtitle="Losing records" />
            <Card title="Hit Rate" value={percent(summary.hitRate)} subtitle="Win rate excluding pushes" />
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function PickCard({ pick }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">{pick.selection}</p>
          <p className="text-sm text-slate-400">{pick.match || `${pick.homeTeam} vs ${pick.awayTeam}`}</p>
        </div>
        <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200">{pick.decision}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300 md:grid-cols-4">
        <span>Odds {pick.odds}</span>
        <span>Edge {percent(pick.edge)}</span>
        <span>Grade {pick.qualityGrade || "N/A"}</span>
        <span>Trust {percent(pick.sourceTrust)}</span>
      </div>
      <div className="mt-4 text-xs text-slate-500">
        {pick.adaptiveNotes?.slice(0, 2).join(" ") || "Waiting for adaptive notes."}
      </div>
    </div>
  );
}
