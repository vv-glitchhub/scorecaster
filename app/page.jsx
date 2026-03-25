"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    selectLeague: "VALITSE LIIGA",
    fetchGames: "HAE PELIT",
    loading: "Ladataan...",
    noGames: "Ei otteluita löytynyt.",
    selectedMatch: "VALITTU OTTELU",
    factors: "VAIKUTTAVAT TEKIJÄT",
    analyze: "ANALYSOI JA ENNUSTA",
    probabilities: "VOITTOTODENNÄKÖISYYDET",
    recommendation: "SUOSITUS",
    confidence: "LUOTTAMUS",
    aiAnalysis: "AI-ANALYYSI",
    stats: "TILASTOT"
  },
  en: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    selectLeague: "SELECT LEAGUE",
    fetchGames: "FETCH GAMES",
    loading: "Loading...",
    noGames: "No matches found.",
    selectedMatch: "SELECTED MATCH",
    factors: "KEY FACTORS",
    analyze: "ANALYZE & PREDICT",
    probabilities: "WIN PROBABILITIES",
    recommendation: "RECOMMENDATION",
    confidence: "CONFIDENCE",
    aiAnalysis: "AI ANALYSIS",
    stats: "STATS"
  }
};

const FACTORS = {
  jalkapallo: {
    fi: [
      "Kotikenttäetu",
      "Avainpelaaja loukkaantunut",
      "Derby-ottelu",
      "Eurooppa rasittaa",
      "Puolustus tiukka"
    ],
    en: [
      "Home advantage",
      "Key player injured",
      "Derby match",
      "European fatigue",
      "Strong defense"
    ]
  },
  jaakiekko: {
    fi: [
      "Kotietu",
      "Maalivahti vireessä",
      "Back-to-back peli",
      "Puolustus tiivis",
      "Loukkaantumiset"
    ],
    en: [
      "Home advantage",
      "Goalie in form",
      "Back-to-back game",
      "Tight defense",
      "Injuries"
    ]
  },
  koripallo: {
    fi: [
      "Kotisali tukee",
      "Tähti loukkaantunut",
      "3-pisteet uppoaa",
      "Nopea tempo",
      "Väsynyt penkki"
    ],
    en: [
      "Home court boost",
      "Star player injured",
      "3-pointers falling",
      "Fast pace",
      "Tired bench"
    ]
  },
  other: {
    fi: ["Kotietu", "Loukkaantumiset", "Motivaatio"],
    en: ["Home advantage", "Injuries", "Motivation"]
  }
};

function labelOutcome(name, lang) {
  if (name === "Draw") return lang === "fi" ? "Tasapeli" : "Draw";
  return name;
}

function getBestOdds(game) {
  const best = {};

  for (const bookmaker of game.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== "h2h") continue;
      for (const outcome of market.outcomes || []) {
        const current = best[outcome.name];
        if (!current || outcome.price > current.price) {
          best[outcome.name] = {
            name: outcome.name,
            price: outcome.price,
            bookmaker: bookmaker.title
          };
        }
      }
    }
  }

  return Object.values(best);
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [sports, setSports] = useState([]);
  const [sportsLoading, setSportsLoading] = useState(true);

  const [selectedSportKey, setSelectedSportKey] = useState("");
  const [selectedSportCategory, setSelectedSportCategory] = useState("other");

  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [factors, setFactors] = useState(new Set());

  const [result, setResult] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Sports fetch failed");

        setSports(data.sports || []);

        const defaultSport =
          (data.sports || []).find((s) => s.category === "jalkapallo") ||
          data.sports?.[0];

        if (defaultSport) {
          setSelectedSportKey(defaultSport.key);
          setSelectedSportCategory(defaultSport.category || "other");
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setSportsLoading(false);
      }
    }

    loadSports();
  }, []);

  async function fetchGames() {
    if (!selectedSportKey) return;

    setGamesLoading(true);
    setError("");
    setGames([]);
    setSelectedGame(null);
    setResult(null);

    try {
      const selectedSport = sports.find((s) => s.key === selectedSportKey);
      if (selectedSport) {
        setSelectedSportCategory(selectedSport.category || "other");
      }

      const res = await fetch(`/api/games?sportKey=${selectedSportKey}`, {
        cache: "no-store"
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Games fetch failed");

      setGames(data.games || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setGamesLoading(false);
    }
  }

  async function predict() {
    if (!selectedGame) return;

    setPredictLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: selectedSportCategory,
          game: selectedGame,
          selectedFactors: Array.from(factors)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Prediction failed");

      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setPredictLoading(false);
    }
  }

  const selectedSport = useMemo(
    () => sports.find((s) => s.key === selectedSportKey),
    [sports, selectedSportKey]
  );

  const availableFactors =
    FACTORS[selectedSportCategory]?.[lang] || FACTORS.other[lang];

  function toggleFactor(f) {
    setFactors((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "#eaeaea", background: "#0b0b12", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t.subtitle}</div>
          <h1 style={{ margin: 0 }}>{t.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setLang("fi")}>FI</button>
          <button onClick={() => setLang("en")}>EN</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ff4d6d", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
        <div style={{ marginBottom: 10, fontWeight: 700 }}>{t.selectLeague}</div>

        {sportsLoading ? (
          <div>{t.loading}</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={selectedSportKey}
              onChange={(e) => {
                const key = e.target.value;
                setSelectedSportKey(key);
                const found = sports.find((s) => s.key === key);
                setSelectedSportCategory(found?.category || "other");
                setFactors(new Set());
                setGames([]);
                setSelectedGame(null);
                setResult(null);
              }}
              style={{ minWidth: 320, padding: 10 }}
            >
              {sports.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title} ({s.group})
                </option>
              ))}
            </select>

            <button onClick={fetchGames} disabled={!selectedSportKey || gamesLoading}>
              {gamesLoading ? t.loading : t.fetchGames}
            </button>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
        <div style={{ marginBottom: 12, fontWeight: 700 }}>
          {selectedSport ? `${selectedSport.title}` : "Matches"}
        </div>

        {gamesLoading ? (
          <div>{t.loading}</div>
        ) : games.length === 0 ? (
          <div>{t.noGames}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {games.map((g) => (
              <div
                key={g.id}
                onClick={() => {
                  setSelectedGame(g);
                  setResult(null);
                }}
                style={{
                  border: selectedGame?.id === g.id ? "1px solid #00d4ff" : "1px solid #333",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {g.home} vs {g.away}
                </div>
                <div style={{ opacity: 0.8, fontSize: 14 }}>
                  {g.league} · {g.time}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {getBestOdds(g).map((o) => (
                    <span key={o.name} style={{ fontSize: 12, border: "1px solid #333", padding: "4px 8px", borderRadius: 6 }}>
                      {labelOutcome(o.name, lang)} {o.price}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedGame && (
        <>
          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.selectedMatch}</div>
            <div>{selectedGame.home} vs {selectedGame.away}</div>
            <div style={{ opacity: 0.8, fontSize: 14 }}>{selectedGame.league} · {selectedGame.time}</div>
          </section>

          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.factors}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {availableFactors.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFactor(f)}
                  style={{
                    padding: "8px 10px",
                    border: factors.has(f) ? "1px solid #00d4ff" : "1px solid #333",
                    background: factors.has(f) ? "#10222b" : "transparent",
                    color: "#fff",
                    borderRadius: 6
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </section>

          <button onClick={predict} disabled={predictLoading} style={{ marginBottom: 24, padding: "12px 16px" }}>
            {predictLoading ? t.loading : t.analyze}
          </button>
        </>
      )}

      {result && (
        <>
          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.recommendation}</div>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{result.recommendation}</div>
            <div>{t.confidence}: {result.confidence}</div>
          </section>

          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.probabilities}</div>
            <div>{selectedGame.home}: {result.homeWinProb}%</div>
            {result.drawProb > 0 && <div>Draw: {result.drawProb}%</div>}
            <div>{selectedGame.away}: {result.awayWinProb}%</div>
          </section>

          {result.bestBet && (
            <section style={{ marginBottom: 24, padding: 16, border: "1px solid #1f8f5f", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Best Bet</div>
              <div>{result.bestBet.outcome}</div>
              <div>Odds: {result.bestBet.odds}</div>
              <div>Bookmaker: {result.bestBet.bookmaker}</div>
              <div>Model: {result.bestBet.modelProb}%</div>
              <div>Market: {result.bestBet.marketProb}%</div>
              <div>Edge: +{result.bestBet.edge}%</div>
            </section>
          )}

          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.stats}</div>
            <div>{selectedGame.home}: {Array.isArray(result.stats?.homeLast5) ? result.stats.homeLast5.join(" ") : "N/A"}</div>
            <div>{selectedGame.away}: {Array.isArray(result.stats?.awayLast5) ? result.stats.awayLast5.join(" ") : "N/A"}</div>
            <div>H2H: {result.stats?.h2h || "N/A"}</div>
          </section>

          <section style={{ marginBottom: 24, padding: 16, border: "1px solid #222", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.aiAnalysis}</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{result.analysis}</div>
          </section>
        </>
      )}
    </main>
  );
}
