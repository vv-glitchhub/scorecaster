"use client";

const tabs = [
  { key: "h2h", label: "H2H" },
  { key: "totals", label: "Totals" },
  { key: "spreads", label: "Handicap" },
];

export default function MarketTabs({ market, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const active = market === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
            style={{
              border: active
                ? "1px solid rgba(16,185,129,0.7)"
                : "1px solid rgba(255,255,255,0.1)",
              background: active
                ? "rgba(16,185,129,0.16)"
                : "rgba(255,255,255,0.05)",
              color: active ? "#6ee7b7" : "#fff",
              borderRadius: "999px",
              padding: "10px 14px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
