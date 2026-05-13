"use client";

import { generateReasoning } from "@/lib/ai-reasoning";

function card(extra = {}) {
  return {
    border: "1px solid rgba(34,197,94,0.25)",
    borderRadius: 18,
    padding: 16,
    background: "rgba(6,78,59,0.18)",
    ...extra,
  };
}

export default function AIReasoningPanel({
  pick,
  match,
  movement,
}) {
  if (!pick || !match) return null;

  const reasoning = generateReasoning({
    pick,
    match,
    movement,
  });

  const confidenceColor =
    reasoning.confidence === "Korkea"
      ? "#86efac"
      : reasoning.confidence === "Hyvä"
      ? "#bbf7d0"
      : reasoning.confidence === "Kohtalainen"
      ? "#fde68a"
      : "#fca5a5";

  return (
    <section style={card()}>
      <div
        style={{
          color: "#86efac",
          fontWeight: 900,
          letterSpacing: 2,
          fontSize: 12,
        }}
      >
        AI REASONING
      </div>

      <h3
        style={{
          marginTop: 8,
          marginBottom: 8,
          fontSize: 24,
        }}
      >
        {reasoning.title}
      </h3>

      <div
        style={{
          color: confidenceColor,
          fontWeight: 900,
          marginBottom: 12,
        }}
      >
        Luottamus: {reasoning.confidence}
      </div>

      <div
        style={{
          color: "#d1fae5",
          lineHeight: 1.5,
          marginBottom: 12,
          fontWeight: 800,
        }}
      >
        {reasoning.summary}
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        {reasoning.bullets.map((item, index) => (
          <div
            key={index}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(255,255,255,0.04)",
              color: "#cbd5e1",
              lineHeight: 1.5,
            }}
          >
            • {item}
          </div>
        ))}
      </div>
    </section>
  );
}
