import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/betting", label: "Betting" },
  { href: "/live", label: "Live" },
  { href: "/simulator", label: "Simulator" },
  { href: "/tracking", label: "Tracking" },
  { href: "/agent", label: "AI Agent" },
];

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black text-slate-950">
              S
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">Scorecaster</div>
              <div className="text-xs text-slate-400">AI Sports Intelligence</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
            Demo Mode
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
