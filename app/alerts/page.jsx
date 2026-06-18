import Link from "next/link";
import Panel from "../components/Panel";

async function getAlerts() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const response = await fetch(`${siteUrl}/api/alerts?limit=50`, { cache: "no-store" });
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message, summary: {}, alerts: [] };
  }
}

function alertTone(severity) {
  if (severity === "critical") return "border-red-400/40 bg-red-400/10 text-red-200";
  if (severity === "high") return "border-orange-400/40 bg-orange-400/10 text-orange-200";
  if (severity === "medium") return "border-yellow-400/40 bg-yellow-400/10 text-yellow-200";
  return "border-sky-400/40 bg-sky-400/10 text-sky-200";
}

function typeIcon(type) {
  if (type === "steam_alert") return "🔥";
  if (type === "sharp_alert") return "📈";
  if (type === "clv_alert") return "🎯";
  if (type === "value_alert") return "💎";
  if (type === "risk_alert") return "⚠️";
  return "🔔";
}

export default async function AlertsPage() {
  const data = await getAlerts();
  const summary = data?.summary || {};
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const critical = Array.isArray(data?.critical) ? data.critical : [];
  const high = Array.isArray(data?.high) ? data.high : [];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.18),transparent_34%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-6 shadow-2xl md:p-8">
        <div className="mb-3 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
          Alert Center V1
        </div>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">Market Alerts & Notifications</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          Steam alerts, sharp index warnings, CLV changes, value signals and portfolio risk alerts in one control center.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/live" className="rounded-2xl bg-yellow-400 px-5 py-3 text-center font-black text-slate-950 hover:bg-yellow-300">
            Open Live Market Center
          </Link>
          <Link href="/analytics" className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-center font-black text-white hover:bg-white/[0.08]">
            View Analytics
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Stat title="Total Alerts" value={summary.count || 0} tone="text-white" />
        <Stat title="Critical" value={summary.critical || 0} tone="text-red-300" />
        <Stat title="High" value={summary.high || 0} tone="text-orange-300" />
        <Stat title="Medium" value={summary.medium || 0} tone="text-yellow-300" />
        <Stat title="Info" value={summary.info || 0} tone="text-sky-300" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="All Alerts" subtitle="Ranked by severity and signal score">
          <div className="space-y-3">
            {alerts.length === 0 && <Empty text="No alerts detected yet." />}
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Critical / High Priority" subtitle="Needs review first">
            <div className="space-y-3">
              {[...critical, ...high].slice(0, 8).map((alert) => <AlertCard key={alert.id} alert={alert} compact />)}
              {critical.length + high.length === 0 && <Empty text="No high priority alerts." />}
            </div>
          </Panel>

          <Panel title="Alert Types" subtitle="Signal coverage">
            <div className="space-y-2 text-sm text-slate-300">
              {Object.entries(summary.byType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3">
                  <span>{typeIcon(type)} {type}</span>
                  <span className="font-black">{count}</span>
                </div>
              ))}
              {Object.keys(summary.byType || {}).length === 0 && <Empty text="No alert type data yet." />}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Stat({ title, value, tone }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`mt-2 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function AlertCard({ alert, compact = false }) {
  return (
    <div className={`rounded-2xl border p-4 ${alertTone(alert.severity)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black">{typeIcon(alert.type)} {alert.title}</div>
          {!compact && <div className="mt-1 text-sm opacity-85">{alert.message}</div>}
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-black uppercase">
          {alert.severity}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs opacity-90 md:grid-cols-4">
        <span>Score {Number(alert.score || 0).toFixed(1)}</span>
        <span>{alert.league || "Unknown"}</span>
        <span>{alert.selection || "Selection"}</span>
        <span>{alert.bookmaker || "Bookmaker"}</span>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">{text}</div>;
}
