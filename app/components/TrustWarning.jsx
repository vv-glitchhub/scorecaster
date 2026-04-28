"use client";

export default function TrustWarning({
 trust,
 lang="fi"
}) {
 if (!trust) return null;

 if (trust.allowStrongRecommendations) return null;

 return (
   <div
    style={{
      border:"1px solid rgba(239,68,68,.35)",
      background:"rgba(239,68,68,.08)",
      borderRadius:"14px",
      padding:"14px"
    }}
   >
    <div
      style={{
        fontWeight:800,
        color:"#fecaca"
      }}
    >
      {lang==="fi"
        ? "Rajoitettu luottamus"
        : "Limited trust"}
    </div>

    <div
      style={{
        marginTop:"8px",
        color:"#fecaca",
        fontSize:"14px",
        lineHeight:1.5
      }}
    >
      {lang==="fi"
        ? "Älä käsittele näitä vahvoina suosituksina ennen paremman datan vahvistusta."
        : "Do not treat these as strong recommendations before stronger data confirmation."}
    </div>
   </div>
 )
}
