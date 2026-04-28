import { getDictionary } from "@/lib/i18n";

export default function SourceBadge({
  source,
  cached,
  status,
  lang = "en",
  children,
}) {
  const t = getDictionary(lang);

  if (children) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          borderRadius: "999px",
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: "0.04em",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "#ffffff",
        }}
      >
        {children}
      </span>
    );
  }

  const sourceLabel =
    source === "api"
      ? t.sourceApi
      : source === "fallback"
      ? t.sourceFallback
      : t.sourceUnknown;

  const sourceColor =
    source === "api" ? "#10b981" : source === "fallback" ? "#f59e0b" : "#64748b";

  const derivedStatus =
    status || (cached ? "cache" : "fresh");

  const cacheLabel =
    derivedStatus === "cache" ? t.statusCache : t.statusFresh;

  const cacheColor =
    derivedStatus === "cache" ? "#38bdf8" : "#a78bfa";

  const badgeStyle = (borderColor, bgColor) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.04em",
    border: `1px solid ${borderColor}`,
    background: bgColor,
    color: "#fff",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span style={badgeStyle(`${sourceColor}66`, `${sourceColor}22`)}>
        {t.sourceLabel}: {sourceLabel}
      </span>
      <span style={badgeStyle(`${cacheColor}66`, `${cacheColor}22`)}>
        {t.statusLabel}: {cacheLabel}
      </span>
    </div>
  );
}
