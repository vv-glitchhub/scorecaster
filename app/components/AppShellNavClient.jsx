"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n";

export default function AppShellNavClient({ lang = "fi" }) {
  const pathname = usePathname();
  const t = getDictionary(lang);

  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 900);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);

    return () => {
      window.removeEventListener("resize", checkViewport);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobile && menuOpen) {
      setMenuOpen(false);
    }
  }, [isMobile, menuOpen]);

  const navItems = useMemo(
    () => [
      { href: "/", label: t.navDashboard },
      { href: "/betting", label: t.navBetting },
      { href: "/simulator", label: t.navSimulator },
      { href: "/about", label: t.navAbout },
    ],
    [t]
  );

  const isActive = (href) => pathname === href;

  const linkStyle = (active, mobile = false) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: mobile ? "flex-start" : "center",
    width: "100%",
    minHeight: mobile ? "48px" : "44px",
    padding: mobile ? "0 14px" : "0 16px",
    borderRadius: mobile ? "14px" : "14px",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: mobile ? "16px" : "15px",
    lineHeight: 1.2,
    color: active ? "#041016" : "#dbe4f0",
    background: active ? "#22c55e" : "transparent",
    border: active
      ? "1px solid rgba(34,197,94,0.85)"
      : "1px solid rgba(255,255,255,0.08)",
    transition: "all 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  });

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: "rgba(2,6,23,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: isMobile ? "12px 14px" : "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link
              href="/"
              style={{
                display: "inline-block",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? "24px" : "32px",
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                }}
              >
                Scorecaster
              </div>
            </Link>

            <div
              style={{
                fontSize: isMobile ? "12px" : "14px",
                color: "#94a3b8",
                marginTop: "6px",
                lineHeight: 1.35,
                maxWidth: isMobile ? "220px" : "100%",
                whiteSpace: "normal",
              }}
            >
              {t.brandTagline}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <LanguageSwitcher lang={lang} />

            {isMobile ? (
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "44px",
                  height: "44px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  borderRadius: "12px",
                  fontSize: "18px",
                  fontWeight: 800,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {menuOpen ? "✕" : "☰"}
              </button>
            ) : null}
          </div>
        </div>

        {!isMobile ? (
          <nav
            style={{
              marginTop: "14px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "18px",
              padding: "8px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={linkStyle(isActive(item.href), false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {isMobile && menuOpen ? (
          <nav
            id="mobile-navigation"
            style={{
              marginTop: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(15,23,42,0.98)",
              borderRadius: "18px",
              padding: "10px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "8px",
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={linkStyle(isActive(item.href), true)}
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
