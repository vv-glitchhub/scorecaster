export default function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-xl font-black">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
