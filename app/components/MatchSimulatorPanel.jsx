"use client";

import { useMemo, useState } from "react";
import { runMatchSimulation } from "@/lib/simulator-engine";

export default function MatchSimulatorPanel({
  matches = [],
  lang = "en",
}) {
  const [selectedMatchId, setSelectedMatchId] = useState(matches?.[0]?.id || null);
  const [iterations, setIterations] = useState(10000);

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const baseProbabilities = useMemo(() => {
    if (!selectedMatch) {
      return { home: 0.4, draw: 0.25, away: 0.35 };
    }

    const homeOdds = Number(selectedMatch.bestOdds?.home || 0);
    const drawOdds = Number(selectedMatch.bestOdds?.draw || 0);
    const awayOdds = Number(selectedMatch.bestOdds?.away || 0);

    if (!homeOdds || !awayOdds) {
      return { home: 0.45, draw: 0.22, away: 0.33 };
    }

    const rawHome = 1 / homeOdds;
    const rawDraw = drawOdds ? 1 / drawOdds : 0.22;
    const rawAway = 1 / awayOdds;
    const total = rawHome + rawDraw + rawAway || 1;

    return {
      home: rawHome / total,
      draw: rawDraw / total,
      away: rawAway / total,
    };
  }, [selectedMatch]);

  const simulation = useMemo(() => {
    if (!selectedMatch) return null;

    return runMatchSimulation({
      iterations: Number(iterations) || 10000,
      probabilities: baseProbabilities,
      homeTeam: selectedMatch.home_team,
      awayTeam: selectedMatch.away_team,
    });
  }, [selectedMatch, iterations, baseProbabilities]);

  const labels =
    lang === "fi"
      ? {
          title: "Ottelusimulaattori",
          desc: "Aja yksittäisen ottelun simulaatio valitulla iteraatiomäärällä.",
          match: "Ottelu",
          iterations: "Iteraatiot",
          home: "Kotivoitto",
          draw: "Tasapeli",
          away: "Vierasvoitto",
          noMatch: "Otteluita ei ole saatavilla simulaatioon.",
          marketBase: "Perustuu nykyisiin markkinakertoimiin normalisoituna.",
        }
      : {
          title: "Match Simulator",
          desc: "Run a single-match simulation with the selected number of iterations.",
          match: "Match",
          iterations: "Iterations",
          home: "Home Win",
          draw: "Draw",
          away: "Away Win",
          noMatch: "No matches available for simulation.",
          marketBase: "Based on current market odds normalized into probabilities.",
        };

  const selectStyle = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "14px",
  };

  const statCard = (label, value) => (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>{label}</p>
      <p style={{ margin: "8px 0 0", fontWeight: 800, fontSize: "22px" }}>{value}</p>
    </div>
  );

  if (!matches.length) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
          color: "#94a3b8",
        }}
      >
        {labels.noMatch}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
            {labels.match}
          </p>
          <select
            value={selectedMatchId || ""}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            style={selectStyle}
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id} style={{ color: "#000" }}>
                {match.home_team} vs {match.away_team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: "14px" }}>
            {labels.iterations}
          </p>
          <select
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            style={selectStyle}
          >
            {[1000, 5000, 10000, 25000].map((value) => (
              <option key={value} value={value} style={{ color: "#000" }}>
                {value.toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700 }}>
          {selectedMatch?.home_team} vs {selectedMatch?.away_team}
        </p>
        <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
          {labels.marketBase}
        </p>
      </div>

      {simulation ? (
        <div
          style={{
            display: "grid",
            gap: "16px",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {statCard(labels.home, `${simulation.homeWinPct}%`)}
          {statCard(labels.draw, `${simulation.drawPct}%`)}
          {statCard(labels.away, `${simulation.awayWinPct}%`)}
        </div>
      ) : null}
    </div>
  );
}
