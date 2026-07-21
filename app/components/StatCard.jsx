export default function StatCard({ title, value, subtitle, tone = "default", icon }) {
  const toneClass = tone === "green"
    ? "text-emerald-200"
    : tone === "red"
      ? "text-rose-200"
      : tone === "blue"
        ? "text-sky-200"
        : tone === "yellow"
          ? "text-amber-200"
          : tone === "purple"
            ? "text-purple-200"
            : "text-white";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/48 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{title}</div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <div className={`mt-3 text-3xl font-black tracking-[-0.03em] ${toneClass}`}>{value}</div>
      {subtitle && <div className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</div>}
    </div>
  );
}
