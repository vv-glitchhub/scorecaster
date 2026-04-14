"use client";

import { useMemo, useState } from "react";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import LivePulse from "@/app/components/LivePulse";
import { getDictionary } from "@/lib/i18n";
import { useBetStore } from "@/lib/useBetStore";

export default function BettingWorkspaceClient({ oddsData, lang = "en" }) {
  const t = getDictionary(lang);
  const { addBet } = useBetStore();

  const [market, setMarket] = useState("h2h");
  const [selectedMatchId, setSelectedMatchId] = useState(
    oddsData?.matches?.[0]?.id || null
  );

  const matches = oddsData?.matches || [];

  const selectedMatch = useMemo(() => {
    return matches.find((match) => match.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  const marketRows = useMemo(() => {
    if (!selectedMatch) return [];

    if (market === "totals") {
      return [
        {
          key: "over",
          label: `Over ${selectedMatch.bestOdds?.point ?? "-"}`,
          odds: selectedMatch.bestOdds?.over ?? null,
        },
        {
          key: "under",
          label: `Under ${selectedMatch.bestOdds?.point ?? "-"}`,
          odds: selectedMatch.bestOdds?.under ?? null,
        },
      ].filter((row) => row.odds);
    }

    if (market === "spreads") {
      return [
        {
          key: "spread-home",
          label: `${selectedMatch.home_team} ${selectedMatch.bestOdds?.spreadPointHome ?? ""}`,
          odds: selectedMatch.bestOdds?.spreadHome ?? null,
        },
        {
          key: "spread-away",
          label: `${selectedMatch.away_team} ${selectedMatch.bestOdds?.spreadPointAway ?? ""}`,
          odds: selectedMatch.bestOdds?.spreadAway ?? null,
        },
      ].filter((row) => row.odds);
    }

    return [
      {
        key: "home",
        label: selectedMatch.home_team,
        odds: selectedMatch.bestOdds?.home ?? null,
      },
      {
        key: "draw",
        label: t.draw,
        odds: selectedMatch.bestOdds?.draw ?? null,
      },
      {
        key: "away",
        label: selectedMatch.away_team,
        odds: selectedMatch.bestOdds?.away ?? null,
      },
    ].filter((row) => row.odds);
  }, [selectedMatch, market, t.draw]);

  function handleAddBet(row) {
    if (!selectedMatch || !row?.odds) return;

    addBet({
      match: `${selectedMatch.home_team} vs ${selectedMatch.away_team}`,
      selection: `${currentMarketLabel} • ${row.label}`,
      odds: Number(row.odds),
      stake: 10,
    });
  }

  const currentMarketLabel =
    market === "h2h" ? t.h2h : market === "totals" ? t.totals : t.handicap;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageSection
        title={t.dataStatus}
        rightSlot={
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <SourceBadge
              source={oddsData?.source}
              cached={oddsData?.cached}
              lang={lang}
            />
            <LivePulse
              isRefreshing={false}
              lastUpdatedAt={Date.now()}
              lang={lang}
            />
          </div>
        }
      />

      <PageSection
        title={t.marketSelection}
        description={
          lang === "fi"
            ? "Valitse markkina analyysiä varten"
            : "Select market for analysis"
        }
      >
        <MarketTabs
          market={market}
          onChange={setMarket}
          lang={lang}
        />
      </PageSection>

      <PageSection
        title={t.matches}
        description={
          lang === "fi"
            ? "Kaikki saatavilla olevat ottelut"
            : "All available matches"
        }
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {matches.length === 0 ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "16px",
                background: "rgba(0,0,0,0.2)",
                color: "#94a3b8",
              }}
            >
              {lang === "fi"
                ? "Ei otteluita saatavilla"
                : "No matches available"}
            </div>
          ) : (
            matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedMatchId(match.id)}
                style={{
                  border:
                    selectedMatch?.id === match.id
                      ? "1px solid rgba(16,185,129,0.7)"
                      : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  padding: "16px",
                  background:
                    selectedMatch?.id === match.id
                      ? "rgba(16,185,129,0.10)"
                      : "rgba(0,0,0,0.2)",
                  color: "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      {match.home_team} vs {match.away_team}
                    </p>

                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "13px",
                        color: "#94a3b8",
                      }}
                    >
                      {match.sport_title}
                    </p>
                  </div>

                  <div style={{ fontSize: "14px" }}>
                    <div>
                      {t.home}: {match.bestOdds?.home ?? "-"}
                    </div>
                    <div>
                      {t.draw}: {match.bestOdds?.draw ?? "-"}
                    </div>
                    <div>
                      {t.away}: {match.bestOdds?.away ?? "-"}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PageSection>

      <PageSection
        title={lang === "fi" ? "Ottelun markkinat" : "Match Markets"}
        description={
          lang === "fi"
            ? "Valitun ottelun markkinat ja vedon tallennus."
            : "Selected match markets and quick bet saving."
        }
      >
        {!selectedMatch ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "16px",
              background: "rgba(0,0,0,0.2)",
              color: "#94a3b8",
            }}
          >
            {lang === "fi"
              ? "Valitse ensin ottelu"
              : "Select a match first"}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "16px",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, fontSize: "18px" }}>
                {selectedMatch.home_team} vs {selectedMatch.away_team}
              </p>
              <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                {t.market}: {currentMarketLabel}
              </p>
            </div>

            {marketRows.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "rgba(0,0,0,0.2)",
                  color: "#94a3b8",
                }}
              >
                {lang === "fi"
                  ? "Tälle markkinalle ei löytynyt rivejä."
                  : "No rows found for this market."}
              </div>
            ) : (
              marketRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    padding: "16px",
                    background: "rgba(0,0,0,0.2)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{row.label}</p>
                    <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
                      Odds {row.odds}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddBet(row)}
                    style={{
                      border: "1px solid rgba(16,185,129,0.6)",
                      background: "rgba(16,185,129,0.14)",
                      color: "#6ee7b7",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {lang === "fi" ? "Lisää veto" : "Add Bet"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </PageSection>
    </div>
  );
}
