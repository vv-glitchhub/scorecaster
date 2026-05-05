"use client";

import { useState } from "react";
import { getDecision } from "@/lib/betting-engine";
import BetDecisionCard from "./BetDecisionCard";

export default function BettingWorkspaceClient({ matches = [] }) {
  const [selectedMatch, setSelectedMatch] = useState(null);

  return (
    <div style={{ padding: 16 }}>

      {/* 🔥 OTTELUT */}
      <h2>Ottelut</h2>

      {matches.map((m) => (
        <div
          key={m.id}
          onClick={() => setSelectedMatch(m)}
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          {m.home_team} vs {m.away_team}
        </div>
      ))}

      {/* 🎯 PÄÄTÖS */}
      {selectedMatch && (
        <BetDecisionCard
          match={selectedMatch}
          decision={getDecision(selectedMatch)}
        />
      )}
    </div>
  );
}
