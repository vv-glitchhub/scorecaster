export default function Panel({ title, subtitle, children, action, className = "" }) {
  return (
    <section className={`sc-surface relative overflow-hidden rounded-[1.65rem] p-5 sm:p-6 ${className}`}>
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--sc-border-strong)] to-transparent" aria-hidden="true" />
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-xl font-black tracking-[-0.035em] text-[var(--sc-text)] sm:text-2xl">{title}</h2>}
            {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
