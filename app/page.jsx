"use client";

import { useEffect, useMemo, useState } from "react";

const TEXT = {
  fi: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
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
    stats: "Tilastot"
  },
  en: {
    title: "SCORECASTER",
    subtitle: "AI-POWERED SPORTS ANALYTICS",
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
    stats: "Stats"
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

function labelOutcome(name, lang) {
  if (name === "Draw") return lang === "fi" ? "Tasapeli" : "Draw";
  return name;
}

export default function Page() {
  const [lang, setLang] = useState("fi");
  const t = TEXT[lang];

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("jalkapallo");
  const [selectedSportKey, setSelectedSportKey] = useState("all");

  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [factors, setFactors] = useState(new Set());

  const [result, setResult] = useState(null);
  const [loadingPredict, setLoadingPredict] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSports() {
      try {
        const res = await fetch("/api/sports", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Sports fetch failed");

        setSports(data.sports ||
