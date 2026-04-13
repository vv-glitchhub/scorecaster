"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LanguageSwitcher({ lang = "en" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function changeLanguage(nextLang) {
    if (nextLang === lang || loading) return;

    try {
      setLoading(true);

      await fetch("/api/language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lang: nextLang }),
      });

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const buttonStyle = (active) => ({
    border: active
      ? "1px solid rgba(16,185,129,0.7)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active
      ? "rgba(16,185,129,0.14)"
      : "rgba(255,255,255,0.06)",
    color: active ? "#6ee7b7" : "#fff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.7 : 1,
  });

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => changeLanguage("en")}
        style={buttonStyle(lang === "en")}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => changeLanguage("fi")}
        style={buttonStyle(lang === "fi")}
      >
        FI
      </button>
    </div>
  );
}
