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
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 50,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        padding: 10,
        borderRadius: 24,
        background: "rgba(2,6,23,0.92)",
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
            fontSize: 13,
            padding: "10px 6px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
