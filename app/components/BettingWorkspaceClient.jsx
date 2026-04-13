"use client";

import { useState, useMemo } from "react";
import PageSection from "@/app/components/PageSection";
import SourceBadge from "@/app/components/SourceBadge";
import MarketTabs from "@/app/components/MarketTabs";
import LivePulse from "@/app/components/LivePulse";
import { getDictionary } from "@/lib/i18n";

export default function BettingWorkspaceClient({ oddsData, lang = "en" }) {
  const t = getDictionary(lang);

  const [market, setMarket] = useState("h2h");

  const matches = oddsData?.matches || [];

  const filteredMatches = useMemo(() => {
    // tulevaisuudessa filteröinti marketin mukaan
    return matches;
  }, [matches, market]);

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      
      {/* STATUS BAR */}
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

      {/* MARKET TABS */}
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

      {/* MATCH LIST */}
      <PageSection
        title={t.matches}
        description={
          lang === "fi"
            ? "Kaikki saatavilla olevat ottelut"
            : "All available matches"
        }
      >
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredMatches.length === 0 ? (
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
            filteredMatches.map((match) => (
              <div
                key={match.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  padding: "16px",
                  background: "rgba(0,0,0,0.2)",
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
              </div>
            ))
          )}
        </div>
      </PageSection>
    </div>
  );
}
