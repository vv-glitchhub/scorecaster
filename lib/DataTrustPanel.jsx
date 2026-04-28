"use client";

export default function DataTrustPanel({ trust, lang="fi" }) {
  if (!trust) return null;

  const title =
    lang === "fi" ? "Datan luotettavuus" : "Data Trust";

  const color =
    trust.tier === "high"
      ? "#10b981"
      : trust.tier === "medium"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div
      style={{
        border:`1px solid ${color}55`,
        background:`${color}12`,
        borderRadius:"16px",
        padding:"16px"
      }}
    >
      <div style={{
        fontWeight:900,
        fontSize:"18px",
        color:"#fff"
      }}>
        {title}: {trust.score}/100
      </div>

      <div style={{
        marginTop:"10px",
        color:"#dbe4f0",
        fontSize:"14px"
      }}>
        {trust.tier==="high" &&
          (lang==="fi"
            ? "Data näyttää vahvalta."
            : "Data quality looks strong.")}

        {trust.tier==="medium" &&
          (lang==="fi"
            ? "Data kohtuullinen, käytä harkintaa."
            : "Data quality moderate, use caution.")}

        {trust.tier==="low" &&
          (lang==="fi"
            ? "Data heikko, älä luota vahvoihin suosituksiin."
            : "Weak data, avoid strong recommendations.")}
      </div>

      {trust.issues?.length > 0 && (
        <div style={{marginTop:"14px"}}>
          {trust.issues.map((issue)=>(
            <div key={issue}
              style={{
                color:"#fecaca",
                fontSize:"13px",
                marginBottom:"6px"
              }}
            >
              ⚠ {issue}
            </div>
          ))}
        </div>
      )}

      {trust.positives?.length >0 && (
        <div style={{marginTop:"12px"}}>
          {trust.positives.map((p)=>(
            <div key={p}
              style={{
                color:"#bbf7d0",
                fontSize:"13px",
                marginBottom:"6px"
              }}
            >
              ✓ {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
