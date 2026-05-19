"use client";

import { analyzeRisk } from "@/lib/risk-manager";

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

export default function RiskManagerPanel({ bankroll, betSlip, betHistory }) {
  const risk = analyzeRisk({ bankroll, betSlip, betHistory });

  const color =
    risk.level === "OK"
      ? "#86efac"
      : risk.level === "VARO"
      ? "#fde68a"
      : "#fca5a5";

  return (
    <section
      style={{
        border: `1px solid ${color}`,
        borderRadius: 22,
        padding: 18,
        background: "rgba(2,6,23,0.72)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Risk Manager</h2>

      <div style={{ color, fontWeight: 900, fontSize: 22 }}>
        {risk.level}
      </div>

      <p style={{ color: "#cbd5e1", lineHeight: 1.5, fontWeight: 800 }}>
        {risk.message}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat label="Pelikassa" value={money(risk.bankroll)} />
        <Stat label="Riskissä" value={money(risk.totalExposure)} good={risk.level === "OK"} />
        <Stat label="Altistus" value={pct(risk.exposurePct)} good={risk.level === "OK"} />
        <Stat label="Max single" value={money(risk.maxSingleStake)} />
        <Stat label="Päiväraja" value={money(risk.dailyLimit)} />
        <Stat label="Avoimet vedot" value={money(risk.openStake)} />
      </div>

      {risk.bookmakerExposure.length ? (
        <div style={{ marginTop: 16 }}>
          <h3>Altistus bookkereittain</h3>

          <div style={{ display: "grid", gap: 8 }}>
            {risk.bookmakerExposure.map((item) => (
              <div
                key={item.bookmaker}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <b>{item.bookmaker}</b>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {money(item.stake)} · {pct(item.pct)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
        {label}
      </div>
      <div style={{ color: good ? "#86efac" : "#fff", fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}
