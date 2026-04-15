"use client";

import { useFavoritesStore } from "@/lib/favorites-store";

export default function FavoritesPanel({ lang = "en" }) {
  const { favorites, toggleFavorite } = useFavoritesStore();

  const title = lang === "fi" ? "Tallennetut kohteet" : "Saved Picks";
  const emptyText =
    lang === "fi"
      ? "Tallennettuja kohteita ei ole vielä."
      : "No saved picks yet.";
  const removeText = lang === "fi" ? "Poista" : "Remove";

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>{title}</p>

      {favorites.length === 0 ? (
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
      ) : (
        favorites.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "16px",
              padding: "14px",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>{item.match}</p>
            <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontSize: "14px" }}>
              {item.selection}
            </p>
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: "13px" }}>
              Odds {item.odds}
            </p>

            <button
              type="button"
              onClick={() => toggleFavorite(item)}
              style={{
                marginTop: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {removeText}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
