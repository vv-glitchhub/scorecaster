"use client";

import Link from "next/link";

export default function MobileBottomNav() {
  const items = [
    { href: "/", label: "Etusivu" },
    { href: "/betting", label: "Betting" },
    { href: "/simulator", label: "Sim" },
    { href: "/profile", label: "Profiili" },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: "fixed",
        left: 10,
        right: 10,
        bottom: "max(10px, env(safe-area-inset-bottom))",
        zIndex: 999,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 6,
        padding: 8,
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        borderRadius: 22,
        background: "rgba(2,6,23,0.94)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      }}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            textAlign: "center",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 900,
            fontSize: 12,
            padding: "10px 4px",
            borderRadius: 15,
            background: "rgba(255,255,255,0.06)",
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
