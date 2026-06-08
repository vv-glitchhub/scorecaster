import Panel from "../components/Panel";

async function getLiveMarket() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const response = await fetch(`${siteUrl}/api/live-market?limit=50`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message, summary: {}, feeds: {} };
  }
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function number(value) {
  return Number(value || 0).toFixed(1);
}

export default async function LivePage() {
  const live = await getLiveMarket();
  const summary = live?.summary || {};
  const feeds = live?.feeds || {};

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-8">
        <div className="mb-3 inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold text-red-300">
          Live Market Center V1
        </div>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Realtime Market Intelligence</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Steam alerts, sharp index, CLV feed and market pressure in one safe manual-refresh view.
          This page is built for paper trading analysis and API-credit control.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Tracked Picks" value={summary.picks || 0} subtitle="Agent V9 feed" tone="sky" />
        <Card title="Steam Moves" value={summary.steamMoves || 0} subtitle="Fast movement signals" tone="red" />
        <Card title="Sharp Signals" value={summary.strongSharpSignals || 0} subtitle={`Avg sharp ${number(summary.averageSharpIndex)}`} tone="emerald" />
        <Card title="CLV Records" value={summary.clvAvailable || 0} subtitle={`${summary.closingLineRecords || 0} closing records`} tone="yellow" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <FeedPanel title="🔥 Steam Alerts" items={feeds.steamMoves} empty="No steam moves detected yet." renderItem={renderMovement} />
        <FeedPanel title="📈 Sharp Signals" items={feeds.strongestSharpSignals} empty="No strong sharp signals yet." renderItem={renderSharp} />
        <FeedPanel title="⚡ Market Pressure" items={feeds.pressureMoves} empty="No pressure moves detected yet." renderItem={renderMovement} />
        <FeedPanel title="🎯 Positive CLV" items={feeds.positiveCLV} empty="No positive CLV records yet." renderItem={renderCLV} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Reverse Line Moves" subtitle="Possible hidden market pressure">
          <div className="space-y-3">
            {(feeds.reverseMoves || []).slice(0, 8).map((item, index) => (
              <MovementCard key={`${item.key}-${index}`} item={item} />
            ))}
            {(!feeds.reverseMoves || feeds.reverseMoves.length === 0) && <Empty text="No reverse line moves detected." />}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Live Workflow" subtitle="Safe operating mode">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-red-400/10 p-4">1. Detect steam or pressure signal.</div>
              <div className="rounded-xl bg-sky-400/10 p-4">2. Confirm score, edge and CLV quality.</div>
              <div className="rounded-xl bg-emerald-400/10 p-4">3. Add only controlled paper exposure.</div>
            </div>
          </Panel>
          <Panel title="Refresh Mode" subtitle={live?.refreshMode || "manual"}>
            <p className="text-sm text-slate-300">
              This view uses safe no-store fetches and is designed for manual or slow interval refreshes to avoid wasting odds API credits.
            </p>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Card({ title, value, subtitle, tone = "slate" }) {
  const toneClass = {
    red: "text-red-300",
    emerald: "text-emerald-300",
    sky: "text-sky-300",
    yellow: "text-yellow-300",
    slate: "text-white"
  }[tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}

function FeedPanel({ title, items = [], empty, renderItem }) {
  return (
    <Panel title={title} subtitle="Live market feed">
      <div className="space-y-3">
        {items.slice(0, 8).map((item, index) => renderItem(item, index))}
        {items.length === 0 && <Empty text={empty} />}
      </div>
    </Panel>
  );
}

function MovementCard({ item }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black">{item.selection || "Unknown selection"}</div>
          <div className="mt-1 text-sm text-slate-400">{item.league || "Unknown"} · {item.marketKey || "Market"}</div>
        </div>
        <div className="rounded-full bg-red-400/10 px-3 py-1 text-xs font-bold text-red-300">{item.signal || "signal"}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
        <span>Move {percent(item.movementPercent)}</span>
        <span>Pressure {item.pressure || "neutral"}</span>
        <span>Conf {percent(item.confidence)}</span>
      </div>
    </div>
  );
}

function SharpCard({ item }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black">{item.selection || "Unknown selection"}</div>
          <div className="mt-1 text-sm text-slate-400">{item.match || item.league || "Unknown match"}</div>
        </div>
        <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{item.label}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
        <span>Sharp {number(item.sharpIndex)}</span>
        <span>Score {number(item.finalScore100)}</span>
        <span>{item.decision}</span>
      </div>
    </div>
  );
}

function CLVCard({ item }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black">{item.selection || "Unknown selection"}</div>
          <div className="mt-1 text-sm text-slate-400">{item.league || "Unknown"} · {item.bookmaker || "Bookmaker"}</div>
        </div>
        <div className="rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-300">{item.clvGrade || "N/A"}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-300">
        <span>CLV {number(item.clvPercent)}%</span>
        <span>Ref {item.referenceOdds || "-"}</span>
        <span>Close {item.closingOdds || "-"}</span>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{text}</div>;
}

const renderMovement = (item, index) => <MovementCard key={`${item.key}-${index}`} item={item} />;
const renderSharp = (item, index) => <SharpCard key={`${item.id}-${item.selection}-${index}`} item={item} />;
const renderCLV = (item, index) => <CLVCard key={`${item.id || item.game_id}-${item.selection}-${index}`} item={item} />;
