"use client";

import { analyzeParlayV2 } from "@/lib/parlay-engine-v2";

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `€${n.toFixed(2)}` : "€0.00";
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-";
}

export default function ParlayAnalysisPanel({ picks = [], bankroll = 1000 }) {
  const analysis = analyzeParlayV2(picks, bankroll);

  const color =
    analysis.status === "good"
      ? "#86efac"
      : analysis.status === "warning"
      ? "#fde68a"
      : "#fca5a5";

  return (
    <section
      style={{
        border: `1px solid ${color}`,
        borderRadius: 22,
        padding: 18,
        background: "rgba(2,6,23,0.72)",
        color: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Rekka Engine V2</h2>

      <div style={{ color, fontWeight: 900, lineHeight: 1.5 }}>
        {analysis.verdict}
      </div>

      {analysis.canAnalyze ? (
        <>
          <div style={{ marginTop: 12, lineHeight: 1.7 }}>
            Kohteita: <b>{analysis.count}</b>
            <br />
            Yhteiskerroin: <b>{analysis.combinedOdds.toFixed(2)}</b>
            <br />
            Mallin osumatodennäköisyys: <b>{pct(analysis.combinedProb)}</b>
            <br />
            Rekan EV: <b>{analysis.ev.toFixed(2)}</b>
            <br />
            Confidence: <b>{analysis.confidence}/100</b>
            <br />
            Suosituspanos: <b>{money(analysis.suggestedStake)}</b>
            <br />
            Mahdollinen palautus: <b>{money(analysis.potentialReturn)}</b>
          </div>

          {analysis.correlation.warnings.length ? (
            <div style={{ marginTop: 14 }}>
              <b>Korrelaatiovaroitukset</b>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {analysis.correlation.warnings.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid rgba(245,158,11,0.35)",
                      borderRadius: 12,
                      padding: 10,
                      color: "#fde68a",
                    }}
                  >
                    {w.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
