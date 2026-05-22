"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Chip, Hero, PageShell, PrimaryButton, Row, SectionTitle } from "@/app/components/Ui";
import { getBestMarketOdds, getMajorBookmakerOdds } from "@/lib/bookmaker-odds";

const SPORTS = [
  { id: "all", label: "Kaikki" },
  { id: "icehockey", label: "Jääkiekko" },
  { id: "soccer", label: "Jalkapallo" },
  { id: "basketball", label: "Koripallo" },
  { id: "football", label: "NFL / Jenkkifutis" },
  { id: "baseball", label: "Baseball" },
  { id: "tennis", label: "Tennis" },
  { id: "mma", label: "UFC / MMA" },
  { id: "golf", label: "Golf" },
];

const LEAGUES = [
  { id: "ALL", label: "Kaikki" },
  { id: "NHL", label: "NHL" },
  { id: "LIIGA", label: "Liiga 🇫🇮" },
  { id: "SHL", label: "SHL 🇸🇪" },
  { id: "EPL", label: "Premier League" },
  { id: "LALIGA", label: "La Liga" },
  { id: "SERIEA", label: "Serie A" },
  { id: "BUNDESLIGA", label: "Bundesliga" },
  { id: "NBA", label: "NBA" },
  { id: "NFL", label: "NFL" },
  { id: "MLB", label: "MLB" },
  { id: "ATP", label: "ATP" },
  { id: "UFC", label: "UFC" },
];

function sportCategory(key = "") {
  const s = key.toLowerCase();
  if (s.includes("icehockey")) return "icehockey";
  if (s.includes("soccer")) return "soccer";
  if (s.includes("basketball")) return "basketball";
  if (s.includes("americanfootball")) return "football";
  if (s.includes("baseball")) return "baseball";
  if (s.includes("tennis")) return "tennis";
  if (s.includes("mma")) return "mma";
  if (s.includes("golf")) return "golf";
  return "other";
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("fi-FI", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function BettingPage() {
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("ALL");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourceText, setSourceText] = useState("");

  async function loadOdds() {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("sport", sport);
      params.set("league", league);
      params.set("force", "1");

      const res = await fetch(`/api/odds?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      const next = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setMatches(next);
      setSelectedMatch(next[0] || null);
      setSourceText(
        data?.source === "live"
          ? `Live-data · ${next.length} ottelua`
          : data?.reason || "Ei dataa"
      );
    } catch (error) {
      setMatches([]);
      setSelectedMatch(null);
      setSourceText(error?.message || "Haku epäonnistui");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOdds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (!match) return false;
      if (sport !== "all" && sportCategory(match.sport_key) !== sport) return false;
      return true;
    });
  }, [matches, sport]);

  const featured = filteredMatches[0] || null;

  return (
    <PageShell>
      <Hero
        title="Scorecaster"
        subtitle="Yksinkertainen betting intelligence -näkymä: parhaat kertoimet, isot bookkerit ja live-data samassa paikassa."
      >
        <div style={{ color: "#86efac", fontWeight: 900, marginBottom: 16 }}>
          {sourceText || `Live-data · ${filteredMatches.length} ottelua`}
        </div>

        <PrimaryButton onClick={loadOdds} disabled={loading}>
          {loading ? "Päivitetään..." : "Päivitä ottelut"}
        </PrimaryButton>
      </Hero>

      <Card>
        <div style={{ color: "#94a3b8", fontWeight: 900, marginBottom: 10 }}>Laji</div>
        <Row>
          {SPORTS.map((item) => (
            <Chip
              key={item.id}
              active={sport === item.id}
              onClick={() => {
                setSport(item.id);
                setLeague("ALL");
              }}
            >
              {item.label}
            </Chip>
          ))}
        </Row>

        <div style={{ color: "#94a3b8", fontWeight: 900, margin: "22px 0 10px" }}>Liiga</div>
        <Row>
          {LEAGUES.map((item) => (
            <Chip key={item.id} active={league === item.id} onClick={() => setLeague(item.id)}>
              {item.label}
            </Chip>
          ))}
        </Row>
      </Card>

      {featured ? <FeaturedMatch match={featured} /> : null}

      <Card>
        <SectionTitle>Ottelut</SectionTitle>

        {filteredMatches.length === 0 ? (
          <div style={{ color: "#94a3b8", fontWeight: 800 }}>Ei otteluita löytynyt.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filteredMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                active={selectedMatch?.id === match.id}
                onClick={() => setSelectedMatch(match)}
              />
            ))}
          </div>
        )}
      </Card>

      {selectedMatch ? <BookmakerComparison match={selectedMatch} /> : null}
    </PageShell>
  );
}

function FeaturedMatch({ match }) {
  const best = getBestMarketOdds(match);
  const bestPick = [best.home, best.draw, best.away]
    .filter((x) => x.odds)
    .sort((a, b) => b.odds - a.odds)[0];

  return (
    <Card style={{ background: "linear-gradient(180deg,rgba(34,197,94,0.20),rgba(2,6,23,0.92))" }}>
      <div style={{ color: "#86efac", fontWeight: 950, marginBottom: 10 }}>FEATURED BEST ODDS</div>

      <h2 style={{ margin: 0, fontSize: "clamp(34px,8vw,66px)", lineHeight: 0.95 }}>
        {match.home_team} vs {match.away_team}
      </h2>

      <div style={{ color: "#94a3b8", marginTop: 12, fontWeight: 800 }}>
        {match.sport_title || match.sport_key} · {formatTime(match.commence_time)}
      </div>

      {bestPick ? (
        <div style={{
          marginTop: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 24,
          padding: 18,
        }}>
          <div style={{ color: "#94a3b8", fontWeight: 900 }}>Paras kerroin nyt</div>
          <div style={{ fontSize: 52, fontWeight: 950 }}>{bestPick.odds}</div>
          <div style={{ color: "#86efac", fontWeight: 950 }}>{bestPick.label} · {bestPick.bookmaker}</div>
        </div>
      ) : null}
    </Card>
  );
}

function MatchCard({ match, active, onClick }) {
  const best = getBestMarketOdds(match);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        color: "white",
        border: active ? "1px solid rgba(34,197,94,0.75)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.05)",
        borderRadius: 24,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 950 }}>
        {match.home_team} vs {match.away_team}
      </div>

      <div style={{ color: "#94a3b8", marginTop: 8, fontWeight: 800 }}>
        {match.sport_title || match.sport_key} · {formatTime(match.commence_time)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <MiniOdd title="1" data={best.home} />
        <MiniOdd title="2" data={best.away} />
      </div>

      {best.draw?.odds ? (
        <div style={{ marginTop: 10 }}>
          <MiniOdd title="X" data={best.draw} />
        </div>
      ) : null}
    </button>
  );
}

function MiniOdd({ title, data }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(2,6,23,0.35)",
      borderRadius: 16,
      padding: 12,
    }}>
      <div style={{ color: "#94a3b8", fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 950 }}>{data?.odds || "-"}</div>
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>{data?.bookmaker || ""}</div>
    </div>
  );
}

function BookmakerComparison({ match }) {
  const best = getBestMarketOdds(match);
  const majorRows = getMajorBookmakerOdds(match);

  return (
    <Card>
      <SectionTitle>Parhaat kertoimet</SectionTitle>

      <div style={{ display: "grid", gap: 12 }}>
        <BestOddRow label={best.home.label} data={best.home} />
        {best.draw?.odds ? <BestOddRow label="Tasapeli" data={best.draw} /> : null}
        <BestOddRow label={best.away.label} data={best.away} />
      </div>

      <h3 style={{ margin: "26px 0 14px", fontSize: 26 }}>Isoimmat bookkerit</h3>

      {majorRows.length === 0 ? (
        <div style={{ color: "#94a3b8", fontWeight: 800 }}>
          Ei isoja bookkereita tässä ottelussa.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {majorRows.map((row) => (
            <div key={row.bookmaker} style={{
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 18,
              padding: 14,
            }}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>{row.bookmaker}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <BookOdd label="1" value={row.home} />
                <BookOdd label="X" value={row.draw} />
                <BookOdd label="2" value={row.away} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BestOddRow({ label, data }) {
  return (
    <div style={{
      border: "1px solid rgba(34,197,94,0.30)",
      background: "rgba(34,197,94,0.10)",
      borderRadius: 20,
      padding: 16,
    }}>
      <div style={{ color: "#94a3b8", fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 42, fontWeight: 950 }}>{data?.odds || "-"}</div>
      <div style={{ color: "#86efac", fontWeight: 950 }}>{data?.bookmaker || ""}</div>
    </div>
  );
}

function BookOdd({ label, value }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 10,
      background: "rgba(2,6,23,0.35)",
    }}>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{label}</div>
      <div style={{ fontWeight: 950, fontSize: 20 }}>{value || "-"}</div>
    </div>
  );
}
