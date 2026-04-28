"use client";

export default function DataTrustPanel({ trust, lang = "fi" }) {
  if (!trust) return null;

  const color =
    trust.tier === "high"
      ? "#10b981"
      : trust.tier === "medium"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div
      style={{
        border: `1px solid ${color}55`,
        background: `${color}12`,
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: "18px",
          color: "#ffffff",
        }}
      >
        {lang === "fi" ? "Datan luotettavuus" : "Data Trust"}:{" "}
        {trust.score}/100
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#dbe4f0",
          fontSize: "14px",
        }}
      >
        {trust.tier === "high"
          ? lang === "fi"
            ? "Data näyttää vahvalta."
            : "Data quality looks strong."
          : trust.tier === "medium"
          ? lang === "fi"
            ? "Data on kohtuullinen, käytä harkintaa."
            : "Data quality is moderate, use caution."
          : lang === "fi"
          ? "Data on heikko, älä luota vahvoihin suosituksiin."
          : "Weak data, avoid strong recommendations."}
      </div>

      {Array.isArray(trust.issues) && trust.issues.length > 0 ? (
        <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
          {trust.issues.map((issue) => (
            <div key={issue} style={{ color: "#fecaca", fontSize: "13px" }}>
              ⚠ {issue}
            </div>
          ))}
        </div>
      ) : null}

      {Array.isArray(trust.positives) && trust.positives.length > 0 ? (
        <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
          {trust.positives.map((positive) => (
            <div key={positive} style={{ color: "#bbf7d0", fontSize: "13px" }}>
              ✓ {positive}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
