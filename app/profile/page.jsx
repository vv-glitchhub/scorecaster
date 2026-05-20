"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { fetchCloudBets } from "@/lib/supabase-bets";

export default function ProfilePage() {
  const supabase = createSupabaseBrowserClient();

  const [user, setUser] = useState(null);
  const [bets, setBets] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUser(user);

    const cloudBets = await fetchCloudBets();
    setBets(cloudBets);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main style={{ padding: 24, color: "#fff", maxWidth: 900, margin: "0 auto" }}>
      <section style={card()}>
        <h1 style={{ marginTop: 0 }}>Profiili</h1>

        <div style={{ color: "#94a3b8" }}>{user?.email}</div>

        <button onClick={signOut} style={buttonStyle(false)}>
          Kirjaudu ulos
        </button>
      </section>

      <section style={{ ...card(), marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Cloud bet history</h2>

        {bets.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Ei cloud-vetoja vielä.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {bets.map((bet) => (
              <div key={bet.id} style={card({ background: "rgba(255,255,255,0.04)" })}>
                <b>{bet.label}</b>

                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {bet.home_team} vs {bet.away_team}
                </div>

                <div style={{ marginTop: 8 }}>
                  {bet.market} · {bet.bookmaker}
                </div>

                <div style={{ marginTop: 4 }}>
                  Odds {bet.odds} · Panos €{Number(bet.stake || 0).toFixed(2)}
                </div>

                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {bet.status} / {bet.result}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
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

function buttonStyle(primary) {
  return {
    width: "100%",
    marginTop: 16,
    border: primary
      ? "1px solid rgba(34,197,94,0.55)"
      : "1px solid rgba(255,255,255,0.14)",
    background: primary ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 14,
    padding: 14,
    fontWeight: 900,
    cursor: "pointer",
  };
}
