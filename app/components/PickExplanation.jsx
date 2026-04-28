"use client";

export default function PickExplanation({
  row,
  trust,
  lang="fi"
}) {
  if (!row) return null;

  const implied = 1 / Number(row.odds);
  const edge = row.probability - implied;

  return (
    <div
      style={{
        border:"1px solid rgba(255,255,255,.08)",
        background:"rgba(255,255,255,.03)",
        borderRadius:"14px",
        padding:"14px",
        marginTop:"12px"
      }}
    >
      <div
        style={{
          fontWeight:800,
          color:"#fff",
          marginBottom:"10px"
        }}
      >
        {lang==="fi"
          ? "Miksi kohde nostetaan"
          : "Why this pick appears"}
      </div>

      <div style={{color:"#dbe4f0",fontSize:"14px"}}>
        • Odds: {row.odds}
      </div>

      <div style={{color:"#dbe4f0",fontSize:"14px"}}>
        • Implied probability: {(implied*100).toFixed(1)}%
      </div>

      <div style={{color:"#dbe4f0",fontSize:"14px"}}>
        • Model probability: {(row.probability*100).toFixed(1)}%
      </div>

      <div style={{
        color: edge>0 ? "#86efac":"#fca5a5",
        fontSize:"14px"
      }}>
        • Edge: {(edge*100).toFixed(1)}%
      </div>

      <div
        style={{
          marginTop:"10px",
          color:"#94a3b8",
          fontSize:"13px"
        }}
      >
        {trust?.allowStrongRecommendations
          ? (lang==="fi"
             ? "Data sallii vahvemman signaalin."
             : "Data supports a stronger signal.")
          : (lang==="fi"
             ? "Kohde näytetään, mutta signaali heikko."
             : "Pick shown, but signal is weak.")}
      </div>

    </div>
  );
}
