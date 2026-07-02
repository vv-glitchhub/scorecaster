import Link from 'next/link';
import { getScorecasterCoreState } from '../../lib/caster-core-contract';

export default function CoreStatusPage() {
  const state = getScorecasterCoreState();

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Caster Core
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          Scorecaster is the first Caster Core app.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          This page shows the shared app state that can later be reported to Caster-hub and reused by Stockcaster, Carcaster and Travelcaster.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/quick-use" className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Quick Use</Link>
          <Link href="/risk" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Risk</Link>
          <Link href="/" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white">Dashboard</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">App</div><div className="mt-2 text-2xl font-black">{state.name}</div></div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">Status</div><div className="mt-2 text-2xl font-black">{state.status}</div></div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">Sync</div><div className="mt-2 text-2xl font-black">{state.syncStatus}</div></div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="text-sm text-slate-400">Keys</div><div className="mt-2 text-2xl font-black">{state.localStorageKeys.length}</div></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <CoreList title="Routes" items={state.routes} />
        <CoreList title="Features" items={state.features} />
        <CoreList title="Next Actions" items={state.nextActions} />
      </section>
    </div>
  );
}

function CoreList({ title, items }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-slate-950/70 p-4 text-sm text-slate-300">{item}</div>
        ))}
      </div>
    </div>
  );
}
