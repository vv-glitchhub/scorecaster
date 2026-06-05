export function generateAutonomousTasks(picks = []) {
  const tasks = [];

  for (const pick of picks) {
    if (pick.decision === "WATCH") {
      tasks.push({
        type: "monitor_line",
        match: pick.match,
        reason: "Potential value but not strong enough for BET."
      });
    }

    if (pick.decision === "WAIT") {
      tasks.push({
        type: "wait_for_confirmation",
        match: pick.match,
        reason: "Agent needs better confidence or source quality."
      });
    }

    if (pick.readiness?.level === "Low") {
      tasks.push({
        type: "collect_data",
        match: pick.match,
        reason: `Missing data: ${(pick.readiness.missing || []).join(", ")}`
      });
    }

    if (Number(pick.newsScore || 0) < -0.03) {
      tasks.push({
        type: "verify_news",
        match: pick.match,
        reason: "Negative news signal detected."
      });
    }

    if (Number(pick.marketScore || 0) > 0.02) {
      tasks.push({
        type: "watch_market",
        match: pick.match,
        reason: "Positive market signal detected."
      });
    }
  }

  return tasks.slice(0, 20);
}
