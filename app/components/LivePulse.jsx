import { getDictionary } from "@/lib/i18n";

export default function LivePulse({ isRefreshing, lastUpdatedAt, lang = "en" }) {
  const t = getDictionary(lang);

  const formatted = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString(lang === "fi" ? "fi-FI" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "-";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          borderRadius: "999px",
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: 700,
          border: "1px solid rgba(16,185,129,0.35)",
          background: "rgba(16,185,129,0.12)",
          color: "#ffffff",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            background: isRefreshing ? "#f59e0b" : "#10b981",
            boxShadow: isRefreshing
              ? "0 0 10px rgba(245,158,11,0.6)"
              : "0 0 10px rgba(16,185,129,0.6)",
          }}
        />
        {isRefreshing ? t.updating : t.live}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "999px",
          padding: "8px 12px",
          fontSize: "12px",
          fontWeight: 700,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)",
          color: "#cbd5e1",
        }}
      >
        {t.updatedAt} {formatted}
      </div>
    </div>
  );
}
