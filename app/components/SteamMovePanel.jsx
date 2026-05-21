"use client";

import { analyzeSteamMove } from "@/lib/steam-move-engine";

export default function SteamMovePanel({ match }) {
  if (!match) return null;

  const steam = analyzeSteamMove(match);

  return (
    <section className={steam.detected ? "score-card steam active" : "score-card steam"}>
      <h2>Steam Move V2</h2>

      <div className={steam.detected ? "signal good" : "signal muted"}>
        {steam.message}
      </div>

      {steam.detected ? (
        <div className="mini-meta">
          <span>Kohde: {steam.side}</span>
          <span>Voima: {steam.strength.toFixed(2)}</span>
          <span>Confidence: {steam.confidence}/100</span>
        </div>
      ) : null}
    </section>
  );
}
