import { settlePick } from "./settlement-engine";
import { saveLearningRecord } from "./learning-storage";

export async function runSettlementForPicks({ picks = [], scores = {}, clvByPick = {} }) {
  const settled = [];
  const pending = [];
  const failed = [];

  for (const pick of picks) {
    try {
      const score = scores[pick.gameId] || scores[pick.id];
      const settlement = settlePick({ pick, finalScore: score || {} });

      if (settlement.status !== "settled") {
        pending.push({ pick, settlement });
        continue;
      }

      const learning = await saveLearningRecord({
        pick,
        result: settlement.result,
        clv: clvByPick[pick.id] || clvByPick[pick.gameId] || null
      });

      settled.push({ pick, settlement, learning });
    } catch (error) {
      failed.push({ pick, error: error.message });
    }
  }

  return {
    ok: true,
    source: "settlement-runner-v1",
    summary: {
      total: picks.length,
      settled: settled.length,
      pending: pending.length,
      failed: failed.length
    },
    settled,
    pending,
    failed
  };
}
