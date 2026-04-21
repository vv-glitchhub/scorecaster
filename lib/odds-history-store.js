"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "scorecaster_odds_history_v2";
const MAX_SNAPSHOTS_PER_MATCH = 60;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pickMarketOdds(bestOdds = {}, market = "h2h") {
  if (market === "totals") {
    return {
      point: normalizeNumber(bestOdds?.point),
      over: normalizeNumber(bestOdds?.over),
      under: normalizeNumber(bestOdds?.under),
    };
  }

  if (market === "spreads") {
    return {
      spreadPointHome: normalizeNumber(bestOdds?.spreadPointHome),
      spreadPointAway: normalizeNumber(bestOdds?.spreadPointAway),
      spreadHome: normalizeNumber(bestOdds?.spreadHome),
      spreadAway: normalizeNumber(bestOdds?.spreadAway),
    };
  }

  return {
    home: normalizeNumber(bestOdds?.home),
    draw: normalizeNumber(bestOdds?.draw),
    away: normalizeNumber(bestOdds?.away),
  };
}

function snapshotEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useOddsHistoryStore() {
  const [history, setHistory] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    setHistory(safeParse(raw, {}));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  function addSnapshot({ market, matches, source = "unknown" }) {
    if (!market || !Array.isArray(matches) || matches.length === 0) return;

    const timestamp = new Date().toISOString();

    setHistory((prev) => {
      const next = { ...prev };

      for (const match of matches) {
        if (!match?.id) continue;

        const key = `${market}:${match.id}`;
        const previousSnapshots = Array.isArray(next[key]) ? next[key] : [];

        const snapshot = {
          timestamp,
          market,
          matchId: match.id,
          source,
          bestOdds: pickMarketOdds(match?.bestOdds || {}, market),
        };

        const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];

        if (lastSnapshot && snapshotEquals(lastSnapshot.bestOdds, snapshot.bestOdds)) {
          next[key] = previousSnapshots;
          continue;
        }

        next[key] = [...previousSnapshots, snapshot].slice(-MAX_SNAPSHOTS_PER_MATCH);
      }

      return next;
    });
  }

  function getSnapshots(market, matchId) {
    return history[`${market}:${matchId}`] || [];
  }

  function clearHistory() {
    setHistory({});
  }

  return {
    history,
    addSnapshot,
    getSnapshots,
    clearHistory,
  };
}

export function getOddsMovement({ snapshots, market, side }) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) {
    return {
      current: null,
      previous: null,
      delta: null,
      direction: "flat",
    };
  }

  const last = snapshots[snapshots.length - 1]?.bestOdds || {};
  const prev = snapshots[snapshots.length - 2]?.bestOdds || {};

  const keyMap = {
    h2h: {
      home: "home",
      draw: "draw",
      away: "away",
    },
    totals: {
      over: "over",
      under: "under",
    },
    spreads: {
      spreadHome: "spreadHome",
      spreadAway: "spreadAway",
    },
  };

  const key = keyMap?.[market]?.[side];
  if (!key) {
    return {
      current: null,
      previous: null,
      delta: null,
      direction: "flat",
    };
  }

  const current = normalizeNumber(last?.[key]);
  const previous = normalizeNumber(prev?.[key]);

  if (current == null || previous == null) {
    return {
      current,
      previous,
      delta: null,
      direction: "flat",
    };
  }

  const delta = Number((current - previous).toFixed(2));

  return {
    current,
    previous,
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

export function useMatchOddsMovements({ snapshots, market }) {
  return useMemo(() => {
    if (market === "totals") {
      return {
        over: getOddsMovement({ snapshots, market, side: "over" }),
        under: getOddsMovement({ snapshots, market, side: "under" }),
      };
    }

    if (market === "spreads") {
      return {
        spreadHome: getOddsMovement({ snapshots, market, side: "spreadHome" }),
        spreadAway: getOddsMovement({ snapshots, market, side: "spreadAway" }),
      };
    }

    return {
      home: getOddsMovement({ snapshots, market, side: "home" }),
      draw: getOddsMovement({ snapshots, market, side: "draw" }),
      away: getOddsMovement({ snapshots, market, side: "away" }),
    };
  }, [snapshots, market]);
}
