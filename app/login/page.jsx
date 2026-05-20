"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signUp() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Tili luotu. Tarkista sähköposti jos vahvistus on päällä.");
  }

  async function signIn() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    window.location.href = "/profile";
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
  }

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto", color: "#fff" }}>
      <section
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 22,
          padding: 20,
          background: "rgba(2,6,23,0.72)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Kirjaudu Scorecasteriin</h1>

        <p style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Kirjautuminen mahdollistaa cloud-historian, pelikassan ja profiilin.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Sähköposti"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Salasana"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button onClick={signIn} style={buttonStyle(true)}>
            Kirjaudu
          </button>

          <button onClick={signUp} style={buttonStyle(false)}>
            Luo tili
          </button>

          <button onClick={signInWithGoogle} style={buttonStyle(false)}>
            Kirjaudu Googlella
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 14, color: "#fde68a", fontWeight: 900 }}>
            {message}
          </div>
        ) : null}
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  fontWeight: 800,
};

function buttonStyle(primary) {
  return {
    width: "100%",
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
