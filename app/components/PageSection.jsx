export default function PageSection({
  title,
  description,
  rightSlot,
  children,
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          ) : null}
        </div>

        {rightSlot ? <div>{rightSlot}</div> : null}
      </div>

      <div>{children}</div>
    </section>
  );
}
