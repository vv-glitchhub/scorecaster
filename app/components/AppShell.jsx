"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/quick-use", label: "Quick Use" },
  { href: "/production-status", label: "Status" },
  { href: "/core-status", label: "Caster Core" },
  { href: "/risk", label: "Risk" },
  { href: "/agent-v7", label: "Agent V9" },
  { href: "/analytics", label: "Analytics" },
  { href: "/alerts", label: "Alerts" },
  { href: "/paper-trading", label: "Paper Trading" },
  { href: "/betting", label: "Betting" },
  { href: "/open-bets", label: "Open Bets" },
  { href: "/tracking", label: "Tracking" },
  { href: "/agent", label: "Agent" },
  { href: "/agent-memory", label: "Memory" },
  { href: "/reports", label: "Reports" },
  { href: "/clv", label: "CLV" },
  { href: "/bankroll", label: "Bankroll" },
  { href: "/simulator", label: "Simulator" },
  { href: "/tournament", label: "Tournament" },
  { href: "/live", label: "Live" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/ai-research", label: "AI Research" },
  { href: "/about", label: "About" }
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(item) {
    return pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950 shadow-lg md:h-12 md:w-12">
                S
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black tracking-tight md:text-xl">Scorecaster</div>
                <div className="truncate text-xs text-slate-400">AI Sports Intelligence Platform</div>
              </div>
            </Link>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">Production Online</div>
              <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-bold text-purple-300">Agent V9</div>
              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-300">Risk Layer</div>
              <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-300">Local First</div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white lg:hidden"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>

          <nav className="hidden gap-2 overflow-x-auto pb-4 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  isActive(item)
                    ? "bg-emerald-400 text-slate-950"
                    : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {menuOpen && (
            <div className="pb-4 lg:hidden">
              <div className="mb-3 grid grid-cols-4 gap-2 text-[11px] font-bold">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-2 py-2 text-center text-emerald-300">Online</div>
                <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 px-2 py-2 text-center text-purple-300">Agent V9</div>
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-2 py-2 text-center text-yellow-300">Risk</div>
                <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-2 py-2 text-center text-sky-300">Local</div>
              </div>

              <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-xl px-3 py-3 text-center text-sm font-bold transition-all ${
                      isActive(item)
                        ? "bg-emerald-400 text-slate-950"
                        : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <footer className="border-t border-white/10 py-6">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-2 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} Scorecaster</div>
            <div className="flex flex-wrap gap-4">
              <Link href="/production-status" className="hover:text-white">Production Status</Link>
              <Link href="/api/health" className="hover:text-white">Health API</Link>
              <span>Agent V9</span>
              <span>Risk Layer</span>
              <span>CLV</span>
              <span>Paper Trading</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
