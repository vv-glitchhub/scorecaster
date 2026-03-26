"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    codeUpdated: "Koodi päivitetty",
    selectSport: "Valitse laji",
    selectLeague: "Valitse liiga",
    allSports: "Kaikki lajit",
    allLeagues: "Kaikki liigat",
    fetchGames: "Hae pelit",
    loading: "Ladataan...",
    noGames: "Ei pelejä löytynyt.",
    selectedMatch: "Valittu ottelu",
    factors: "Vaikuttavat tekijät",
    analyze: "Analysoi",
    recommendation: "Suositus",
    probabilities: "Todennäköisyydet",
    confidence: "Luottamus",
    bestBet: "Paras veto",
    analysis: "Analyysi",
    stats: "Tilastot",
    draw: "Tasapeli"
  },
  en: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
    codeUpdated: "Code updated",
    selectSport: "Select sport",
    selectLeague: "Select league",
    allSports: "All sports",
    allLeagues: "All leagues",
    fetchGames: "Fetch games",
    loading: "Loading...",
    noGames: "No games found.",
    selectedMatch: "Selected match",
    factors: "Key factors",
    analyze: "Analyze",
    recommendation: "Recommendation",
    probabilities: "Probabilities",
    confidence: "Confidence",
    bestBet: "Best bet",
    analysis: "Analysis",
    stats: "Stats",
    draw: "Draw"
  }
};

const SPORT_LABELS = {
  fi: {
    jalkapallo: "Jalkapallo",
    jaakiekko: "Jääkiekko",
    koripallo: "Koripallo",
    other: "Muut"
  },
  en: {
    jalkapallo: "Football",
    jaakiekko: "Ice hockey",
    koripallo: "Basketball",
    other: "Other"
  }
};

const FACTORS = {
  jalkapallo: {
    fi: ["Kotikenttäetu", "Avainpelaaja loukkaantunut", "Derby-ottelu"],
    en: ["Home advantage", "Key player injured", "Derby match"]
  },
  jaakiekko: {
    fi: ["Kotietu", "Maalivahti vireessä", "Back-to-back peli"],
    en: ["Home advantage", "Goalie in form", "Back-to-back game"]
  },
  koripallo: {
    fi: ["Kotisali tukee", "Tähti loukkaantunut", "Nopea tempo"],
    en: ["Home court boost", "Star player injured", "Fast pace"]
  },
  other: {
    fi: ["Kotietu", "Loukkaantumiset", "Motivaatio"],
    en: ["Home advantage", "Injuries", "Motivation"]
  }
};

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

function labelOutcome(name, t) {
  if (name === "Draw") return t.draw;
  return name;
}

function formatVersionDate(date, lang) {
  if (!date) return "";
  return new Date(date).toLocaleString(lang === "fi" ? "fi-FI" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("jaakiekko");
  const [selectedSportKey, setSelectedSportKey] = useState("all");

  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [factors, setFactors] = useState(new Set());

  const [result, setResult] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  const [error, setError] = useState("");
  const [version, setVersion] = useState(null);

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Sports fetch failed");
        setSports(data.sports || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingSports(false);
      }
    }

    async function loadVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();

        if (res.ok && !data.error) {
          setVersion(data);
        }
      } catch {
        // ignore
      }
    }

    loadSports();
    loadVersion();
  }, []);

  const filteredSports = useMemo(() => {
    if (selectedCategory === "all") return sports;
    return sports.filter((s) => s.category === selectedCategory);
  }, [sports, selectedCategory]);

  const factorCategory =
    selectedCategory === "all" ? "other" : selectedCategory;

  const availableFactors =
    FACTORS[factorCategory]?.[lang] || FACTORS.other[lang];

  function toggleFactor(factor) {
    setFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factor)) next.delete(factor);
      else next.add(factor);
      return next;
    });
  }

  async function fetchGames() {
    if (loadingGames) return;

    setLoadingGames(true);
    setError("");
    setGames([]);
    setSelectedGame(null);
    setResult(null);

    try {
      let sportKeys = [];

      if (selectedCategory === "all") {
        sportKeys =
          selectedSportKey === "all"
            ? sports.map((s) => s.key)
            : [selectedSportKey];
      } else {
        sportKeys =
          selectedSportKey === "all"
            ? filteredSports.map((s) => s.key)
            : [selectedSportKey];
      }

      const responses = await Promise.all(
        sportKeys.map(async (key) => {
          const res = await fetch(`/api/games?sportKey=${key}`, {
            cache: "no-store"
          });
          const data = await res.json();

          if (!res.ok) throw new Error(data.error || "Games fetch failed");
          return data.games || [];
        })
      );

      const mergedGames = responses.flat();

      const uniqueGames = mergedGames.filter(
        (game, index, arr) =>
          index === arr.findIndex((g) => g.id === game.id)
      );

      uniqueGames.sort(
        (a, b) => new Date(a.commence_time) - new Date(b.commence_time)
      );

      setGames(uniqueGames);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingGames(false);
    }
  }

  async function predict() {
    if (!selectedGame || loadingPredict) return;

    setLoadingPredict(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: selectedCategory === "all" ? "other" : selectedCategory,
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
      setLoadingPredict(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 20,
        background: "#0b0b12",
        color: "#f1f1f1",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t.subtitle}</div>
          <h1 style={{ margin: 0 }}>{t.title}</h1>

          {version?.date && (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
              {t.codeUpdated}: {formatVersionDate(version.date, lang)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setLang("fi")}>FI</button>
          <button onClick={() => setLang("en")}>EN</button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #ff5c7a",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8
        }}
      >
        {loadingSports ? (
          <div>{t.loading}</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>
                {t.selectSport}
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSportKey("all");
                  setGames([]);
                  setSelectedGame(null);
                  setResult(null);
                  setFactors(new Set());
                }}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="jalkapallo">{SPORT_LABELS[lang].jalkapallo}</option>
                <option value="jaakiekko">{SPORT_LABELS[lang].jaakiekko}</option>
                <option value="koripallo">{SPORT_LABELS[lang].koripallo}</option>
                <option value="all">{t.allSports}</option>
              </select>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>
                {t.selectLeague}
              </div>

              <select
                value={selectedSportKey}
                onChange={(e) => {
                  setSelectedSportKey(e.target.value);
                  setGames([]);
                  setSelectedGame(null);
                  setResult(null);
                }}
                style={{ width: "100%", padding: 10 }}
              >
                <option value="all">{t.allLeagues}</option>

                {filteredSports.map((sport) => (
                  <option key={sport.key} value={sport.key}>
                    {sport.title}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={fetchGames} disabled={loadingGames}>
              {loadingGames ? t.loading : t.fetchGames}
            </button>
          </div>
        )}
      </section>

      <section
        style={{
          marginBottom: 20,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8
        }}
      >
        {loadingGames ? (
          <div>{t.loading}</div>
        ) : games.length === 0 ? (
          <div>{t.noGames}</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => {
                  setSelectedGame(game);
                  setResult(null);
                }}
                style={{
                  border:
                    selectedGame?.id === game.id
                      ? "1px solid #00d4ff"
                      : "1px solid #333",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer"
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {game.home} vs {game.away}
                </div>

                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  {game.dayLabel} · {game.league} · {game.time}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap"
                  }}
                >
                  {getBestOdds(game).map((o) => (
                    <span
                      key={o.name}
                      style={{
                        border: "1px solid #333",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 12
                      }}
                    >
                      {labelOutcome(o.name, t)} {o.price}
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
          <section
            style={{
              marginBottom: 20,
              padding: 16,
              border: "1px solid #222",
              borderRadius: 8
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              {t.selectedMatch}
            </div>
            <div>
              {selectedGame.home} vs {selectedGame.away}
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              {selectedGame.dayLabel} · {selectedGame.league} · {selectedGame.time}
            </div>
          </section>

          <section
            style={{
              marginBottom: 20,
              padding: 16,
              border: "1px solid #222",
              borderRadius: 8
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: 700 }}>
              {t.factors}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {availableFactors.map((factor) => (
                <button
                  key={factor}
                  onClick={() => toggleFactor(factor)}
                  style={{
                    padding: "8px 10px",
                    border: factors.has(factor)
                      ? "1px solid #00d4ff"
                      : "1px solid #333",
                    background: factors.has(factor) ? "#11222c" : "transparent",
                    color: "#fff",
                    borderRadius: 6
                  }}
                >
                  {factor}
                </button>
              ))}
            </div>
          </section>

          <button
            onClick={predict}
            disabled={loadingPredict}
            style={{ marginBottom: 24, padding: "12px 16px" }}
          >
            {loadingPredict ? t.loading : t.analyze}
          </button>
        </>
      )}

      {result && (
        <section style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.recommendation}
            </div>
            <div style={{ fontSize: 24 }}>{result.recommendation}</div>
            <div style={{ marginTop: 6 }}>
              {t.confidence}: {result.confidence}
            </div>
          </div>

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.probabilities}
            </div>
            <div>{selectedGame.home}: {result.homeWinProb}%</div>
            {result.drawProb > 0 && <div>{t.draw}: {result.drawProb}%</div>}
            <div>{selectedGame.away}: {result.awayWinProb}%</div>
          </div>

          {result.bestBet && (
            <div
              style={{
                border: "1px solid #1f8f5f",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {t.bestBet}
              </div>
              <div>{result.bestBet.outcome}</div>
              <div>Odds: {result.bestBet.odds}</div>
              <div>Bookmaker: {result.bestBet.bookmaker}</div>
              <div>Edge: +{result.bestBet.edge}%</div>
            </div>
          )}

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.stats}
            </div>
            <div>
              {selectedGame.home}:{" "}
              {Array.isArray(result.stats?.homeLast5)
                ? result.stats.homeLast5.join(" ")
                : "N/A"}
            </div>
            <div>
              {selectedGame.away}:{" "}
              {Array.isArray(result.stats?.awayLast5)
                ? result.stats.awayLast5.join(" ")
                : "N/A"}
            </div>
            <div>H2H: {result.stats?.h2h || "N/A"}</div>
          </div>

          <div
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: 14
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {t.analysis}
            </div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {result.analysis}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
