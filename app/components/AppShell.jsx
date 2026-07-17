"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ContextHelp from "./ContextHelp";

const primaryItems = [
  { href: "/", label: "Etusivu", short: "Etusivu" },
  { href: "/betting", label: "Kohteet", short: "Kohteet" },
  { href: "/agent", label: "AI-analyysi", short: "AI" },
  { href: "/tracking", label: "Seuranta", short: "Seuranta" },
  { href: "/analytics", label: "Analyysi", short: "Analyysi" },
  { href: "/simulator", label: "Simulaattori", short: "Simulaattori" }
];

const secondaryGroups = [
  {
    title: "Aloita ja hallitse",
    items: [
      { href: "/quick-use", label: "Nopea paperikohde", description: "Lisää oma kohde ilman oikeaa rahaa." },
      { href: "/risk", label: "Riskiasetukset", description: "Virtuaalikassa ja paperirajat." },
      { href: "/paper-trading", label: "Paperisalkku", description: "Virtuaaliset panokset ja altistus." },
      { href: "/cloud-sync", label: "Pilvisynkronointi", description: "Siirrä paikallinen historia omalle tilille." }
    ]
  },
  {
    title: "Tili ja apu",
    items: [
      { href: "/profile", label: "Profiili", description: "Tili, tietojen vienti ja poistaminen." },
      { href: "/help", label: "Ohje", description: "Selkokielinen käyttöopas ja termit." },
      { href: "/responsible-use", label: "Vastuullinen käyttö", description: "Paperitilan rajat ja turvallinen käyttö." },
      { href: "/security", label: "Tietoturva", description: "Miten Scorecaster suojaa tietoja." }
    ]
  },
  {
    title: "Edistyneet työkalut",
    items: [
      { href: "/intelligence", label: "Intelligence", description: "Markkina- ja malliauditointi." },
      { href: "/clv", label: "CLV", description: "Päätöskertoimen seuranta." },
      { href: "/reports", label: "Raportit", description: "Koosteet ja suorituskyky." },
      { href: "/production-status", label: "Järjestelmän tila", description: "Palveluiden ja integraatioiden valmius." }
    ]
  }
];

const mobileItems = primaryItems.slice(0, 5);

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  function isActive(item) {
    return pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between gap-3 py-3 md:py-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950 shadow-lg md:h-12 md:w-12">
                S
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black tracking-tight md:text-xl">Scorecaster</div>
                <div className="truncate text-xs text-slate-400">Urheiluanalyysi ja paperiseuranta</div>
              </div>
            </Link>

            <div className="hidden items-center gap-2 md:flex">
              <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-black text-yellow-200">
                PAPERITILA · EI OIKEAA RAHAA
              </div>
              <Link href="/help" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">
                Ohje
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              {menuOpen ? "Sulje" : "Valikko"}
            </button>
          </div>

          <div className="hidden items-center gap-2 pb-4 lg:flex">
            <nav className="flex flex-1 gap-2" aria-label="Päävalikko">
              {primaryItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                    isActive(item)
                      ? "bg-emerald-400 text-slate-950"
                      : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((value) => !value)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/[0.08]"
                aria-expanded={moreOpen}
              >
                Lisää ▾
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-12 z-50 w-[680px] max-w-[90vw] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
                  <div className="grid gap-4 md:grid-cols-3">
                    {secondaryGroups.map((group) => (
                      <section key={group.title}>
                        <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2>
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <Link key={item.href} href={item.href} className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.08]">
                              <div className="text-sm font-black text-white">{item.label}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div>
                            </Link>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {menuOpen && (
            <div id="mobile-navigation" className="max-h-[72vh] overflow-y-auto pb-4 lg:hidden">
              <div className="mb-3 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-center text-xs font-black text-yellow-200">
                Paperitila: Scorecaster ei aseta oikean rahan vetoja.
              </div>

              <nav className="grid grid-cols-2 gap-2" aria-label="Mobiilin päävalikko">
                {primaryItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-3 text-center text-sm font-bold ${
                      isActive(item)
                        ? "bg-emerald-400 text-slate-950"
                        : "border border-white/10 bg-white/[0.04] text-slate-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-5 space-y-5">
                {secondaryGroups.slice(0, 2).map((group) => (
                  <section key={group.title}>
                    <h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="text-sm font-black text-white">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-400">{item.description}</div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-8">
        <ContextHelp />
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/10 bg-slate-950/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden" aria-label="Pikavalikko">
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-14 items-center justify-center rounded-xl px-1 text-center text-[11px] font-black ${
              isActive(item) ? "bg-emerald-400/15 text-emerald-300" : "text-slate-500"
            }`}
          >
            {item.short}
          </Link>
        ))}
      </nav>

      <footer className="border-t border-white/10 py-7">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} Scorecaster · urheiluanalyysi ja paperiseuranta</div>
            <div className="flex flex-wrap gap-4">
              <Link href="/help" className="hover:text-white">Ohje</Link>
              <Link href="/profile" className="hover:text-white">Tili</Link>
              <Link href="/privacy" className="hover:text-white">Tietosuoja</Link>
              <Link href="/terms" className="hover:text-white">Ehdot</Link>
              <Link href="/responsible-use" className="hover:text-white">Vastuullinen käyttö</Link>
              <Link href="/production-status" className="hover:text-white">Tila</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
