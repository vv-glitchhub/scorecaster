import Link from "next/link";

const decisionStyles = {
  PLAY: "border-emerald-300/35 bg-emerald-300/12 text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.08)]",
  BET: "border-emerald-300/35 bg-emerald-300/12 text-emerald-200 shadow-[0_0_28px_rgba(52,211,153,0.08)]",
  CAUTION: "border-amber-300/35 bg-amber-300/10 text-amber-200",
  WATCH: "border-amber-300/35 bg-amber-300/10 text-amber-200",
  WAIT: "border-amber-300/35 bg-amber-300/10 text-amber-200",
  SKIP: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  PASS: "border-rose-300/30 bg-rose-300/10 text-rose-200"
};

export function DecisionBadge({ decision = "CAUTION", className = "" }) {
  const normalized = String(decision || "CAUTION").toUpperCase();
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black tracking-[0.12em] ${decisionStyles[normalized] || decisionStyles.CAUTION} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {normalized}
    </span>
  );
}

export function PageHero({ eyebrow, title, description, actions, aside, tone = "emerald" }) {
  const glow = tone === "purple"
    ? "from-purple-400/25 via-fuchsia-400/5"
    : tone === "sky"
      ? "from-sky-400/25 via-cyan-400/5"
      : "from-emerald-400/25 via-teal-400/5";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl md:p-9">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glow} to-transparent opacity-80`} />
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/[0.025] blur-sm" />
      <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
        <div className="max-w-4xl">
          {eyebrow && <div className="sc-kicker">{eyebrow}</div>}
          <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">{title}</h1>
          {description && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg md:leading-8">{description}</p>}
          {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
        </div>
        {aside && <div className="rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur">{aside}</div>}
      </div>
    </section>
  );
}

export function TrustBar({ items = [], className = "" }) {
  const safeItems = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "");
  if (!safeItems.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs text-slate-400 ${className}`}>
      {safeItems.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${item.tone === "warning" ? "bg-amber-300" : item.tone === "danger" ? "bg-rose-300" : item.tone === "info" ? "bg-sky-300" : "bg-emerald-300"}`} />
          <span className="truncate"><span className="text-slate-500">{item.label}</span> <strong className="font-bold text-slate-200">{item.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

export function MetricTile({ label, value, hint, tone = "default", compact = false }) {
  const toneClass = tone === "green"
    ? "text-emerald-200"
    : tone === "red"
      ? "text-rose-200"
      : tone === "yellow"
        ? "text-amber-200"
        : tone === "blue"
          ? "text-sky-200"
          : tone === "purple"
            ? "text-purple-200"
            : "text-white";
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.035] ${compact ? "p-3" : "p-4"}`}>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} font-black tracking-tight ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{eyebrow}</div>}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ActionCard({ href, title, description, eyebrow, badge, tone = "emerald" }) {
  const toneClass = tone === "purple" ? "group-hover:text-purple-200" : tone === "sky" ? "group-hover:text-sky-200" : "group-hover:text-emerald-200";
  return (
    <Link href={href} className="sc-card-hover group block rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>}
          <h3 className={`mt-1 text-xl font-black tracking-tight text-white transition ${toneClass}`}>{title}</h3>
        </div>
        {badge && <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-slate-300">{badge}</span>}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-5 text-sm font-black text-slate-200">Open <span aria-hidden="true">→</span></div>
    </Link>
  );
}

export function EmptyState({ title, description, actionHref, actionLabel }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-7 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-lg">○</div>
      <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">{description}</p>}
      {actionHref && actionLabel && <Link href={actionHref} className="sc-button-secondary mt-5 inline-flex">{actionLabel}</Link>}
    </div>
  );
}
