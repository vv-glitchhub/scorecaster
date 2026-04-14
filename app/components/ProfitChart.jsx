"use client";

import { useMemo } from "react";

export default function ProfitChart({ bets = [] }) {
  const chartData = useMemo(() => {
    const settled = bets
      .filter((bet) => bet.result !== "pending")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let cumulative = 0;

    return settled.map((bet, index) => {
      cumulative += Number(bet.profit || 0);

      return {
        x: index + 1,
        y: Number(cumulative.toFixed(2)),
        result: bet.result,
        label: `${bet.match} • ${bet.selection}`,
      };
    });
  }, [bets]);

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
        No settled bets yet.
      </div>
    );
  }

  const values = chartData.map((point) => point.y);
  const minY = Math.min(...values, 0);
  const maxY = Math.max(...values, 0);
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
  const zeroY =
    height - padding - ((0 - minY) / range) * (height - padding * 2);

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
        <span>Cumulative profit</span>
        <span>
          Min €{minY.toFixed(2)} / Max €{maxY.toFixed(2)}
        </span>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", minWidth: "680px", height: "240px" }}
        >
          <line
            x1={padding}
            x2={width - padding}
            y1={zeroY}
            y2={zeroY}
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="6 6"
          />

          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            points={polylinePoints}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point) => (
            <g key={point.x}>
              <circle
                cx={point.px}
                cy={point.py}
                r="4"
                fill={point.y >= 0 ? "#10b981" : "#ef4444"}
              >
                <title>
                  {point.label} | Bet #{point.x} | Profit €{point.y.toFixed(2)}
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
