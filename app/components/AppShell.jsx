"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ContextHelp from "./ContextHelp";
import { LanguageSwitcher, useLanguage } from "./LanguageProvider";

function NavIcon({ name }) {
  const icons = {
    home: "⌂",
    picks: "◫",
    agent: "✦",
    portfolio: "◎",
    more: "•••"
  };
  return <span className="text-base leading-none" aria-hidden="true">{icons[name] || "•"}</span>;
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const { t, tr } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const primaryItems = useMemo(() => [
    { href: "/", label: t("nav.home"), short: t("nav.home"), icon: "home" },
    { href: "/betting", label: tr({ fi: "Kohteet", en: "Picks", es: "Pronósticos" }), short: tr({ fi: "Kohteet", en: "Picks", es: "Picks" }), icon: "picks" },
    { href: "/agent", label: tr({ fi: "AI-agentti", en: "AI Agent", es: "Agente IA" }), short: "AI", icon: "agent" },
    { href: "/tracking", label: tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" }), short: tr({ fi: "Salkku", en: "Portfolio", es: "Cartera" }), icon: "portfolio" }
  ], [t, tr]);

  const groups = useMemo(() => [
    {
      title: tr({ fi: "Päivittäinen käyttö", en: "Daily workflow", es: "Flujo diario" }),
      items: [
        { href: "/events", label: tr({ fi: "Varmennetut ottelut", en: "Verified events", es: "Eventos verificados" }), description: tr({ fi: "Markkina, evidenssi ja paperitoiminnot yhdessä.", en: "Market, evidence and paper actions together.", es: "Mercado, evidencia y acciones simuladas." }) },
        { href: "/autonomous-agent", label: tr({ fi: "Autonominen agentti", en: "Autonomous Agent", es: "Agente autónomo" }), description: tr({ fi: "Rajatut päivittäiset paperipäätökset.", en: "Bounded daily paper decisions.", es: "Decisiones simuladas diarias limitadas." }) },
        { href: "/watchlist", label: tr({ fi: "Seurantalista", en: "Watchlist", es: "Lista de seguimiento" }), description: tr({ fi: "Seuraa hintaa ja päätöksen muutoksia.", en: "Track price and decision changes.", es: "Sigue cambios de cuota y decisión." }) },
        { href: "/alerts", label: tr({ fi: "Hälytykset", en: "Alerts", es: "Alertas" }), description: tr({ fi: "Lukemattomat ja ratkaistut ilmoitukset.", en: "Unread and resolved notifications.", es: "Avisos no leídos y resueltos." }) }
      ]
    },
    {
      title: tr({ fi: "Analyysi", en: "Analysis", es: "Análisis" }),
      items: [
        { href: "/analytics", label: tr({ fi: "Tulokset ja kalibrointi", en: "Results & calibration", es: "Resultados y calibración" }), description: tr({ fi: "ROI, CLV, Brier ja paperihistoria.", en: "ROI, CLV, Brier and paper history.", es: "ROI, CLV, Brier e historial simulado." }) },
        { href: "/intelligence", label: tr({ fi: "Evidenssikeskus", en: "Evidence center", es: "Centro de evidencia" }), description: tr({ fi: "Uutiset, poissaolot ja kokoonpanot.", en: "News, injuries and lineups.", es: "Noticias, lesiones y alineaciones." }) },
        { href: "/polymarket-intelligence", label: tr({ fi: "Polymarket-signaali", en: "Polymarket signal", es: "Señal de Polymarket" }), description: tr({ fi: "Toissijainen downgrade-only-riskisignaali.", en: "Secondary downgrade-only risk signal.", es: "Señal secundaria que solo puede rebajar." }) },
        { href: "/market-timeline", label: tr({ fi: "Hintahistoria", en: "Market timeline", es: "Historial de cuotas" }), description: tr({ fi: "Varmennetut hintapisteet ja liikkeet.", en: "Verified prices and movements.", es: "Precios y movimientos verificados." }) },
        { href: "/simulator", label: t("nav.simulator"), description: tr({ fi: "Toistettava ottelusimulaatio ilman rahaa.", en: "Reproducible match simulation without money.", es: "Simulación reproducible sin dinero." }) },
        { href: "/form-rest-lab", label: tr({ fi: "Vire & lepo -labra", en: "Form & rest lab", es: "Laboratorio de forma" }), description: tr({ fi: "Varjomallin kronologinen vertailu.", en: "Chronological shadow-model comparison.", es: "Comparación cronológica del modelo sombra." }) }
      ]
    },
    {
      title: tr({ fi: "Tili ja apu", en: "Account & help", es: "Cuenta y ayuda" }),
      items: [
        { href: "/profile", label: t("more.profile"), description: t("more.profileDescription") },
        { href: "/help", label: t("more.help"), description: t("more.helpDescription") },
        { href: "/risk", label: tr({ fi: "Riskirajat", en: "Risk limits", es: "Límites de riesgo" }), description: tr({ fi: "Virtuaalinen pelikassa ja panosrajat.", en: "Virtual bankroll and stake limits.", es: "Banca virtual y límites de importe." }) },
        { href: "/responsible-use", label: t("footer.responsible"), description: tr({ fi: "Tuoterajat ja vastuullinen käyttö.", en: "Product boundaries and responsible use.", es: "Límites del producto y uso responsable." }) }
      ]
    }
  ], [t, tr]);

  const advancedItems = useMemo(() => [
    { href: "/operations", label: tr({ fi: "Operations", en: "Operations", es: "Operaciones" }) },
    { href: "/release-readiness", label: tr({ fi: "Julkaisuvalmius", en: "Release readiness", es: "Preparación de lanzamiento" }) },
    { href: "/production-status", label: tr({ fi: "Tuotantotila", en: "Production status", es: "Estado de producción" }) },
    { href: "/reports", label: tr({ fi: "Raportit", en: "Reports", es: "Informes" }) },
    { href: "/clv", label: "CLV" },
    { href: "/cloud-sync", label: tr({ fi: "Pilvisynkronointi", en: "Cloud sync", es: "Sincronización" }) },
    { href: "/security", label: tr({ fi: "Turvallisuus", en: "Security", es: "Seguridad" }) }
  ], [tr]);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
    setAdvancedOpen(false);
  }, [pathname]);

  function isActive(item) {
    return pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
  }

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/82 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <div className="flex min-h-[72px] items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/30 bg-emerald-300 text-lg font-black text-emerald-950 shadow-[0_12px_35px_rgba(16,185,129,0.2)] transition group-hover:-translate-y-0.5">S</div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black tracking-[-0.03em] text-white">Scorecaster</div>
                <div className="truncate text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">Decision intelligence</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label={t("nav.mainAria")}>
              {primaryItems.map((item) => (
                <Link key={item.href} href={item.href} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${isActive(item) ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.055] hover:text-white"}`}>
                  {item.label}
                </Link>
              ))}
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen((value) => !value)} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${moreOpen ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.055] hover:text-white"}`} aria-expanded={moreOpen}>
                  {t("nav.more")} <span aria-hidden="true">▾</span>
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-14 z-50 w-[860px] max-w-[92vw] rounded-3xl border border-white/10 bg-slate-950/97 p-5 shadow-[0_32px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                    <div className="grid gap-5 md:grid-cols-3">
                      {groups.map((group) => (
                        <section key={group.title}>
                          <h2 className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2>
                          <div className="space-y-1.5">
                            {group.items.map((item) => (
                              <Link key={item.href} href={item.href} className="block rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-white/10 hover:bg-white/[0.05]">
                                <div className="text-sm font-black text-white">{item.label}</div>
                                <div className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</div>
                              </Link>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
                        <span>{tr({ fi: "Advanced / ylläpito", en: "Advanced / operator", es: "Avanzado / operación" })}</span><span>{advancedOpen ? "−" : "+"}</span>
                      </button>
                      {advancedOpen && <div className="mt-2 flex flex-wrap gap-2">{advancedItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-400 hover:text-white">{item.label}</Link>)}</div>}
                    </div>
                  </div>
                )}
              </div>
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.11em] text-amber-200 sm:block">{t("mode.paper")}</div>
              <LanguageSwitcher compact />
              <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-black text-white lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-menu">
                {menuOpen ? t("nav.close") : t("nav.menu")}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div id="mobile-menu" className="max-h-[calc(100vh-88px)] overflow-y-auto border-t border-white/10 pb-7 pt-4 lg:hidden">
              <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-3 text-center text-xs font-black text-amber-100">{t("mode.paperDescription")}</div>
              <div className="grid grid-cols-2 gap-2">
                {primaryItems.map((item) => <Link key={item.href} href={item.href} className={`rounded-2xl border px-3 py-3 text-center text-sm font-black ${isActive(item) ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : "border-white/10 bg-white/[0.035] text-slate-300"}`}>{item.label}</Link>)}
              </div>
              <div className="mt-6 space-y-6">
                {groups.map((group) => <section key={group.title}><h2 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group.title}</h2><div className="grid gap-2 sm:grid-cols-2">{group.items.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="font-black text-white">{item.label}</div><div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div></Link>)}</div></section>)}
                <section><button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-slate-500"><span>{tr({ fi: "Advanced / ylläpito", en: "Advanced / operator", es: "Avanzado / operación" })}</span><span>{advancedOpen ? "−" : "+"}</span></button>{advancedOpen && <div className="mt-3 flex flex-wrap gap-2">{advancedItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-slate-400">{item.label}</Link>)}</div>}</section>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 pb-28 lg:px-6 lg:py-8 lg:pb-10">
        <ContextHelp />
        {children}
      </main>

      <nav className="sc-safe-bottom fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/10 bg-slate-950/94 px-1 pt-1 backdrop-blur-2xl lg:hidden" aria-label={t("nav.quickAria")}>
        {primaryItems.map((item) => <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] font-black ${isActive(item) ? "bg-emerald-300/10 text-emerald-200" : "text-slate-500"}`}><NavIcon name={item.icon} />{item.short}</Link>)}
        <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black text-slate-500"><NavIcon name="more" />{t("nav.more")}</button>
      </nav>

      <footer className="border-t border-white/10 bg-slate-950/35 py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div><span className="font-black text-slate-300">Scorecaster</span> · {t("footer.summary")}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
            <Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link>
            <Link href="/responsible-use" className="hover:text-white">{t("footer.responsible")}</Link>
            <Link href="/help" className="hover:text-white">{t("nav.help")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
