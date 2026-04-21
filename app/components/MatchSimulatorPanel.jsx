"use client";

import { useMemo, useState } from "react";
import { runMatchSimulation } from "@/lib/simulator-engine";

export default function MatchSimulatorPanel({ matches = [], lang = "en" }) {
  const labels =
    lang === "fi"
      ? {
          title: "Ottelusimulaatio",
          desc: "Aja yksittäisen ottelun simulaatio markkinatodennäköisyyksien pohjalta.",
          match: "Ottelu",
          iterations: "Iteraatiot",
          home: "Kotivoitto",
          draw: "Tasapeli",
          away: "Vierasvoitto",
          noMatch: "Otteluita ei ole saatavilla simulaatioon.",
          marketBase: "Perustuu nykyisiin markkinakertoimiin normalisoituna.",
        }
      : {
          title: "Match Simulation",
          desc: "Run a single-match simulation based on market probabilities.",
          match: "Match",
          iterations: "Iterations",
          home: "Home Win",
          draw: "Draw",
          away: "Away Win",
          noMatch: "No matches available for simulation.",
          marketBase: "Based on current market odds normalized into probabilities.",
        };

  const safeMatches = Array.isArray(matches) ? matches : [];

  const [selectedMatchId, setSelectedMatchId] = useState(
    safeMatches[0]?.id || ""
  );
  const [iterations, setIterations] = useState(10000);

  const selectedMatch = useMemo(() => {
    if (!safeMatches.length) return null;
    return (
      safeMatches.find((match) => match?.id === selectedMatchId) ||
      safeMatches[0] ||
      null
    );
  }, [safeMatches, selectedMatchId]);

  const baseProbabilities = useMemo(() => {
    if (!selectedMatch) {
      return { home: 0.45, draw: 0.22, away: 0.33 };
    }

    const homeOdds = Number(selectedMatch?.bestOdds?.home || 0);
    const drawOdds = Number(selectedMatch?.bestOdds?.draw || 0);
    const awayOdds = Number(selectedMatch?.bestOdds?.away || 0);

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
      homeTeam: selectedMatch?.home_team || "Home",
      awayTeam: selectedMatch?.away_team || "Away",
    });
  }, [selectedMatch, iterations, baseProbabilities]);

  const panelStyle = {
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "20px",
    background: "rgba(255,255,255,0.03)",
  };

  const selectStyle = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "16px",
    boxSizing: "border-box",
  };

  const statCard = (label, value) => (
    <div
      key={label}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
        padding: "18px",
        background: "rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "#94a3b8",
          fontWeight: 700,
          marginBottom: "10px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(30px, 7vw, 52px)",
          lineHeight: 1,
          fontWeight: 900,
          color: "#ffffff",
        }}
      >
        {value}
      </div>
    </div>
  );

  if (!safeMatches.length) {
    return (
      <div style={panelStyle}>
        <div style={{ color: "#94a3b8", fontSize: "16px" }}>{labels.noMatch}</div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          fontSize: "clamp(28px, 6vw, 42px)",
          fontWeight: 900,
          color: "#ffffff",
          lineHeight: 1.05,
        }}
      >
        {labels.title}
      </div>

      <div
        style={{
          marginTop: "12px",
          color: "#94a3b8",
          fontSize: "clamp(15px, 3vw, 18px)",
          lineHeight: 1.6,
          maxWidth: "760px",
        }}
      >
        {labels.desc}
      </div>

      <div
        style={{
          marginTop: "22px",
          display: "grid",
          gap: "16px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#94a3b8",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {labels.match}
          </label>
          <select
            value={selectedMatchId}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            style={selectStyle}
          >
            {safeMatches.map((match) => (
              <option key={match.id} value={match.id}>
                {(match?.home_team || "Home") + " vs " + (match?.away_team || "Away")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#94a3b8",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {labels.iterations}
          </label>
          <select
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            style={selectStyle}
          >
            {[1000, 5000, 10000, 25000].map((value) => (
              <option key={value} value={value}>
                {value.toLocaleString(lang === "fi" ? "fi-FI" : "en-US")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedMatch ? (
        <div
          style={{
            marginTop: "22px",
            display: "grid",
            gap: "16px",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "18px",
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                fontSize: "clamp(24px, 5vw, 34px)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
              }}
            >
              {(selectedMatch?.home_team || "Home") +
                " vs " +
                (selectedMatch?.away_team || "Away")}
            </div>

            <div
              style={{
                marginTop: "10px",
                color: "#94a3b8",
                fontSize: "16px",
                lineHeight: 1.5,
              }}
            >
              {labels.marketBase}
            </div>
          </div>

          {simulation ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {statCard(labels.home, `${simulation.homeWinPct}%`)}
              {statCard(labels.draw, `${simulation.drawPct}%`)}
              {statCard(labels.away, `${simulation.awayWinPct}%`)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
