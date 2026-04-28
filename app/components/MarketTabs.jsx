import { getDictionary } from "@/lib/i18n";

export default function MarketTabs({ market, onChange, lang = "en" }) {
  const t = getDictionary(lang);

  const tabs = [
    { key: "h2h", label: t.h2h },
    { key: "totals", label: t.totals },
    { key: "spreads", label: t.handicap },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const active = market === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              border: active
                ? "1px solid rgba(16,185,129,0.7)"
                : "1px solid rgba(255,255,255,0.12)",
              background: active
                ? "rgba(16,185,129,0.14)"
                : "rgba(255,255,255,0.06)",
              color: active ? "#6ee7b7" : "#ffffff",
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
