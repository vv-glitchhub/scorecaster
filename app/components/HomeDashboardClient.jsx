"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/app/components/DashboardCard";
import DashboardGrid from "@/app/components/DashboardGrid";
import {
  getParlaySummary,
  getTopValuePicks,
  percent,
} from "@/lib/bookmaker-odds";

export default function HomeDashboardClient() {
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState("Ladataan...");

  async function loadData() {
    try {
      const res = await fetch("/api/odds?sport=all&league=ALL", {
        cache: "no-store",
      });

      const data = await res.json();

      const next = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setMatches(next);

      setStatus(
        data?.source === "live"
          ? `Live-data · ${next.length} ottelua`
          : data?.reason || "Ei live-dataa"
      );
    } catch {
      setMatches([]);
      setStatus("Datan haku epäonnistui");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const topThree = useMemo(() => {
    return getTopValuePicks(matches, 3);
  }, [matches]);

  const rekka = useMemo(() => {
    return topThree.filter((pick) => pick.edge > 0).slice(0, 3);
  }, [topThree]);

  const rekkaSummary = useMemo(() => {
    return getParlaySummary(rekka);
  }, [rekka]);

  return (
    <DashboardGrid>
      <DashboardCard
        title="Päivän top 3 value"
        description="Ei vain suurimmat kertoimet, vaan kohteet joissa mallin arvio ylittää markkinan."
      >
        {topThree.length === 0 ? (
          <p style={muted()}>Kohteita ei ole saatavilla.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {topThree.map((pick, index) => (
              <ValuePickCard key={pick.id} pick={pick} index={index} />
            ))}
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title="AI Rekka"
        description="Automaattinen rekkaehdotus päivän parhaista value-kohteista."
      >
        {rekka.length < 2 ? (
          <p style={muted()}>
            Rekkaa ei muodostettu. Tarvitaan vähintään 2 järkevää value-kohdetta.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {rekka.map((pick, index) => (
              <div key={pick.id} style={miniPick()}>
                <div style={rank()}>Kohde {index + 1}</div>
                <div style={matchTitle()}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>
                <div style={book()}>
                  {pick.selection} · {pick.odds} · {pick.bookmaker}
                </div>
              </div>
            ))}

            <div style={summaryBox()}>
              <div style={muted()}>Rekan kokonaiskerroin</div>
              <div style={totalOdds()}>
                {rekkaSummary.totalOdds.toFixed(2)}
              </div>
              <div style={book()}>
                Keskimääräinen edge {percent(rekkaSummary.avgEdge)} · luottamus{" "}
                {rekkaSummary.avgConfidence.toFixed(0)}/100
              </div>
            </div>

            <p style={muted()}>
              Rekka on korkeamman riskin ehdotus. Se ei ole panostussuositus,
              vaan lista jatkoanalyysiin.
            </p>
          </div>
        )}
      </DashboardCard>

      <DashboardCard
        title="Datan tila"
        description="Nopea näkymä datalähteeseen, tuoreuteen ja ottelumäärään."
      >
        <div style={pill()}>{status}</div>
      </DashboardCard>

      <DashboardCard
        title="Otteluesikatselu"
        description="Kevyt etusivun esikatselu tulevista otteluista."
      >
        {matches[0] ? (
          <div style={miniPick()}>
            <div style={matchTitle()}>
              {matches[0].home_team} vs {matches[0].away_team}
            </div>
            <div style={muted()}>{matches[0].sport_title}</div>
          </div>
        ) : (
          <p style={muted()}>Otteluesikatselua ei ole saatavilla.</p>
        )}
      </DashboardCard>
    </DashboardGrid>
  );
}

function ValuePickCard({ pick, index }) {
  return (
    <div style={pickCard()}>
      <div style={rank()}>#{index + 1} VALUE PICK</div>

      <div style={matchTitle()}>
        {pick.match.home_team} vs {pick.match.away_team}
      </div>

      <div style={muted()}>
        {pick.match.sport_title || pick.match.sport_key}
      </div>

      <div style={selection()}>
        Suositus: {pick.selection}
      </div>

      <div style={odds()}>
        {pick.odds}
      </div>

      <div style={book()}>
        Paras bookkeri: {pick.bookmaker}
      </div>

      <div style={statsGrid()}>
        <Stat label="Markkina" value={percent(pick.impliedProbability)} />
        <Stat label="Malli" value={percent(pick.modelProbability)} green />
        <Stat label="Edge" value={percent(pick.edge)} green />
      </div>

      <div style={reasonBox()}>
        <strong>Miksi tämä nousi?</strong>
        <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
          {pick.reason.map((line, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, green }) {
  return (
    <div style={statBox()}>
      <div style={statLabel()}>{label}</div>
      <div style={{ ...statValue(), color: green ? "#86efac" : "#fff" }}>
        {value}
      </div>
    </div>
  );
}

function pickCard() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: 20,
    background: "rgba(255,255,255,0.05)",
  };
}

function miniPick() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(255,255,255,0.05)",
  };
}

function rank() {
  return {
    color: "#86efac",
    fontWeight: 950,
    marginBottom: 8,
  };
}

function matchTitle() {
  return {
    fontSize: 20,
    fontWeight: 950,
    lineHeight: 1.25,
  };
}

function muted() {
  return {
    color: "#94a3b8",
    fontWeight: 800,
    lineHeight: 1.55,
  };
}

function selection() {
  return {
    marginTop: 12,
    color: "#fff",
    fontWeight: 950,
    fontSize: 18,
  };
}

function odds() {
  return {
    marginTop: 8,
    fontSize: 52,
    lineHeight: 1,
    fontWeight: 950,
  };
}

function book() {
  return {
    color: "#86efac",
    fontWeight: 950,
    lineHeight: 1.45,
  };
}

function statsGrid() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 16,
  };
}

function statBox() {
  return {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 10,
    background: "rgba(2,6,23,0.40)",
  };
}

function statLabel() {
  return {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
  };
}

function statValue() {
  return {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 950,
  };
}

function reasonBox() {
  return {
    marginTop: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    background: "rgba(2,6,23,0.35)",
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontWeight: 750,
  };
}

function summaryBox() {
  return {
    border: "1px solid rgba(34,197,94,0.35)",
    borderRadius: 24,
    padding: 18,
    background: "rgba(34,197,94,0.10)",
  };
}

function totalOdds() {
  return {
    fontSize: 56,
    lineHeight: 1,
    fontWeight: 950,
    marginTop: 6,
  };
}

function pill() {
  return {
    border: "1px solid rgba(34,197,94,0.4)",
    background: "rgba(34,197,94,0.12)",
    color: "#86efac",
    borderRadius: 999,
    padding: "14px 18px",
    fontWeight: 950,
    display: "inline-flex",
  };
}
