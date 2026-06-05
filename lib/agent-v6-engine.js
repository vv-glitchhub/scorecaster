import { buildAgentV5Pick } from "./agent-v5-engine";
import { buildAgentMemory } from "./agent-memory-engine";
import { calculateAdaptiveBoost } from "./agent-adaptation-engine";

export function buildAgentV6Pick({
  pick,
  trackedBets = [],
  learningBoost = 0,
  movementSignal = "Stable",
  contextInput = {},
  marketInput = {},
  newsItems = [],
  injuries = [],
  lineup = {}
}) {
  const basePick = buildAgentV5Pick({
    pick,
    learningBoost,
    movementSignal,
    contextInput,
    marketInput,
    newsItems,
    injuries,
    lineup
  });

  const memory = buildAgentMemory(trackedBets);

  const adaptation = calculateAdaptiveBoost({
    sportKey:
      pick.sportKey ||
      pick.league ||
      "unknown",

    marketKey:
      pick.marketKey ||
      "unknown",

    bookmaker:
      pick.bookmaker ||
      "unknown",

    memory
  });

  const finalScore =
    Number(basePick.finalScore || 0) +
    Number(adaptation.adaptiveBoost || 0);

  const decision =
    finalScore >= 0.12
      ? "BET"
      : finalScore >= 0.06
      ? "WATCH"
      : finalScore >= 0.02
      ? "WAIT"
      : "PASS";

  return {
    ...basePick,

    agentVersion: "V6",

    finalScore,

    decision,

    adaptiveBoost:
      adaptation.adaptiveBoost,

    adaptiveNotes:
      adaptation.notes,

    memorySummary: {
      totalBets:
        memory.totalBets,

      wins:
        memory.wins,

      losses:
        memory.losses,

      profit:
        memory.profit
    },

    report: {
      ...basePick.report,

      memory: {
        adaptiveBoost:
          adaptation.adaptiveBoost,

        notes:
          adaptation.notes,

        totalBets:
          memory.totalBets,

        profit:
          memory.profit
      }
    }
  };
}
