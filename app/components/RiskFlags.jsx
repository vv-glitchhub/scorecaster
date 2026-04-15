"use client";

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
  const title = lang === "fi" ? "Riskiliput" : "Risk Flags";

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>

      {flags.map((flag) => {
        const styles = getStyles(flag.level);

        return (
          <div
            key={`${flag.level}-${flag.label}`}
            style={{
              ...styles,
              borderRadius: "14px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>{flag.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#e2e8f0" }}>
              {flag.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
