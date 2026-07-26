"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ContextHelp from "./ContextHelp";
import { LanguageSwitcher, useLanguage } from "./LanguageProvider";
import { AppIcon, BrandMark, ThemeToggle } from "./BrandUI";

function NavIcon({ name, size = 19 }) {
  return <AppIcon name={name} size={size} />;
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
        { href: "/diagnostics-v2", label: tr({ fi: "Päätösdiagnostiikka V2", en: "Decision Diagnostics V2", es: "Diagnóstico V2" }), description: tr({ fi: "Historia, incidentit, tulokset, CLV ja kynnysarvosimulaatio.", en: "History, incidents, outcomes, CLV and threshold simulation.", es: "Historial, incidencias, resultados, CLV y simulación." }) },
        { href: "/sports-analytics", label: tr({ fi: "Sports Analytics", en: "Sports Analytics", es: "Sports Analytics" }), description: tr({ fi: "Automaattiset havainnot, x-mittarit, tracking-kattavuus ja golf-profiilit.", en: "Automatic observations, expected metrics, tracking coverage and golf profiles.", es: "Observaciones automáticas, métricas y perfiles de golf." }) },
        { href: "/provider-health", label: "Provider Health", description: tr({ fi: "Saatavuus, tuoreus ja liigakohtainen datakattavuus.", en: "Availability, freshness and league-level data coverage.", es: "Disponibilidad, actualidad y cobertura por liga." }) },
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
    <div className="min-h-screen text-[var(--sc-text)]">
      <header className="sc-shell-header sticky top-0 z-50 border-b backdrop-blur-2xl">
        <div className="mx-auto max-w-[1480px] px-4 lg:px-7">
          <div className="flex min-h-[76px] items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3.5" aria-label="Scorecaster">
              <BrandMark />
              <div className="min-w-0"><div className="truncate text-[1.15rem] font-black tracking-[-0.045em] text-[var(--sc-text)]">Scorecaster</div><div className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-muted)]">Sports decision OS</div></div>
            </Link>

            <nav className="hidden items-center gap-1.5 lg:flex" aria-label={t("nav.mainAria")}>
              {primaryItems.map((item) => <Link key={item.href} href={item.href} className={`flex min-h-11 items-center gap-2 rounded-[0.9rem] px-4 text-sm font-black transition ${isActive(item) ? "bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-text)]"}`}><NavIcon name={item.icon} size={17} />{item.label}</Link>)}
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen((value) => !value)} className={`flex min-h-11 items-center gap-2 rounded-[0.9rem] px-4 text-sm font-black transition ${moreOpen ? "bg-[var(--sc-surface-hover)] text-[var(--sc-text)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-text)]"}`} aria-expanded={moreOpen}><NavIcon name="more" size={18} />{t("nav.more")}</button>
                {moreOpen && <div className="sc-menu-surface absolute right-0 top-14 z-50 w-[900px] max-w-[92vw] rounded-[1.7rem] p-5 backdrop-blur-2xl"><div className="grid gap-5 md:grid-cols-3">{groups.map((group) => <section key={group.title}><h2 className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-faint)]">{group.title}</h2><div className="space-y-1.5">{group.items.map((item) => <Link key={item.href} href={item.href} className="group block rounded-[1.05rem] border border-transparent px-3 py-2.5 transition hover:border-[var(--sc-border)] hover:bg-[var(--sc-surface-soft)]"><div className="flex items-center justify-between gap-3"><div className="text-sm font-black text-[var(--sc-text)]">{item.label}</div><AppIcon name="chevron" size={15} className="text-[var(--sc-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--sc-brand)]" /></div><div className="mt-0.5 text-xs leading-5 text-[var(--sc-muted)]">{item.description}</div></Link>)}</div></section>)}</div><div className="mt-5 border-t border-[var(--sc-border)] pt-4"><button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-muted)]"><span>{tr({ fi: "Advanced / ylläpito", en: "Advanced / operator", es: "Avanzado / operación" })}</span><span>{advancedOpen ? "−" : "+"}</span></button>{advancedOpen && <div className="mt-2 flex flex-wrap gap-2">{advancedItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--sc-muted)] hover:border-[var(--sc-brand-border)] hover:text-[var(--sc-text)]">{item.label}</Link>)}</div>}</div></div>}
              </div>
            </nav>

            <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--sc-text-secondary)] sm:flex"><AppIcon name="shield" size={14} />{t("mode.paper")}</div><ThemeToggle labelDark={tr({ fi: "Tumma tila", en: "Dark mode", es: "Modo oscuro" })} labelLight={tr({ fi: "Vaalea tila", en: "Light mode", es: "Modo claro" })} /><LanguageSwitcher compact /><button type="button" onClick={() => setMenuOpen((value) => !value)} className="sc-icon-button lg:hidden" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? t("nav.close") : t("nav.menu")}><NavIcon name="more" /></button></div>
          </div>

          {menuOpen && <div id="mobile-menu" className="max-h-[calc(100vh-92px)] overflow-y-auto border-t border-[var(--sc-border)] pb-7 pt-4 lg:hidden"><div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-3 text-center text-xs font-black text-[var(--sc-text-secondary)]"><AppIcon name="shield" size={15} />{t("mode.paperDescription")}</div><div className="grid grid-cols-2 gap-2">{primaryItems.map((item) => <Link key={item.href} href={item.href} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center text-sm font-black ${isActive(item) ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)] text-[var(--sc-text-secondary)]"}`}><NavIcon name={item.icon} />{item.label}</Link>)}</div><div className="mt-6 space-y-6">{groups.map((group) => <section key={group.title}><h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-faint)]">{group.title}</h2><div className="grid gap-2 sm:grid-cols-2">{group.items.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{item.label}</div><div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{item.description}</div></Link>)}</div></section>)}<section><button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-faint)]"><span>{tr({ fi: "Advanced / ylläpito", en: "Advanced / operator", es: "Avanzado / operación" })}</span><span>{advancedOpen ? "−" : "+"}</span></button>{advancedOpen && <div className="mt-3 flex flex-wrap gap-2">{advancedItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--sc-muted)]">{item.label}</Link>)}</div>}</section></div></div>}
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-6 pb-28 lg:px-7 lg:py-9 lg:pb-12"><ContextHelp /><div className="sc-rise-in">{children}</div></main>

      <nav className="sc-safe-bottom sc-shell-header fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t px-1 pt-1 backdrop-blur-2xl lg:hidden" aria-label={t("nav.quickAria")}>
        {primaryItems.map((item) => <Link key={item.href} href={item.href} className={`relative flex min-h-[3.7rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] font-black ${isActive(item) ? "text-[var(--sc-text)]" : "text-[var(--sc-faint)]"}`}>{isActive(item) && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-[var(--sc-brand)] shadow-[0_0_16px_var(--sc-brand)]" />}<NavIcon name={item.icon} />{item.short}</Link>)}
        <button type="button" onClick={() => setMenuOpen(true)} className="flex min-h-[3.7rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-black text-[var(--sc-faint)]"><NavIcon name="more" />{t("nav.more")}</button>
      </nav>

      <footer className="border-t border-[var(--sc-border)] bg-[var(--sc-surface-soft)] py-9"><div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-4 text-sm text-[var(--sc-muted)] sm:flex-row sm:items-center sm:justify-between lg:px-7"><div className="flex items-center gap-3"><BrandMark compact /><div><div className="font-black text-[var(--sc-text)]">Scorecaster</div><div className="text-xs">{t("footer.summary")}</div></div></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold"><Link href="/privacy" className="hover:text-[var(--sc-text)]">{t("footer.privacy")}</Link><Link href="/terms" className="hover:text-[var(--sc-text)]">{t("footer.terms")}</Link><Link href="/responsible-use" className="hover:text-[var(--sc-text)]">{t("footer.responsible")}</Link><Link href="/help" className="hover:text-[var(--sc-text)]">{t("nav.help")}</Link></div></div></footer>
    </div>
  );
}
