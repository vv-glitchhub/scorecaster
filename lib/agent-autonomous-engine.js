export function generateAutonomousTasks(
  picks = []
) {
  const tasks = [];

  for (const pick of picks) {
    if (
      pick.decision === "WATCH"
    ) {
      tasks.push({
        type:
          "monitor_line",

        match:
          pick.match,

        reason:
          "Potential value but insufficient confidence."
      });
    }

    if (
      pick.readiness?.level ===
      "Low"
    ) {
      tasks.push({
        type:
          "collect_data",

        match:
          pick.match,

        reason:
          "Missing intelligence data."
      });
    }

    if (
      pick.newsScore < -0.03
    ) {
      tasks.push({
        type:
          "verify_news",

        match:
          pick.match,

        reason:
          "Negative news detected."
      });
    }
  }

  return tasks;
}
