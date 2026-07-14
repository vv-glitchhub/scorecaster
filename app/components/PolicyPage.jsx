import Link from "next/link";

export default function PolicyPage({ title, intro, sections }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Scorecaster policy</div>
        <h1 className="text-3xl font-black text-white md:text-4xl">{title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-300">{intro}</p>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-black text-white">{section.title}</h2>
          <div className="mt-3 space-y-3 leading-7 text-slate-300">
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-3 pb-6">
        <Link href="/security" className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950">Security</Link>
        <Link href="/privacy" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Privacy</Link>
        <Link href="/terms" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Terms</Link>
        <Link href="/responsible-use" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-white">Responsible use</Link>
      </div>
    </div>
  );
}
