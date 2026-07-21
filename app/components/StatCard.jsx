export default function StatCard({ title, value, subtitle, tone = "default", icon }) {
  const toneClass = tone === "green"
    ? "text-emerald-300"
    : tone === "red"
      ? "text-rose-300"
      : tone === "blue"
        ? "text-sky-300"
        : tone === "yellow"
          ? "text-amber-300"
          : tone === "purple"
            ? "text-purple-300"
            : "text-[var(--sc-text)]";

  const accentClass = tone === "green"
    ? "bg-emerald-400"
    : tone === "red"
      ? "bg-rose-400"
      : tone === "blue"
        ? "bg-sky-400"
        : tone === "yellow"
          ? "bg-amber-400"
          : tone === "purple"
            ? "bg-purple-400"
            : "bg-[var(--sc-brand)]";

  return (
    <div className="sc-surface relative overflow-hidden rounded-[1.45rem] p-5">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${accentClass}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{title}</div>
        {icon && <div className="text-[var(--sc-muted)]">{icon}</div>}
      </div>
      <div className={`mt-3 text-3xl font-black tracking-[-0.045em] ${toneClass}`}>{value}</div>
      {subtitle && <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{subtitle}</div>}
    </div>
  );
}
