import Link from "next/link";

export const metadata = {
  title: "Alert Inbox V2 Privacy | Scorecaster",
  description: "How Scorecaster stores, filters, dismisses and exports verified Alert Inbox data."
};

export default function AlertInboxPrivacyPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-9">
        <div className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">Alert Inbox V2</div>
        <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Privacy and data behavior</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">Alert Inbox stores user-specific, server-generated Watchlist change records. It does not store payment credentials, create real-money bets or infer missing market data.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Stored data">Alert type, severity, title, explanatory message, match, selection, bounded market details, read state, active or resolved state, dismissal state and timestamps.</Card>
        <Card title="User isolation">Every row contains the authenticated user ID. Row Level Security requires <code>auth.uid() = user_id</code> for reads and writes.</Card>
        <Card title="Notification preferences">The existing Notification Registry controls which verified conditions are synchronized into Alert Inbox. V2 does not introduce a second preference table.</Card>
        <Card title="Reversible dismissal">Dismissal sets a timestamp and hides the row from normal views. It does not delete the audit record. A dismissed row can be restored.</Card>
        <Card title="Retention and deletion">Alert rows remain until the related Watchlist item or account is deleted, or until the user deletes the account through Scorecaster.</Card>
        <Card title="Export">The focused JSON export includes notification preferences and Alert Inbox rows, including read, resolved and dismissal timestamps.</Card>
      </section>

      <div className="flex flex-wrap gap-3"><Link href="/alerts" className="rounded-xl bg-fuchsia-300 px-5 py-3 font-black text-slate-950">Open Alert Inbox</Link><Link href="/privacy" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">General privacy</Link></div>
    </div>
  );
}

function Card({ title, children }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-xl font-black text-white">{title}</h2><p className="mt-3 leading-7 text-slate-400">{children}</p></article>;
}
