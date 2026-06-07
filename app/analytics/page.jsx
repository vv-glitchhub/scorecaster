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

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function number(value) {
  return Number(value || 0).toFixed(2);
}

export default async function AnalyticsPage() {
  const [learning, clv, agent] = await Promise.all([
    getJson("/api/learning-summary"),
    getJson("/api/clv-tracker"),
    getJson("/api/agent-v8")
  ]);

  const summary = learning?.summary || {};
  const clvSummary = clv?.summary || {};
  const agentSummary = agent?.summary || {};
  const weights = agent?.adaptiveWeights || {};
  const bestBets = agent?.data?.filter((item) => item.decision === "BET").slice(0, 5) || [];
  const watchlist = agent?.data?.filter((item) => item.decision === "WATCH").slice(0, 5) || [];

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Scorecaster Analytics</p>
            <h1 className="text-4xl font-bold">Performance Dashboard</h1>
            <p className="mt-2 max-w-3xl text-slate-300">
              Paper trading performance, CLV, learning grade and Agent V8 adaptive weights in one place.
            </p>
          </div>
          <Link href="/agent-v7" className="rounded-xl border border-cyan-400/40 px-4 py-2 text-cyan-200 hover:bg-cyan-400/10">
            Open Agent Dashboard
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <Card title="Learning Grade" value={summary.grade || "N/A"} subtitle={summary.note || learning?.warning || "Waiting for settled paper bets."} />
          <Card title="ROI" value={percent(summary.roi)} subtitle={`${summary.settled || 0} settled picks`} />
          <Card title="Hit Rate" value={percent(summary.hitRate)} subtitle={`${summary.wins || 0}W / ${summary.losses || 0}L / ${summary.pushes || 0}P`} />
          <Card title="Average CLV" value={number(summary.averageCLV || clvSummary.averageCLVPercent)} subtitle={`CLV grade ${clvSummary.grade || "N/A"}`} />
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card title="Agent Version" value="V8" subtitle={`Mode: ${weights.riskMode || "balanced"}`} />
          <Card title="Best Bets" value={agentSummary.bestBets || 0} subtitle="Current V8 BET picks" />
          <Card title="Watchlist" value={agentSummary.watchlist || 0} subtitle="Current V8 WATCH picks" />
          <Card title="CLV Positive Rate" value={percent(clvSummary.positiveRate)} subtitle={`${clvSummary.count || 0} tracked estimates`} />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card title="Edge Weight" value={number(weights.edgeWeight || 1)} subtitle="Adaptive learning multiplier" />
          <Card title="Quality Weight" value={number(weights.qualityWeight || 1)} subtitle="Adaptive learning multiplier" />
          <Card title="Trust Weight" value={number(weights.trustWeight || 1)} subtitle="Adaptive learning multiplier" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="🔥 Best Bets">
            <PickList picks={bestBets} empty="No BET picks yet. Keep collecting data." />
          </Panel>
          <Panel title="👀 Watchlist">
            <PickList picks={watchlist} empty="No WATCH picks available." />
          </Panel>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">System Notes</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <p>Learning mode: {learning?.mode || "unknown"}</p>
            <p>CLV source: {clv?.source || "unknown"}</p>
            <p>Agent source: {agent?.source || "unknown"}</p>
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

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PickList({ picks, empty }) {
  if (!picks.length) return <p className="text-sm text-slate-400">{empty}</p>;

  return (
    <div className="space-y-3">
      {picks.map((pick) => (
        <div key={pick.id || `${pick.selection}-${pick.match}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{pick.selection}</p>
              <p className="text-sm text-slate-400">{pick.match || `${pick.homeTeam} vs ${pick.awayTeam}`}</p>
            </div>
            <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200">{pick.decision}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
            <span>Odds {pick.odds}</span>
            <span>Edge {percent(pick.edge)}</span>
            <span>Grade {pick.qualityGrade || "N/A"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
