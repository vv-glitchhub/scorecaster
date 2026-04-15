"use client";

export default function ConfidenceBreakdown({ breakdown, lang = "en" }) {
  if (!breakdown) return null;

  const title = lang === "fi" ? "Confidence breakdown" : "Confidence Breakdown";

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>{title}</p>
        <p style={{ margin: "8px 0 0", fontSize: "24px", fontWeight: 800 }}>
          {breakdown.confidence}%
        </p>
      </div>

      {breakdown.items.map((item) => (
        <div
          key={item.label}
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>{item.label}</p>
            <span
              style={{
                color: item.value >= 0 ? "#10b981" : "#ef4444",
                fontWeight: 700,
              }}
            >
              {item.value > 0 ? "+" : ""}
              {item.value}
            </span>
          </div>
          <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
            {item.reason}
          </p>
        </div>
      ))}
    </div>
  );
}
