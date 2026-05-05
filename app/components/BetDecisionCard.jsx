"use client";

export default function BetDecisionCard({ match, decision }) {
  if (!match || !decision) return null;

  const color = decision.shouldBet ? "#052e16" : "#3f1d1d";

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 18,
        background: color,
        border: "1px solid rgba(255,255,255,0.1)",
        marginBottom: 16,
      }}
    >
      {/* 🔥 PÄÄTÖS */}
      <h2 style={{ margin: 0 }}>
        {decision.shouldBet ? "🔥 LYÖ VETO" : "❌ ÄLÄ LYÖ"}
      </h2>

      <div style={{ marginTop: 8 }}>
        Kohde: <b>{decision.team}</b>
      </div>

      <div>Panos: €{decision.stake.toFixed(2)}</div>

      <div>
        Edge: {(decision.edge * 100).toFixed(1)}%
      </div>

      <div>
        Luottamus: {decision.confidence.toFixed(1)}
      </div>

      {/* 📊 DATA */}
      <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>
        <div>
          Market: {(decision.market * 100).toFixed(1)}%
        </div>
        <div>
          Model: {(decision.model * 100).toFixed(1)}%
        </div>
        <div>
          EV: {decision.ev.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
