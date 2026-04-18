"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "scorecaster_odds_history";
const MAX_SNAPSHOTS_PER_MATCH = 40;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pickBestOddsByMarket(bestOdds = {}, market = "h2h") {
  if (market === "totals") {
    return {
      point: bestOdds?.point ?? null,
      over: bestOdds?.over ?? null,
      under: bestOdds?.under ?? null,
    };
  }

  if (market === "spreads") {
    return {
      spreadPointHome: bestOdds?.spreadPointHome ?? null,
      spreadPointAway: bestOdds?.spreadPointAway ?? null,
      spreadHome: bestOdds?.spreadHome ?? null,
      spreadAway: bestOdds?.spreadAway ?? null,
    };
  }

  return {
    home: bestOdds?.home ?? null,
    draw: bestOdds?.draw ?? null,
    away: bestOdds?.away ?? null,
  };
}

function areSnapshotsEquivalent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useOddsHistoryStore() {
  const [history, setHistory] = useState({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setHistory(safeParse(raw, {}));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  function addSnapshot({ market, matches }) {
    if (!market || !Array.isArray(matches) || matches.length === 0) return;

    const timestamp = new Date().toISOString();

    setHistory((prev) => {
      const next = { ...prev };

      for (const match of matches) {
        if (!match?.id) continue;

        const key = `${market}:${match.id}`;
        const previousSnapshots = Array.isArray(next[key]) ? next[key] : [];

        const normalizedBestOdds = pickBestOddsByMarket(match?.bestOdds || {}, market);

        const snapshot = {
          timestamp,
          market,
          matchId: match.id,
          bestOdds: normalizedBestOdds,
        };

        const lastSnapshot = previousSnapshots[previousSnapshots.length - 1];

        const shouldReuse =
          lastSnapshot &&
          areSnapshotsEquivalent(lastSnapshot.bestOdds || {}, snapshot.bestOdds || {});

        next[key] = shouldReuse
          ? previousSnapshots
          : [...previousSnapshots, snapshot].slice(-MAX_SNAPSHOTS_PER_MATCH);
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

  const currentValue = last?.[key];
  const previousValue = prev?.[key];

  const current = currentValue != null ? Number(currentValue) : null;
  const previous = previousValue != null ? Number(previousValue) : null;

  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) {
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
