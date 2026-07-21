"use client";

import { useEffect, useState } from "react";

const iconPaths = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  picks: <><path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h5M8 17h3"/></>,
  agent: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  portfolio: <><circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20.5 14.2A8.3 8.3 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>
};

export function AppIcon({ name, size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {iconPaths[name] || iconPaths.more}
    </svg>
  );
}

export function BrandMark({ compact = false }) {
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-[color:var(--sc-brand-border)] bg-[var(--sc-brand)] text-[var(--sc-brand-ink)] shadow-[var(--sc-brand-shadow)] ${compact ? "h-10 w-10 rounded-[0.9rem]" : "h-12 w-12 rounded-[1.05rem]"}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <path d="M8 28h8l4-11 7 19 4-10h9" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="39" cy="26" r="2.2" fill="currentColor" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-black/10" />
    </div>
  );
}

export function ThemeToggle({ labelDark = "Dark", labelLight = "Light" }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("scorecaster-theme");
    const preferred = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const next = stored === "light" || stored === "dark" ? stored : preferred;
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("scorecaster-theme", next);
  }

  const nextLabel = theme === "dark" ? labelLight : labelDark;
  return (
    <button type="button" onClick={toggle} className="sc-icon-button" aria-label={nextLabel} title={nextLabel}>
      <AppIcon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

export function TeamCrest({ name = "?", size = "md" }) {
  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sizeClass = size === "sm" ? "h-9 w-9 rounded-xl text-[11px]" : "h-11 w-11 rounded-[0.9rem] text-xs";
  return <span className={`grid shrink-0 place-items-center border border-[var(--sc-border)] bg-[var(--sc-surface-strong)] font-black tracking-[0.08em] text-[var(--sc-text)] shadow-sm ${sizeClass}`}>{initials || "?"}</span>;
}
