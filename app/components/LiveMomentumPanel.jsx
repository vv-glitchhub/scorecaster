"use client";

import {
  calculateMomentum,
  calculateLiveWinProbability,
} from "@/lib/live-engine";

export default function LiveMomentumPanel({
  match,
}) {
  if (!match) return null;

  const momentum = calculateMomentum(match);
  const live = calculateLiveWinProbability(match);

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 18,
        background: "rgba(127,29,29,0.18)",
        color: "#fff",
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        Live Momentum Engine
      </h2>

      <div style={{ marginTop: 12 }}>
        <b>{momentum.summary}</b>
      </div>

      <div style={{ marginTop: 18 }}>
        Home momentum:
        {" "}
        {(momentum.home * 100).toFixed(1)}%
      </div>

      <div>
        Away momentum:
        {" "}
        {(momentum.away * 100).toFixed(1)}%
      </div>

      <div style={{ marginTop: 18 }}>
        Live win probability:
      </div>

      <div>
        {match.home_team}:
        {" "}
        {(live.home * 100).toFixed(1)}%
      </div>

      <div>
        {match.away_team}:
        {" "}
        {(live.away * 100).toFixed(1)}%
      </div>
    </section>
  );
}
