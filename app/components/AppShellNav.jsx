import Link from "next/link";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getDictionary } from "@/lib/i18n";

export default function AppShellNav({ lang = "en", pathname = "/" }) {
  const t = getDictionary(lang);

  const navStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(2,6,23,0.85)",
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "blur(12px)",
    flexWrap: "wrap",
  };

  const pillWrap = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  };

  const navPill = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    padding: "8px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  };

  const getLinkStyle = (href) => {
    const active = pathname === href;

    return {
      padding: "12px 18px",
      borderRadius: "14px",
      color: active ? "#081018" : "#cbd5e1",
      background: active ? "#22c55e" : "transparent",
      fontWeight: 700,
      textDecoration: "none",
      transition: "0.2s ease",
    };
  };

  return (
    <nav style={navStyle}>
      <div>
        <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff" }}>
          Scorecaster
        </div>
        <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
          {t.brandTagline}
        </div>
      </div>

      <div style={pillWrap}>
        <LanguageSwitcher lang={lang} />

        <div style={navPill}>
          <Link href="/" style={getLinkStyle("/")}>
            {t.navDashboard}
          </Link>
          <Link href="/betting" style={getLinkStyle("/betting")}>
            {t.navBetting}
          </Link>
          <Link href="/simulator" style={getLinkStyle("/simulator")}>
            {t.navSimulator}
          </Link>
        </div>
      </div>
    </nav>
  );
}
