import Link from "next/link";

async function getJson(path) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const response = await fetch(`${siteUrl}${path}`, { cache: "no-store" });
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

function score(value) {
  return Number(value || 0).toFixed(1);
}

export default async function AnalyticsPage() {
  const [learning, clv, agent] = await Promise.all([
    getJson("/api/learning-summary"),
    getJson("/api/clv-tracker"),
    getJson("/api/agent-v9")
  ]);

  const learningSummary = learning?.summary || {};
  const clvSummary = clv?.summary || {};
  const agentSummary = agent?.summary || {};
  const weights = agent?.learningWeights || agent?.adaptiveWeights || {};
  const picks = Array.isArray(agent?.data) ? agent.data : [];
  const bestBets = picks.filter((item) => item.decision === "BET").slice(0, 5);
  const watchlist = picks.filter((item) => item.decision === "WATCH").slice(0, 5);
  const topSegments = buildSegments(picks);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">Scorecaster Analytics</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Agent V9 Performance Dashboard</h1>
            <p className="mt-4 max-w-3xl text-slate-300">
              Paper trading performance, CLV quality, learning weights and Agent V9 ranked picks in one place.
            </p>
          </div>
          <Link href="/agent-v7" className="rounded-2xl border border-cyan-400/40 px-5 py-3 text-center font-black text-cyan-200 hover:bg-cyan-400/10">
            Open Agent Dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Learning Grade" value={learningSummary.grade || agent?.learningSummary?.clvGrade || "N/A"} subtitle={learningSummary.note || learning?.warning || "Waiting for settled paper records."} />
        <Card title="ROI" value={percent(learningSummary.roi || agent?.learningSummary?.roi)} subtitle={`${learningSummary.settled || agent?.learningSummary?.settled || 0} settled picks`} />
        <Card title="Hit Rate" value={percent(learningSummary.hitRate || agent?.learningSummary?.hitRate)} subtitle={`${learningSummary.wins || 0}W / ${learningSummary.losses || 0}L / ${learningSummary.pushes || 0}P`} />
        <Card title="Average CLV" value={number(learningSummary.averageCLV || clvSummary.averageCLVPercent || agent?.learningSummary?.averageCLV)} subtitle={`CLV grade ${clvSummary.grade || agent?.learningSummary?.clvGrade || "N/A"}`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Agent Version" value="V9" subtitle={`Mode: ${weights.riskMode || agent?.learningSummary?.riskMode || "balanced"}`} />
        <Card title="BET Picks" value={agentSummary.bets || bestBets.length || 0} subtitle="Current V9 BET picks" />
        <Card title="Watchlist" value={agentSummary.watchlist || watchlist.length || 0} subtitle="Current V9 WATCH picks" />
        <Card title="CLV Positive Rate" value={percent(clvSummary.positiveRate)} subtitle={`${clvSummary.count || 0} tracked estimates`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card title="Edge" value={number(weights.edgeWeight || 1)} subtitle="Weight" />
        <Card title="Quality" value={number(weights.qualityWeight || 1)} subtitle="Weight" />
        <Card title="Trust" value={number(weights.trustWeight || 1)} subtitle="Weight" />
        <Card title="CLV" value={number(weights.clvWeight || 1)} subtitle="Weight" />
        <Card title="Sharp" value={number(weights.sharpWeight || 1)} subtitle="Weight" />
        <Card title="Context" value={number(weights.contextWeight || 1)} subtitle="Weight" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Best Agent V9 Picks">
          <PickList picks={bestBets} empty="No BET picks yet. Keep collecting paper data." />
        </Panel>
        <Panel title="Watchlist">
          <PickList picks={watchlist} empty="No WATCH picks available." />
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="League / Segment Snapshot">
          <div className="space-y-3">
            {topSegments.length === 0 && <p className="text-sm text-slate-400">No segment data yet.</p>}
            {topSegments.map((segment) => (
              <div key={segment.name} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold">{segment.name}</div>
                  <div className="text-sm text-emerald-300">Avg {score(segment.averageScore)}</div>
                </div>
                <div className="mt-2 text-sm text-slate-400">{segment.count} picks · {segment.bets} BET · {segment.watch} WATCH</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="System Notes">
          <div className="space-y-3 text-sm text-slate-300">
            <Note label="Learning source" value={learning?.source || "unknown"} />
            <Note label="CLV source" value={clv?.source || "unknown"} />
            <Note label="Agent source" value={agent?.source || "unknown"} />
            <Note label="Learning mode" value={agent?.learningMode || learning?.mode || "unknown"} />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function buildSegments(picks) {
  const groups = new Map();
  for (const pick of picks) {
    const key = pick.leagueTitle || pick.league || pick.sportTitle || "Unknown";
    const current = groups.get(key) || [];
    current.push(pick);
    groups.set(key, current);
  }
  return Array.from(groups.entries())
    .map(([name, group]) => ({
      name,
      count: group.length,
      bets: group.filter((pick) => pick.decision === "BET").length,
      watch: group.filter((pick) => pick.decision === "WATCH").length,
      averageScore: group.reduce((sum, pick) => sum + Number(pick.finalScore100 || 0), 0) / Math.max(group.length, 1)
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 8);
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Note({ label, value }) {
  return <div className="rounded-xl bg-slate-950/60 p-4"><span className="text-slate-500">{label}: </span>{value}</div>;
}

function PickList({ picks, empty }) {
  if (!picks.length) return <p className="text-sm text-slate-400">{empty}</p>;

  return (
    <div className="space-y-3">
      {picks.map((pick) => (
        <div key={pick.id || `${pick.selection}-${pick.match}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">{pick.selection}</p>
              <p className="text-sm text-slate-400">{pick.match || `${pick.homeTeam} vs ${pick.awayTeam}`}</p>
            </div>
            <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200">{pick.decision}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
            <span>Odds {pick.odds}</span>
            <span>Edge {percent(pick.edge)}</span>
            <span>Score {score(pick.finalScore100)}</span>
            <span>Grade {pick.gradeV9 || pick.qualityGrade || "N/A"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
