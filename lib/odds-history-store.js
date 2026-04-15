"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "scorecaster_odds_history";

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function useOddsHistoryStore() {
  const [history, setHistory] = useState({});

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setHistory(safeParse(raw, {}));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  function addSnapshot({ market, matches }) {
    if (!market || !Array.isArray(matches)) return;

    const timestamp = new Date().toISOString();

    setHistory((prev) => {
      const next = { ...prev };

      for (const match of matches) {
        const key = `${market}:${match.id}`;
        const previous = next[key] || [];

        const snapshot = {
          timestamp,
          bestOdds: match.bestOdds || {},
        };

        const deduped =
          previous.length > 0 &&
          JSON.stringify(previous[previous.length - 1]?.bestOdds || {}) ===
            JSON.stringify(snapshot.bestOdds)
            ? previous
            : [...previous, snapshot];

        next[key] = deduped.slice(-20);
      }

      return next;
    });
  }

  function getSnapshots(market, matchId) {
    return history[`${market}:${matchId}`] || [];
  }

  return {
    history,
    addSnapshot,
    getSnapshots,
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

  const current = Number(last?.[key] ?? 0);
  const previous = Number(prev?.[key] ?? 0);

  if (!current || !previous) {
    return {
      current: current || null,
      previous: previous || null,
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
