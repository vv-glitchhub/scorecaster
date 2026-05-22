"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/app/components/DashboardCard";
import DashboardGrid from "@/app/components/DashboardGrid";
import { getBestSinglePick } from "@/lib/bookmaker-odds";

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
    return matches
      .map((match) => ({
        match,
        pick: getBestSinglePick(match),
      }))
      .filter((item) => item.pick?.odds)
      .sort((a, b) => b.pick.odds - a.pick.odds)
      .slice(0, 3);
  }, [matches]);

  return (
    <DashboardGrid>
      <DashboardCard
        title="Päivän top 3"
        description="Kolme kovinta kerrointa juuri nyt live-datasta."
      >
        {topThree.length === 0 ? (
          <p style={muted()}>Kohteita ei ole saatavilla.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {topThree.map(({ match, pick }, index) => (
              <div key={match.id} style={pickCard()}>
                <div style={rank()}>#{index + 1}</div>

                <div style={matchTitle()}>
                  {match.home_team} vs {match.away_team}
                </div>

                <div style={muted()}>
                  {match.sport_title || match.sport_key}
                </div>

                <div style={odds()}>{pick.odds}</div>

                <div style={book()}>
                  {pick.label} · {pick.bookmaker}
                </div>
              </div>
            ))}
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
        title="Simulaattori"
        description="Aja ottelu-, turnaus- ja playoff-simulaatioita erillisellä sivulla."
      >
        <a href="/simulator" style={button()}>
          Avaa simulaattori
        </a>
      </DashboardCard>

      <DashboardCard
        title="Otteluesikatselu"
        description="Kevyt etusivun esikatselu tulevista otteluista."
      >
        {matches[0] ? (
          <div style={pickCard()}>
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

function pickCard() {
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
    fontSize: 19,
    fontWeight: 950,
    lineHeight: 1.25,
  };
}

function muted() {
  return {
    color: "#94a3b8",
    fontWeight: 800,
    lineHeight: 1.5,
  };
}

function odds() {
  return {
    marginTop: 12,
    fontSize: 46,
    fontWeight: 950,
  };
}

function book() {
  return {
    color: "#86efac",
    fontWeight: 950,
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

function button() {
  return {
    display: "inline-flex",
    justifyContent: "center",
    textDecoration: "none",
    color: "white",
    border: "1px solid rgba(34,197,94,0.7)",
    background: "rgba(34,197,94,0.18)",
    borderRadius: 20,
    padding: "16px 18px",
    fontWeight: 950,
  };
}
