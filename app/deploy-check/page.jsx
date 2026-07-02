export default function DeployCheckPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a)] p-6 md:p-10">
        <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
          Deploy Check
        </div>
        <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
          Scorecaster latest deploy marker.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          If this page is visible on Vercel, the latest GitHub main branch is being deployed correctly.
        </p>
        <div className="mt-6 rounded-2xl bg-slate-950/70 p-5 text-sm text-slate-300">
          Marker: scorecaster-deploy-check-2026-07-02-core-status
        </div>
      </section>
    </div>
  );
}
