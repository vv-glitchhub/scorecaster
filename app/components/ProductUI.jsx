import Link from "next/link";
import { AppIcon, TeamCrest } from "./BrandUI";

const decisionStyles = {
  PLAY: "border-emerald-400/35 bg-emerald-400/12 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.1)]",
  BET: "border-emerald-400/35 bg-emerald-400/12 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.1)]",
  CAUTION: "border-amber-400/35 bg-amber-400/11 text-amber-300",
  WATCH: "border-amber-400/35 bg-amber-400/11 text-amber-300",
  WAIT: "border-amber-400/35 bg-amber-400/11 text-amber-300",
  SKIP: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  PASS: "border-rose-400/30 bg-rose-400/10 text-rose-300"
};

const metricTones = {
  green: "text-emerald-300 before:bg-emerald-400",
  red: "text-rose-300 before:bg-rose-400",
  yellow: "text-amber-300 before:bg-amber-400",
  blue: "text-sky-300 before:bg-sky-400",
  purple: "text-purple-300 before:bg-purple-400",
  default: "text-[var(--sc-text)] before:bg-[var(--sc-border-strong)]"
};

export function DecisionBadge({ decision = "CAUTION", className = "" }) {
  const normalized = String(decision || "CAUTION").toUpperCase();
  return (
    <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.15em] ${decisionStyles[normalized] || decisionStyles.CAUTION} ${className}`}>
      <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-25" /><span className="relative h-2 w-2 rounded-full bg-current" /></span>
      {normalized}
    </span>
  );
}

export function PageHero({ eyebrow, title, description, actions, aside, tone = "emerald" }) {
  const toneGlow = tone === "purple"
    ? "bg-purple-400/20"
    : tone === "sky"
      ? "bg-sky-400/18"
      : "bg-[var(--sc-brand-soft)]";

  return (
    <section className="sc-surface relative isolate overflow-hidden rounded-[1.75rem] p-5 sm:rounded-[2.15rem] sm:p-6 md:p-9 lg:p-10">
      <div className={`pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full blur-3xl ${toneGlow}`} />
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(var(--sc-text)_1px,transparent_1px),linear-gradient(90deg,var(--sc-text)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--sc-brand)] to-transparent opacity-45" />
      <div className="relative grid gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-end">
        <div className="max-w-4xl">
          {eyebrow && <div className="sc-kicker">{eyebrow}</div>}
          <h1 className="mt-4 text-balance text-[clamp(2rem,8vw,4.6rem)] font-black leading-[1.02] tracking-[-0.05em] text-[var(--sc-text)] sm:mt-5 sm:leading-[0.98] sm:tracking-[-0.055em]">{title}</h1>
          {description && <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--sc-text-secondary)] sm:mt-5 sm:text-base sm:leading-7 md:text-lg md:leading-8">{description}</p>}
          {actions && <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap">{actions}</div>}
        </div>
        {aside && <div className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 shadow-inner backdrop-blur-xl sm:rounded-[1.45rem] sm:p-5">{aside}</div>}
      </div>
    </section>
  );
}

export function TrustBar({ items = [], className = "" }) {
  const safeItems = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "");
  if (!safeItems.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-2 text-xs ${className}`}>
      {safeItems.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-[var(--sc-muted)]">
          <span className={`h-2 w-2 shrink-0 rounded-full shadow-[0_0_12px_currentColor] ${item.tone === "warning" ? "bg-amber-400 text-amber-400" : item.tone === "danger" ? "bg-rose-400 text-rose-400" : item.tone === "info" ? "bg-sky-400 text-sky-400" : "bg-[var(--sc-brand)] text-[var(--sc-brand)]"}`} />
          <span className="min-w-0 truncate"><span className="text-[var(--sc-faint)]">{item.label}</span> <strong className="font-black text-[var(--sc-text-secondary)]">{item.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

export function MetricTile({ label, value, hint, tone = "default", compact = false }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] ${compact ? "p-3.5" : "p-4.5"}`}>
      <span className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full before:absolute before:inset-0 ${metricTones[tone] || metricTones.default}`} aria-hidden="true" />
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{label}</div>
      <div className={`${compact ? "mt-1.5 text-xl" : "mt-2 text-[1.65rem]"} font-black tracking-[-0.035em] ${metricTones[tone]?.split(" before:")[0] || "text-[var(--sc-text)]"}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs leading-5 text-[var(--sc-muted)]">{hint}</div>}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-brand)]">{eyebrow}</div>}
        <h2 className="mt-1.5 text-2xl font-black tracking-[-0.035em] text-[var(--sc-text)] md:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ActionCard({ href, title, description, eyebrow, badge, tone = "emerald" }) {
  const accent = tone === "purple" ? "bg-purple-400" : tone === "sky" ? "bg-sky-400" : "bg-[var(--sc-brand)]";
  return (
    <Link href={href} className="sc-card-hover group relative block overflow-hidden rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5.5">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${accent}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{eyebrow}</div>}
          <h3 className="mt-1.5 text-xl font-black tracking-[-0.03em] text-[var(--sc-text)]">{title}</h3>
        </div>
        {badge && <span className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-2.5 py-1 text-[10px] font-black text-[var(--sc-text-secondary)]">{badge}</span>}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{description}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-[var(--sc-text-secondary)] transition group-hover:gap-2.5 group-hover:text-[var(--sc-brand)]">Open <AppIcon name="chevron" size={15} /></div>
    </Link>
  );
}

export function MatchIdentity({ homeTeam, awayTeam, meta, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex shrink-0 -space-x-2"><TeamCrest name={homeTeam} size={compact ? "sm" : "md"} /><TeamCrest name={awayTeam} size={compact ? "sm" : "md"} /></div>
      <div className="min-w-0">
        <div className={`${compact ? "text-sm" : "text-lg"} truncate font-black tracking-[-0.025em] text-[var(--sc-text)]`}>{homeTeam || "Home"} <span className="font-bold text-[var(--sc-faint)]">vs</span> {awayTeam || "Away"}</div>
        {meta && <div className="mt-0.5 truncate text-xs text-[var(--sc-muted)]">{meta}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, actionHref, actionLabel }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--sc-border-strong)] bg-[var(--sc-surface-soft)] p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-strong)] text-[var(--sc-brand)]"><AppIcon name="agent" size={20} /></div>
      <h3 className="mt-4 text-lg font-black tracking-tight text-[var(--sc-text)]">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--sc-muted)]">{description}</p>}
      {actionHref && actionLabel && <Link href={actionHref} className="sc-button-secondary mt-5 inline-flex">{actionLabel}</Link>}
    </div>
  );
}
