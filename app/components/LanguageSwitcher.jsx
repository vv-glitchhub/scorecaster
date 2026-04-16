"use client";

import { useRouter, usePathname } from "next/navigation";

export default function LanguageSwitcher({ lang = "fi" }) {
  const router = useRouter();
  const pathname = usePathname();

  async function setLang(nextLang) {
    try {
      document.cookie = `scorecaster_lang=${nextLang}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
      router.push(pathname);
    } catch (error) {
      console.error("Language switch failed", error);
    }
  }

  const buttonStyle = (active) => ({
    border: active
      ? "1px solid rgba(16,185,129,0.7)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
    color: active ? "#6ee7b7" : "#fff",
    borderRadius: "999px",
    padding: "10px 14px",
    minWidth: "64px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button type="button" onClick={() => setLang("en")} style={buttonStyle(lang === "en")}>
        EN
      </button>
      <button type="button" onClick={() => setLang("fi")} style={buttonStyle(lang === "fi")}>
        FI
      </button>
    </div>
  );
}
