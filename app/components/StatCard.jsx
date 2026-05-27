export default function StatCard({ title, value, subtitle, tone = "default" }) {
  const toneClass =
    tone === "green"
      ? "text-emerald-300"
      : tone === "red"
      ? "text-red-300"
      : tone === "blue"
      ? "text-sky-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="text-sm text-slate-400">{title}</div>
      <div className={`mt-2 text-3xl font-black ${toneClass}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}
