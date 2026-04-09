"use client";

export default function SectionCard({
  title,
  subtitle,
  rightSlot = null,
  children,
  className = "",
}) {
  return (
    <section
      className={`rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg ${className}`}
    >
      {(title || subtitle || rightSlot) ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="text-3xl font-extrabold text-white">{title}</h2>
            ) : null}
            {subtitle ? (
              <p className="mt-2 text-lg text-slate-300">{subtitle}</p>
            ) : null}
          </div>

          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
