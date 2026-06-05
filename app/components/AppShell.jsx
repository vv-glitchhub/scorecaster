import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/betting", label: "Betting" },
  { href: "/open-bets", label: "Open Bets" },
  { href: "/tracking", label: "Tracking" },
  { href: "/agent", label: "Agent" },
  { href: "/agent-memory", label: "Memory" },
  { href: "/reports", label: "Reports" },
  { href: "/simulator", label: "Simulator" },
  { href: "/tournament", label: "Tournament" },
  { href: "/live", label: "Live" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/about", label: "About" }
];

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950">
              S
            </div>

            <div>
              <div className="text-lg font-black tracking-tight">
                Scorecaster
              </div>
              <div className="text-xs text-slate-400">
                AI Sports Intelligence
              </div>
            </div>
          </Link>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:justify-end lg:overflow-visible">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 hover:bg-emerald-400/10 hover:text-emerald-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
