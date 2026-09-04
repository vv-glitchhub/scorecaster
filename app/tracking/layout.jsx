"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "../components/LanguageProvider";
import { ProfessionalPortfolioRail } from "../components/ProfessionalSurfaceRail";

export default function TrackingLayout({ children }) {
  const pathname = usePathname();
  const { tr } = useLanguage();
  const tabs = [
    {
      href: "/tracking",
      label: tr({ fi: "Kohteet", en: "Picks", es: "Pronósticos" }),
      description: tr({ fi: "Yksittäiset paperikohteet", en: "Single paper picks", es: "Pronósticos individuales" })
    },
    {
      href: "/tracking/coupons",
      label: tr({ fi: "Kupongit", en: "Coupons", es: "Cupones" }),
      description: tr({ fi: "Yhdistelmät ja tilat", en: "Accumulators and status", es: "Combinadas y estado" })
    }
  ];

  return (
    <div className="space-y-8">
      <ProfessionalPortfolioRail />
      <nav aria-label={tr({ fi: "Omat vedot -näkymät", en: "My Picks views", es: "Vistas de Mis apuestas" })} className="grid gap-2 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2 sm:grid-cols-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl border px-4 py-3 transition ${active ? "border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] text-[var(--sc-text)]" : "border-transparent text-[var(--sc-muted)] hover:border-[var(--sc-border)] hover:bg-[var(--sc-surface-soft)] hover:text-[var(--sc-text)]"}`}
            >
              <div className="text-sm font-black">{tab.label}</div>
              <div className="mt-0.5 text-xs opacity-75">{tab.description}</div>
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
