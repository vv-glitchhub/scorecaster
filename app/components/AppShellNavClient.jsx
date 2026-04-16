"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n";

export default function AppShellNavClient({ lang = "fi" }) {
  const pathname = usePathname();
  const t = getDictionary(lang);
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: t.navDashboard },
    { href: "/betting", label: t.navBetting },
    { href: "/simulator", label: t.navSimulator },
    { href: "/about", label: t.navAbout },
  ];

  const isActive = (href) => pathname === href;

  function closeMenu() {
    setMenuOpen(false);
  }

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
          padding: "18px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          <div style={{ minWidth: 0 }}>
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "12px",
            }}
          >
            <LanguageSwitcher lang={lang} />

            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                borderRadius: "14px",
                padding: "10px 14px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                minWidth: "64px",
              }}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            style={{
              marginTop: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "24px",
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "12px",
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "54px",
                    borderRadius: "18px",
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: "20px",
                    color: isActive(item.href) ? "#041016" : "#dbe4f0",
                    background: isActive(item.href) ? "#22c55e" : "transparent",
                    border: isActive(item.href)
                      ? "1px solid rgba(34,197,94,0.8)"
                      : "1px solid rgba(255,255,255,0.08)",
                    transition: "0.2s ease",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
