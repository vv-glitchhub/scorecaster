"use client";

import { useMemo } from "react";

export default function BankrollCurve({
  bets = [],
  startingBankroll = 1000,
  lang = "en",
}) {
  const chartData = useMemo(() => {
    const settled = bets
      .filter((bet) => bet.result !== "pending")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let bankroll = Number(startingBankroll) || 0;

    return settled.map((bet, index) => {
      bankroll += Number(bet.profit || 0);

      return {
        x: index + 1,
        y: Number(bankroll.toFixed(2)),
        label: `${bet.match} • ${bet.selection}`,
      };
    });
  }, [bets, startingBankroll]);

  const emptyText =
    lang === "fi"
      ? "Ei ratkaistuja vetoja bankroll-käyrää varten."
      : "No settled bets for bankroll curve.";

  if (chartData.length === 0) {
    return (
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "16px",
          padding: "16px",
          color: "#94a3b8",
          fontSize: "14px",
        }}
      >
        {emptyText}
      </div>
    );
  }

  const values = chartData.map((point) => point.y);
  const minY = Math.min(...values, startingBankroll);
  const maxY = Math.max(...values, startingBankroll);
  const range = maxY - minY || 1;

  const width = 700;
  const height = 240;
  const padding = 24;

  const points = chartData.map((point, index) => {
    const x =
      padding +
      (index / Math.max(chartData.length - 1, 1)) * (width - padding * 2);

    const y =
      height -
      padding -
      ((point.y - minY) / range) * (height - padding * 2);

    return { ...point, px: x, py: y };
  });

  const polylinePoints = points.map((p) => `${p.px},${p.py}`).join(" ");

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        padding: "16px",
      }}
    >
      <div
        style={{
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "14px",
          color: "#94a3b8",
        }}
      >
        <span>{lang === "fi" ? "Bankroll-käyrä" : "Bankroll Curve"}</span>
        <span>
          {lang === "fi" ? "Alkukassa" : "Starting bankroll"} €{Number(startingBankroll).toFixed(2)}
        </span>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", minWidth: "680px", height: "240px" }}
        >
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            points={polylinePoints}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point) => (
            <g key={point.x}>
              <circle cx={point.px} cy={point.py} r="4" fill="#38bdf8">
                <title>
                  {point.label} | #{point.x} | Bankroll €{point.y.toFixed(2)}
                </title>
              </circle>
            </g>
          ))}

          {points.map((point) => (
            <text
              key={`x-${point.x}`}
              x={point.px}
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
            >
              {point.x}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
