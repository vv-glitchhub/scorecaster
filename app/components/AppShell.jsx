"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ContextHelp from "./ContextHelp";
import { LanguageSwitcher, useLanguage } from "./LanguageProvider";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { t, tr } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = useMemo(() => [
    { href: "/", label: t("nav.home"), short: t("nav.home") },
    { href: "/betting", label: t("nav.picks"), short: t("nav.picks") },
    { href: "/agent", label: t("nav.ai"), short: "AI" },
    { href: "/tracking", label: t("nav.tracking"), short: t("nav.tracking") },
    { href: "/analytics", label: t("nav.analytics"), short: t("nav.analytics") },
    { href: "/simulator", label: t("nav.simulator"), short: t("nav.simulator") }
  ], [t]);

  const watchlistItem = useMemo(() => ({
    href: "/watchlist",
    label: tr({ fi: "Seurantalista", en: "Watchlist", es: "Lista de seguimiento" }),
    description: tr({ fi: "Todennetut hinta- ja päätösmuutokset.", en: "Verified price and decision changes.", es: "Cambios verificados de cuota y decisión." })
  }), [tr]);

  const eventsItem = useMemo(() => ({
    href: "/events",
    label: tr({ fi: "Varmennetut ottelut", en: "Verified events", es: "Eventos verificados" }),
    description: tr({ fi: "Avaa markkina, evidenssi, vire ja paperitoiminnot yhdessä näkymässä.", en: "Open market, evidence, form and paper actions in one view.", es: "Abre mercado, evidencia, forma y acciones simuladas en una sola vista." })
  }), [tr]);

  const formRestLabItem = useMemo(() => ({
    href: "/form-rest-lab",
    label: tr({ fi: "Vire- ja lepomallin laboratorio", en: "Form & Rest Model Lab", es: "Laboratorio de forma y descanso" }),
    description: tr({ fi: "Varjomallin kronologinen vertailu markkinakonsensukseen.", en: "Chronological shadow-model comparison against market consensus.", es: "Comparación cronológica del modelo sombra con el consenso de mercado." })
  }), [tr]);

  const secondaryGroups = useMemo(() => [
    {
      title: t("group.start"),
      items: [
        eventsItem,
        watchlistItem,
        { href: "/quick-use", label: t("more.quick"), description: t("more.quickDescription") },
        { href: "/risk", label: t("more.risk"), description: t("more.riskDescription") },
        { href: "/paper-trading", label: t("more.portfolio"), description: t("more.portfolioDescription") },
        { href: "/cloud-sync", label: t("more.cloud"), description: t("more.cloudDescription") }
      ]
    },
    {
      title: t("group.account"),
      items: [
        { href: "/profile", label: t("more.profile"), description: t("more.profileDescription") },
        { href: "/help", label: t("more.help"), description: t("more.helpDescription") },
        { href: "/responsible-use", label: t("more.responsible"), description: t("more.responsibleDescription") },
        { href: "/security", label: t("more.security"), description: t("more.securityDescription") }
      ]
    },
    {
      title: t("group.advanced"),
      items: [
        formRestLabItem,
        { href: "/intelligence", label: t("more.intelligence"), description: t("more.intelligenceDescription") },
        { href: "/clv", label: t("more.clv"), description: t("more.clvDescription") },
        { href: "/reports", label: t("more.reports"), description: t("more.reportsDescription") },
        { href: "/production-status", label: t("more.status"), description: t("more.statusDescription") }
      ]
    }
  ], [t, eventsItem, watchlistItem, formRestLabItem]);

  const mobileItems = primaryItems.slice(0, 5);

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
            <Link href="/" className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 font-black text-slate-950 shadow-lg md:h-12 md:w-12">S</div><div className="min-w-0"><div className="truncate text-lg font-black tracking-tight md:text-xl">Scorecaster</div><div className="truncate text-xs text-slate-400">{t("brand.tagline")}</div></div></Link>
            <div className="hidden items-center gap-2 md:flex"><div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-black text-yellow-200">{t("mode.paper")}</div><LanguageSwitcher compact /><Link href="/help" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">{t("nav.help")}</Link></div>
            <div className="flex items-center gap-2 lg:hidden"><LanguageSwitcher compact /><button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white" aria-expanded={menuOpen} aria-controls="mobile-navigation">{menuOpen ? t("nav.close") : t("nav.menu")}</button></div>
          </div>

          <div className="hidden items-center gap-2 pb-4 lg:flex"><nav className="flex flex-1 gap-2" aria-label={t("nav.mainAria")}>{primaryItems.map((item) => <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${isActive(item) ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}>{item.label}</Link>)}</nav><div className="relative"><button type="button" onClick={() => setMoreOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/[0.08]" aria-expanded={moreOpen}>{t("nav.more")} ▾</button>{moreOpen && <div className="absolute right-0 top-12 z-50 w-[720px] max-w-[90vw] rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl"><div className="grid gap-4 md:grid-cols-3">{secondaryGroups.map((group) => <section key={group.title}><h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2><div className="space-y-2">{group.items.map((item) => <Link key={item.href} href={item.href} className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.08]"><div className="text-sm font-black text-white">{item.label}</div><div className="mt-1 text-xs leading-5 text-slate-400">{item.description}</div></Link>)}</div></section>)}</div></div>}</div></div>

          {menuOpen && <div id="mobile-navigation" className="max-h-[72vh] overflow-y-auto pb-4 lg:hidden"><div className="mb-3 rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-center text-xs font-black text-yellow-200">{t("mode.paperDescription")}</div><nav className="grid grid-cols-2 gap-2" aria-label={t("nav.mobileAria")}>{primaryItems.map((item) => <Link key={item.href} href={item.href} className={`rounded-xl px-3 py-3 text-center text-sm font-bold ${isActive(item) ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-slate-300"}`}>{item.label}</Link>)}</nav><div className="mt-5 space-y-5">{secondaryGroups.map((group) => <section key={group.title}><h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2><div className="grid gap-2 sm:grid-cols-2">{group.items.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="text-sm font-black text-white">{item.label}</div><div className="mt-1 text-xs text-slate-400">{item.description}</div></Link>)}</div></section>)}</div></div>}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-8"><ContextHelp />{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/10 bg-slate-950/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden" aria-label={t("nav.quickAria")}>{mobileItems.map((item) => <Link key={item.href} href={item.href} className={`flex min-h-14 items-center justify-center rounded-xl px-1 text-center text-[11px] font-black ${isActive(item) ? "bg-emerald-400/15 text-emerald-300" : "text-slate-500"}`}>{item.short}</Link>)}</nav>
      <footer className="border-t border-white/10 py-7"><div className="mx-auto max-w-7xl px-4"><div className="flex flex-col gap-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><div>© {new Date().getFullYear()} Scorecaster · {t("footer.summary")}</div><div className="flex flex-wrap gap-4"><Link href="/help" className="hover:text-white">{t("nav.help")}</Link><Link href="/profile" className="hover:text-white">{t("footer.account")}</Link><Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link><Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link><Link href="/responsible-use" className="hover:text-white">{t("footer.responsible")}</Link><Link href="/production-status" className="hover:text-white">{t("footer.status")}</Link></div></div></div></footer>
    </div>
  );
}
