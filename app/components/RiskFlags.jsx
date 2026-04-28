"use client";

import { getDictionary } from "@/lib/i18n";

function getStyles(level) {
  if (level === "high") {
    return {
      border: "1px solid rgba(239,68,68,0.35)",
      background: "rgba(239,68,68,0.08)",
      color: "#fecaca",
    };
  }

  if (level === "medium") {
    return {
      border: "1px solid rgba(245,158,11,0.35)",
      background: "rgba(245,158,11,0.08)",
      color: "#fde68a",
    };
  }

  return {
    border: "1px solid rgba(34,197,94,0.35)",
    background: "rgba(34,197,94,0.08)",
    color: "#bbf7d0",
  };
}

export default function RiskFlags({ flags = [], lang = "en" }) {
  const t = getDictionary(lang);

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
        {t.riskFlags}
      </div>

      {flags.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: "14px" }}>{t.noRiskFlags}</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "10px",
          }}
        >
          {flags.map((flag) => {
            const styles = getStyles(flag.level);

            return (
              <div
                key={`${flag.level}-${flag.label}`}
                style={{
                  ...styles,
                  borderRadius: "12px",
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "14px",
                    marginBottom: "6px",
                  }}
                >
                  {flag.label}
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.5,
                    opacity: 0.95,
                  }}
                >
                  {flag.description}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
