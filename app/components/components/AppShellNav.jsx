"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/betting", label: "Betting" },
  { href: "/simulator", label: "Simulator" },
];

export default function AppShellNav() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(11,18,32,0.9)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <Link href="/" style={{ fontSize: "24px", fontWeight: 700 }}>
            Scorecaster
          </Link>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8" }}>
            Betting analytics & simulation workspace
          </p>
        </div>

        <nav
          style={{
            display: "flex",
            gap: "8px",
            padding: "6px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: active ? "#10b981" : "transparent",
                  color: active ? "#000" : "#cbd5e1",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
