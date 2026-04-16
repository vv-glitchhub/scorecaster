"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n";

export default function AppShellNavClient({ lang = "fi" }) {
  const pathname = usePathname();
  const t = getDictionary(lang);

  const isActive = (href) => pathname === href;

  const navItems = [
    { href: "/", label: t.navDashboard },
    { href: "/betting", label: t.navBetting },
    { href: "/simulator", label: t.navSimulator },
    { href: "/about", label: t.navAbout },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(2,6,23,0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "20px 16px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "clamp(28px, 7vw, 48px)",
                fontWeight: 800,
                lineHeight: 1,
                color: "#fff",
              }}
            >
              Scorecaster
            </div>

            <div
              style={{
                fontSize: "clamp(14px, 3vw, 18px)",
                color: "#94a3b8",
                marginTop: "10px",
                lineHeight: 1.4,
              }}
            >
              {t.brandTagline}
            </div>
          </div>

          <LanguageSwitcher lang={lang} />
        </div>

        <nav
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "28px",
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "56px",
                  borderRadius: "20px",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: "clamp(16px, 4vw, 20px)",
                  color: isActive(item.href) ? "#041016" : "#dbe4f0",
                  background: isActive(item.href) ? "#22c55e" : "transparent",
                  border: isActive(item.href)
                    ? "1px solid rgba(34,197,94,0.8)"
                    : "1px solid transparent",
                  transition: "0.2s ease",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
