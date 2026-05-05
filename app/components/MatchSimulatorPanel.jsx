"use client";

import { useMemo, useState } from "react";
import {
  probabilitiesFromOdds,
  runMatchSimulation,
  simulateKnockoutTournament,
} from "@/lib/simulator-engine";

function cardStyle(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    maxWidth: "100%",
    overflow: "hidden",
    ...extra,
  };
}

function buttonStyle(active = false, disabled = false) {
  return {
    width: "100%",
    border: active
      ? "1px solid rgba(34,197,94,0.65)"
      : "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
    color: active ? "#bbf7d0" : "#ffffff",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function inputStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "#ffffff",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: 800,
  };
}

function safeText() {
  return {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
}

function barStyle(value) {
  return {
    height: 12,
    width: `${Math.max(0, Math.min(100, value))}%`,
    borderRadius: 999,
    background: "rgba(34,197,94,0.9)",
  };
}

function formatPct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function hasOdds(match) {
  return Boolean(match?.bestOdds?.home || match?.bestOdds?.away || match?.bestOdds?.draw);
}

export default function MatchSimulatorPanel({ matches = [], lang = "fi" }) {
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || "");
  const [iterations, setIterations] = useState(10000);
  const [manualHome, setManualHome] = useState("");
  const [manualDraw, setManualDraw] = useState("");
  const [manualAway, setManualAway] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [tournamentResult, setTournamentResult] = useState(null);

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const baseProbabilities = useMemo(() => {
    if (!selectedMatch) return { home: 0.45, draw: 0.23, away: 0.32 };

    const fromOdds = probabilitiesFromOdds(selectedMatch.bestOdds || {});

    return {
      home: manualHome ? Number(manualHome) / 100 : fromOdds.home,
      draw: manualDraw ? Number(manualDraw) / 100 : fromOdds.draw,
      away: manualAway ? Number(manualAway) / 100 : fromOdds.away,
    };
  }, [selectedMatch, manualHome, manualDraw, manualAway]);

  function runSingle() {
    if (!selectedMatch) return;

    const result = runMatchSimulation(
      {
        ...selectedMatch,
        probabilities: baseProbabilities,
      },
      iterations
    );

    setSingleResult(result);
  }

  function runTournament() {
    const usable = matches.filter((match) => match.home_team && match.away_team).slice(0, 16);

    const result = simulateKnockoutTournament({
      matches: usable,
      iterations,
    });

    setTournamentResult(result);
  }

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: "100%", overflow: "hidden" }}>
      <section
        style={cardStyle({
          background:
            "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(2,6,23,0.82))",
          borderColor: "rgba(34,197,94,0.30)",
        })}
      >
        <div style={{ color: "#86efac", fontWeight: 900, letterSpacing: 4, fontSize: 13 }}>
          SCORECASTER SIMULATOR
        </div>

        <h1
          style={{
            margin: "10px 0 8px",
            fontSize: "clamp(34px, 9vw, 58px)",
            lineHeight: 1.02,
            ...safeText(),
          }}
        >
          Simulaattori
        </h1>

        <p style={{ color: "#cbd5e1", fontWeight: 700, fontSize: 17, lineHeight: 1.45 }}>
          Testaa ottelun todennäköisyyksiä ja rakenna pohja tuleville turnaus- ja playoff-simulaatioille.
        </p>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Valitse ottelu</h2>

        {matches.length === 0 ? (
          <div style={{ color: "#fde68a", fontWeight: 800, lineHeight: 1.5 }}>
            Ei otteluita ladattuna. Simulaattori käyttää paremmin dataa, kun betting-sivulta/API:sta
            tuodaan ottelut mukaan. Nyt voit käyttää manuaalisia prosentteja myöhemmin.
          </div>
        ) : (
          <select
            value={selectedMatchId || selectedMatch?.id || ""}
            onChange={(e) => setSelectedMatchId(e.target.value)}
            style={inputStyle()}
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.home_team} vs {match.away_team}
              </option>
            ))}
          </select>
        )}

        {selectedMatch ? (
          <div style={{ marginTop: 14, color: "#94a3b8", lineHeight: 1.5 }}>
            <b style={{ color: "#fff" }}>
              {selectedMatch.home_team} vs {selectedMatch.away_team}
            </b>
            <br />
            {selectedMatch.sport_title || selectedMatch.sport_key || "League"}
            <br />
            Odds: koti {selectedMatch.bestOdds?.home ?? "-"} / tasapeli{" "}
            {selectedMatch.bestOdds?.draw ?? "-"} / vieras {selectedMatch.bestOdds?.away ?? "-"}
          </div>
        ) : null}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Asetukset</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              Iteraatiot
            </label>
            <select
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              style={inputStyle()}
            >
              <option value={1000}>1 000</option>
              <option value={10000}>10 000</option>
              <option value={50000}>50 000</option>
              <option value={100000}>100 000</option>
            </select>
          </div>

          <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
            Jos jätät manuaaliset kentät tyhjäksi, simulaattori arvioi todennäköisyydet kertoimista.
          </div>

          <div>
            <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              Koti % manuaalisesti
            </label>
            <input
              value={manualHome}
              onChange={(e) => setManualHome(e.target.value)}
              placeholder="esim. 45"
              style={inputStyle()}
            />
          </div>

          <div>
            <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              Tasapeli % manuaalisesti
            </label>
            <input
              value={manualDraw}
              onChange={(e) => setManualDraw(e.target.value)}
              placeholder="esim. 23"
              style={inputStyle()}
            />
          </div>

          <div>
            <label style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900 }}>
              Vieras % manuaalisesti
            </label>
            <input
              value={manualAway}
              onChange={(e) => setManualAway(e.target.value)}
              placeholder="esim. 32"
              style={inputStyle()}
            />
          </div>
        </div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Yksittäinen ottelu</h2>

        <button
          type="button"
          onClick={runSingle}
          disabled={!selectedMatch}
          style={buttonStyle(true, !selectedMatch)}
        >
          Aja ottelusimulaatio
        </button>

        {singleResult ? (
          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <ResultRow label={singleResult.homeTeam} value={singleResult.homePct} />
            <ResultRow label="Tasapeli" value={singleResult.drawPct} />
            <ResultRow label={singleResult.awayTeam} value={singleResult.awayPct} />

            <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
              Simulaatioita: {singleResult.iterations.toLocaleString("fi-FI")}
            </div>
          </div>
        ) : null}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Turnaus / playoff</h2>

        <p style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Tämä alpha-versio käyttää ladattuja otteluita knockout-runkona. Jatkossa tähän voidaan lisätä
          lohkovaihe, playoff-kaavio, sijoitukset ja tulevat turnaukset.
        </p>

        <button
          type="button"
          onClick={runTournament}
          disabled={matches.length < 2}
          style={buttonStyle(true, matches.length < 2)}
        >
          Aja turnaussimulaatio
        </button>

        {tournamentResult?.message ? (
          <div style={{ marginTop: 14, color: "#fde68a", fontWeight: 800 }}>
            {tournamentResult.message}
          </div>
        ) : null}

        {tournamentResult?.teams?.length > 0 ? (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {tournamentResult.teams.slice(0, 10).map((team) => (
              <ResultRow key={team.team} label={team.team} value={team.titlePct} />
            ))}

            <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
              Simulaatioita: {tournamentResult.iterations.toLocaleString("fi-FI")}
            </div>
          </div>
        ) : null}
      </section>

      <section style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Miten tätä kannattaa käyttää?</h2>

        <div style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
          <p>
            1. Hae betting-sivulla ottelut ja katso päivän pickit.
          </p>
          <p>
            2. Simuloi kiinnostava ottelu ja vertaa simulaation prosentteja kertoimien implied probabilityyn.
          </p>
          <p>
            3. Jos simulaatio antaa selvästi korkeamman todennäköisyyden kuin markkina, kohde voi olla jatkotarkastelun arvoinen.
          </p>
          <p style={{ color: "#fde68a", fontWeight: 800 }}>
            Alpha-huomio: tämä ei ole sijoitusneuvo. Malli tarvitsee vielä lisää dataa ennen oikeaa panostuskäyttöä.
          </p>
        </div>
      </section>
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
          fontWeight: 900,
        }}
      >
        <span style={safeText()}>{label}</span>
        <span>{formatPct(value)}</span>
      </div>

      <div
        style={{
          width: "100%",
          height: 12,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div style={barStyle(value)} />
      </div>
    </div>
  );
}
