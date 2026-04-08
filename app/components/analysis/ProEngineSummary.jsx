"use client";

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4">
      <div className="text-sm font-semibold text-slate-300">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-white">{value}</div>
    </div>
  );
}

export default function ProEngineSummary({ summary }) {
  if (!summary) return null;

  return (
    <section className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg">
      <h3 className="mb-4 text-3xl font-extrabold text-white">
        Pro betting engine summary
      </h3>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Kaikki kohteet" value={summary.total ?? 0} />
        <StatCard label="Pelattavat" value={summary.playableCount ?? 0} />
        <StatCard label="No bet" value={summary.noBetCount ?? 0} />
        <StatCard label="Keski-edge" value={formatPercent(summary.averageEdge ?? 0)} />
        <StatCard label="Keski-EV" value={formatPercent(summary.averageEv ?? 0)} />
        <StatCard label="Paras grade" value={summary.bestGrade ?? "—"} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <StatCard label="Elite" value={summary?.buckets?.elite ?? 0} />
        <StatCard label="Strong" value={summary?.buckets?.strong ?? 0} />
        <StatCard label="Solid" value={summary?.buckets?.solid ?? 0} />
        <StatCard label="Thin" value={summary?.buckets?.thin ?? 0} />
        <StatCard label="Negative" value={summary?.buckets?.negative ?? 0} />
      </div>
    </section>
  );
}
