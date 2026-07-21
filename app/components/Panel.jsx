export default function Panel({ title, subtitle, children, action, className = "" }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-6 ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>}
            {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
