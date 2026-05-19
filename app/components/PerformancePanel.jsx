"use client";

import { getBetHistoryStats, getBetProfit } from "@/lib/bet-history-store";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "€0.00";
  return `€${n.toFixed(2)}`;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function card(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(2,6,23,0.72)",
    ...extra,
  };
}

export default function PerformancePanel({ bets = [] }) {
  const stats = getBetHistoryStats(bets);

  const byBookmaker = {};
  const byMarket = {};

  for (const bet of bets) {
    const profit = getBetProfit(bet);
    const stake = Number(bet.stake || 0);

    if (!byBookmaker[bet.bookmaker]) {
      byBookmaker[bet.bookmaker] = { stake: 0, profit: 0, count: 0 };
    }

    byBookmaker[bet.bookmaker].stake += stake;
    byBookmaker[bet.bookmaker].profit += profit;
    byBookmaker[bet.bookmaker].count += 1;

    if (!byMarket[bet.market]) {
      byMarket[bet.market] = { stake: 0, profit: 0, count: 0 };
    }

    byMarket[bet.market].stake += stake;
    byMarket[bet.market].profit += profit;
    byMarket[bet.market].count += 1;
  }

  return (
    <section style={card()}>
      <h2 style={{ marginTop: 0 }}>Performance dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat label="Profit" value={money(stats.profit)} good={stats.profit >= 0} />
        <Stat label="ROI" value={pct(stats.roi)} good={stats.roi >= 0} />
        <Stat label="Winrate" value={pct(stats.hitRate)} />
        <Stat label="Avg odds" value={stats.averageOdds.toFixed(2)} />
        <Stat label="Settled" value={stats.settledBets} />
        <Stat label="Open" value={stats.openBets} />
      </div>

      <h3>Bookmaker performance</h3>
      <Breakdown data={byBookmaker} />

      <h3>Market performance</h3>
      <Breakdown data={byMarket} />
    </section>
  );
}

function Stat({ label, value, good = false }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 12,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{label}</div>
      <div style={{ color: good ? "#86efac" : "#fff", fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function Breakdown({ data }) {
  const rows = Object.entries(data || {});

  if (!rows.length) {
    return <div style={{ color: "#94a3b8" }}>Ei dataa vielä.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map(([name, item]) => {
        const roi = item.stake > 0 ? item.profit / item.stake : 0;

        return (
          <div
            key={name}
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <b>{name}</b>
            <div style={{ color: "#94a3b8", marginTop: 4 }}>
              Vedot {item.count} · Profit {money(item.profit)} · ROI {pct(roi)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
