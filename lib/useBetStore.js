"use client";

import { useEffect, useState } from "react";

export function useBetStore() {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("scorecaster_bets");
    if (stored) {
      setBets(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("scorecaster_bets", JSON.stringify(bets));
  }, [bets]);

  function addBet(bet) {
    setBets((prev) => [
      ...prev,
      {
        ...bet,
        id: crypto.randomUUID(),
        result: "pending",
        profit: 0,
      },
    ]);
  }

  function updateResult(id, result) {
    setBets((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;

        let profit = 0;

        if (result === "win") {
          profit = b.stake * (b.odds - 1);
        } else if (result === "lose") {
          profit = -b.stake;
        } else if (result === "void") {
          profit = 0;
        } else if (result === "pending") {
          profit = 0;
        }

        return { ...b, result, profit };
      })
    );
  }

  return { bets, addBet, updateResult };
}
