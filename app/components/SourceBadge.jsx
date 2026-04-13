import { getDictionary } from "@/lib/i18n";

export default function SourceBadge({ source, cached, lang = "en" }) {
  const t = getDictionary(lang);

  const sourceLabel =
    source === "api"
      ? t.sourceApi
      : source === "fallback"
      ? t.sourceFallback
      : t.sourceUnknown;

  const sourceColor =
    source === "api"
      ? "#10b981"
      : source === "fallback"
      ? "#f59e0b"
      : "#64748b";

  const cacheLabel = cached ? t.statusCache : t.statusFresh;
  const cacheColor = cached ? "#38bdf8" : "#a78bfa";

  const badgeStyle = (bg) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    border: `1px solid ${bg}55`,
    background: `${bg}22`,
    color: "#fff",
  });

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <span style={badgeStyle(sourceColor)}>
        {t.sourceLabel}: {sourceLabel}
      </span>
      <span style={badgeStyle(cacheColor)}>
        {t.statusLabel}: {cacheLabel}
      </span>
    </div>
  );
}
