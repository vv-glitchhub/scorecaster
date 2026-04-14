"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "scorecaster_bets";

export function useBetStore() {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBets(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load bets", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
    } catch (error) {
      console.error("Failed to save bets", error);
    }
  }, [bets]);

  function addBet(bet) {
    setBets((prev) => [
      ...prev,
      {
        ...bet,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        result: "pending",
        profit: 0,
      },
    ]);
  }

  function updateResult(id, result) {
    setBets((prev) =>
      prev.map((bet) => {
        if (bet.id !== id) return bet;

        let profit = 0;

        if (result === "win") {
          profit = Number((bet.stake * (bet.odds - 1)).toFixed(2));
        } else if (result === "lose") {
          profit = Number((-bet.stake).toFixed(2));
        } else if (result === "void") {
          profit = 0;
        } else {
          profit = 0;
        }

        return {
          ...bet,
          result,
          profit,
        };
      })
    );
  }

  function removeBet(id) {
    setBets((prev) => prev.filter((bet) => bet.id !== id));
  }

  function clearBets() {
    setBets([]);
  }

  return {
    bets,
    addBet,
    updateResult,
    removeBet,
    clearBets,
  };
}
