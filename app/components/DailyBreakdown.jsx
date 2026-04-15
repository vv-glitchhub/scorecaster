"use client";

import { useMemo } from "react";

function formatDate(dateString, lang) {
  try {
    return new Date(dateString).toLocaleDateString(
      lang === "fi" ? "fi-FI" : "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  } catch {
    return dateString;
  }
}

export default function DailyBreakdown({ bets = [], lang = "en" }) {
  const rows = useMemo(() => {
    const settled = bets.filter((bet) => bet.result !== "pending");

    const grouped = new Map();

    for (const bet of settled) {
      const key = new Date(bet.createdAt || Date.now()).toISOString().slice(0, 10);

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          staked: 0,
          profit: 0,
          bets: 0,
          wins: 0,
          losses: 0,
          voids: 0,
        });
      }

      const row = grouped.get(key);
      row.staked += Number(bet.stake || 0);
      row.profit += Number(bet.profit || 0);
      row.bets += 1;

      if (bet.result === "win") row.wins += 1;
      if (bet.result === "lose") row.losses += 1;
      if (bet.result === "void") row.voids += 1;
    }

    return [...grouped.values()]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((row) => ({
        ...row,
        roi: row.staked > 0 ? (row.profit / row.staked) * 100 : 0,
      }));
  }, [bets]);

  const emptyText =
    lang === "fi"
      ? "Ei ratkaistuja vetoja päivätason erittelyyn."
      : "No settled bets for daily breakdown.";

  const headers =
    lang === "fi"
      ? ["Päivä", "Vedot", "Panostettu", "Voitto", "ROI", "W/L/V"]
      : ["Date", "Bets", "Staked", "Profit", "ROI", "W/L/V"];

  if (rows.length === 0) {
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

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.2)",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              {headers.map((header) => (
                <th
                  key={header}
                  style={{
                    textAlign: "left",
                    padding: "14px 16px",
                    fontSize: "12px",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td style={cellStyle()}>{formatDate(row.date, lang)}</td>
                <td style={cellStyle()}>{row.bets}</td>
                <td style={cellStyle()}>€{row.staked.toFixed(2)}</td>
                <td
                  style={{
                    ...cellStyle(),
                    color: row.profit > 0 ? "#10b981" : row.profit < 0 ? "#ef4444" : "#cbd5e1",
                    fontWeight: 700,
                  }}
                >
                  €{row.profit.toFixed(2)}
                </td>
                <td
                  style={{
                    ...cellStyle(),
                    color: row.roi > 0 ? "#10b981" : row.roi < 0 ? "#ef4444" : "#cbd5e1",
                    fontWeight: 700,
                  }}
                >
                  {row.roi.toFixed(2)}%
                </td>
                <td style={cellStyle()}>
                  {row.wins}/{row.losses}/{row.voids}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellStyle() {
  return {
    padding: "14px 16px",
    fontSize: "14px",
    color: "#e2e8f0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };
}
