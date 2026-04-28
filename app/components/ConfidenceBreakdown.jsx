"use client";

import { getDictionary } from "@/lib/i18n";

export default function ConfidenceBreakdown({ breakdown, lang = "en" }) {
  const t = getDictionary(lang);

  if (!breakdown) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        padding: "16px",
        background: "rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: "18px",
          marginBottom: "12px",
          color: "#ffffff",
        }}
      >
        {t.confidenceBreakdown}
      </div>

      <div
        style={{
          fontSize: "42px",
          lineHeight: 1,
          fontWeight: 900,
          color: "#ffffff",
          marginBottom: "14px",
        }}
      >
        {breakdown.confidence}%
      </div>

      <div
        style={{
          display: "grid",
          gap: "10px",
        }}
      >
        {Array.isArray(breakdown.items) &&
          breakdown.items.map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 700, color: "#ffffff", fontSize: "14px" }}>
                  {item.label}
                </div>

                <div
                  style={{
                    color: item.value >= 0 ? "#10b981" : "#ef4444",
                    fontWeight: 800,
                    fontSize: "14px",
                  }}
                >
                  {item.value > 0 ? "+" : ""}
                  {item.value}
                </div>
              </div>

              <div
                style={{
                  marginTop: "6px",
                  color: "#94a3b8",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {item.reason}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
