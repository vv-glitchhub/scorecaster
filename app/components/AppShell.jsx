"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/ai-research", label: "AI Research" },

  { href: "/about", label: "About" }
];

export default function AppShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950 shadow-lg">
                S
              </div>

              <div>
                <div className="text-xl font-black tracking-tight">
                  Scorecaster
                </div>

                <div className="text-xs text-slate-400">
                  AI Sports Intelligence Platform
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
                Agent V5
              </div>

              <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-bold text-purple-300">
                Intelligence Layer
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-4">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    active
                      ? "bg-emerald-400 text-slate-950"
                      : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-2 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <div>
              © {new Date().getFullYear()} Scorecaster
            </div>

            <div className="flex flex-wrap gap-4">
              <span>AI Agent V5</span>
              <span>Market Intelligence</span>
              <span>Data Readiness</span>
              <span>Tournament Simulator</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
