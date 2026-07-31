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

  const primaryItems = useMemo(() => [
    { href: "/", label: tr({ fi: "Tänään", en: "Today", es: "Hoy" }), short: tr({ fi: "Tänään", en: "Today", es: "Hoy" }), icon: "home" },
    { href: "/feed", label: "AI Feed", short: "AI Feed", icon: "agent" },
    { href: "/events", label: tr({ fi: "Ottelut", en: "Matches", es: "Partidos" }), short: tr({ fi: "Ottelut", en: "Matches", es: "Partidos" }), icon: "picks" },
    { href: "/tracking", label: tr({ fi: "Omat vedot", en: "My picks", es: "Mis apuestas" }), short: tr({ fi: "Vedot", en: "My picks", es: "Apuestas" }), icon: "portfolio" },
    { href: "/profile", label: tr({ fi: "Profiili", en: "Profile", es: "Perfil" }), short: tr({ fi: "Profiili", en: "Profile", es: "Perfil" }), icon: "more" }
  ], [tr]);

  // Kept as non-primary routes so old deep links remain discoverable during rollout.
  const groups = useMemo(() => [
    { href: "/betting", label: tr({ fi: "Kaikki kohteet", en: "All picks", es: "Todos los pronósticos" }) },
    { href: "/agent", label: tr({ fi: "AI-agentti", en: "AI Agent", es: "Agente IA" }) },
    { href: "/tracking", label: tr({ fi: "Paperisalkku", en: "Paper portfolio", es: "Cartera simulada" }) }
  ], [tr]);

  const secondaryItems = useMemo(() => [
    ...groups,
    { href: "/watchlist", label: tr({ fi: "Seurantalista", en: "Watchlist", es: "Seguimiento" }) },
    { href: "/alerts", label: tr({ fi: "Hälytykset", en: "Alerts", es: "Alertas" }) },
    { href: "/analytics", label: tr({ fi: "Tulokset", en: "Results", es: "Resultados" }) },
    { href: "/simulator", label: tr({ fi: "Simulaattori", en: "Simulator", es: "Simulador" }) },
    { href: "/help", label: tr({ fi: "Ohje", en: "Help", es: "Ayuda" }) },
    { href: "/responsible-use", label: tr({ fi: "Vastuullinen käyttö", en: "Responsible use", es: "Uso responsable" }) }
  ], [groups, tr]);

  const operatorItems = useMemo(() => [
    { href: "/production-control-center", label: "Production Control" },
    { href: "/operations", label: "Operations" },
    { href: "/provider-health", label: "Provider Health" },
    { href: "/release-readiness", label: tr({ fi: "Julkaisuvalmius", en: "Release readiness", es: "Preparación" }) },
    { href: "/security", label: tr({ fi: "Turvallisuus", en: "Security", es: "Seguridad" }) }
  ], [tr]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(item) {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  }

  return (
    <div className="min-h-screen text-[var(--sc-text)]">
      <header className="sc-shell-header sticky top-0 z-50 border-b backdrop-blur-2xl">
        <div className="mx-auto max-w-[1480px] px-4 lg:px-7">
          <div className="flex min-h-[72px] items-center justify-between gap-4">
            <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="Scorecaster">
              <BrandMark />
              <div className="min-w-0">
                <div className="truncate text-[1.15rem] font-black tracking-[-0.045em] text-[var(--sc-text)]">Scorecaster</div>
                <div className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sc-muted)]">{tr({ fi: "AI-urheiluanalyysi", en: "AI sports intelligence", es: "Inteligencia deportiva IA" })}</div>
                <span className="hidden">Sports decision OS</span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1.5 lg:flex" aria-label={t("nav.mainAria")}>
              {primaryItems.map((item) => (
                <Link key={item.href} href={item.href} className={`flex min-h-11 items-center gap-2 rounded-[0.9rem] px-4 text-sm font-black transition ${isActive(item) ? "bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)]" : "text-[var(--sc-muted)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-text)]"}`}>
                  <NavIcon name={item.icon} size={17} />{item.label}
                </Link>
              ))}
            </nav>

            <div className="relative flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--sc-text-secondary)] sm:flex"><AppIcon name="shield" size={14} />{t("mode.paper")}</div>
              <ThemeToggle labelDark={tr({ fi: "Tumma tila", en: "Dark mode", es: "Modo oscuro" })} labelLight={tr({ fi: "Vaalea tila", en: "Light mode", es: "Modo claro" })} />
              <LanguageSwitcher compact />
              <button type="button" onClick={() => setMenuOpen((value) => !value)} className="sc-icon-button" aria-expanded={menuOpen} aria-label={tr({ fi: "Avaa lisävalikko", en: "Open more menu", es: "Abrir menú" })}><NavIcon name="more" /></button>

              {menuOpen && (
                <div className="sc-menu-surface absolute right-0 top-14 z-50 w-[min(92vw,520px)] rounded-[1.5rem] p-4 backdrop-blur-2xl">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Lisätoiminnot", en: "More tools", es: "Más herramientas" })}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {secondaryItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-3 py-3 text-sm font-bold text-[var(--sc-text-secondary)] hover:border-[var(--sc-brand-border)] hover:text-[var(--sc-text)]">{item.label}</Link>)}
                  </div>
                  <div className="mt-4 border-t border-[var(--sc-border)] pt-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-faint)]">{tr({ fi: "Ylläpito", en: "Advanced / operator", es: "Avanzado / operación" })}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {operatorItems.map((item) => <Link key={item.href} href={item.href} className="rounded-xl border border-[var(--sc-border)] px-3 py-2 text-xs font-bold text-[var(--sc-muted)] hover:text-[var(--sc-text)]">{item.label}</Link>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="hidden" aria-label={t("nav.quickAria")}>
        {groups.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
      </nav>

      <main className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-5 sm:px-6 lg:px-7 lg:pb-10 lg:pt-7">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--sc-border)] bg-[var(--sc-bg)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl lg:hidden" aria-label={t("nav.mainAria")}>
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {primaryItems.map((item) => (
            <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] font-black transition ${isActive(item) ? "bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "text-[var(--sc-muted)]"}`}>
              <NavIcon name={item.icon} size={19} /><span className="max-w-full truncate">{item.short}</span>
            </Link>
          ))}
        </div>
      </nav>

      <ContextHelp />
    </div>
  );
}
