"use client";

import { useState } from "react";

const SPORTS = {
  jalkapallo: {
    label: "⚽ Jalkapallo",
    leagues: "Veikkausliiga, Champions League, Premier League, Bundesliga, La Liga, Serie A",
    factors: [
      "Kotikenttäetu",
      "Avainpelaaja loukkaantunut",
      "Derby-ottelu",
      "Eurooppa rasittaa",
      "Maalivahti vireessä",
      "Uusi valmentaja",
      "Sarjakärki vastaan",
      "Puolustus tiukka"
    ],
    drawPossible: true
  },
  jaakiekko: {
    label: "🏒 Jääkiekko",
    leagues: "SM-liiga, KHL, NHL",
    factors: [
      "Kotijää etu",
      "Maalivahti poissa",
      "Back-to-back",
      "Ylivoima korkea",
      "Playoff-paine",
      "Pitkä matka",
      "Viime 3 voitettu",
      "Nopeat hyökkääjät"
    ],
    drawPossible: false
  },
  koripallo: {
    label: "🏀 Koripallo",
    leagues: "Korisliiga, NBA, Euroleague",
    factors: [
      "Kotisali tukee",
      "Tähti loukkaantunut",
      "3-pisteet uppoaa",
      "Puolustus heikko",
      "Nopea tempo",
      "Väsynyt penkki",
      "Huikea vaihtopelaaja",
      "Yliajalle viimeksi"
    ],
    drawPossible: false
  }
};

const today = new Date();
const dateShort = today.toLocaleDateString("fi-FI", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const dateLong = today.toLocaleDateString("fi-FI", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

const C = {
  bg: "#07070f",
  s1: "#0f0f1c",
  s2: "#161625",
  bd: "#222238",
  ac: "#00e5ff",
  ac2: "#ff3d6e",
  ac3: "#ffe600",
  gr: "#00ff88",
  mu: "#4a4a6a",
  tx: "#e0e0f0"
};

const mono = "'JetBrains Mono', monospace";
const disp = "'Bebas Neue', Impact, sans-serif";

export default function App() {
  const [sport, setSport] = useState("jalkapallo");
  const [games, setGames] = useState([]);
  const [sel, setSel] = useState(null);
  const [factors, setFactors] = useState(new Set());
  const [fetchSt, setFetchSt] = useState("idle");
  const [predSt, setPredSt] = useState("idle");
  const [result, setResult] = useState(null);
  const [loadMsg, setLoadMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const changeSport = (s) => {
    setSport(s);
    setGames([]);
    setSel(null);
    setFactors(new Set());
    setFetchSt("idle");
    setPredSt("idle");
    setResult(null);
    setErrMsg("");
  };

  const toggleF = (f) =>
    setFactors((p) => {
      const n = new Set(p);
      n.has(f) ? n.delete(f) : n.add(f);
      return n;
    });

  const fetchGames = async () => {
    setFetchSt("loading");
    setGames([]);
    setSel(null);
    setResult(null);
    setErrMsg("");

    try {
      const res = await fetch(`/api/games?sport=${sport}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Pelien haku epäonnistui");

      setGames(data.games || []);
      setFetchSt("done");
    } catch (e) {
      setErrMsg(e.message);
      setFetchSt("error");
    }
  };

  const predict = async () => {
    if (!sel) return;

    setPredSt("loading");
    setResult(null);
    setErrMsg("");

    const msgs = [
      "Analysoidaan muotoa…",
      "Haetaan tilastoja…",
      "Lasketaan todennäköisyyksiä…",
      "Rakennetaan ennustetta…"
    ];

    let mi = 0;
    setLoadMsg(msgs[0]);
    const iv = setInterval(() => setLoadMsg(msgs[++mi % msgs.length]), 900);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, game: sel, selectedFactors: Array.from(factors) })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ennustus epäonnistui");

      setResult(data);
      setPredSt("done");
    } catch (e) {
      setErrMsg(e.message);
      setPredSt("error");
    } finally {
      clearInterval(iv);
    }
  };

  const sc = (v) => (v >= 7 ? C.gr : v >= 5 ? C.ac3 : C.ac2);
  const cf = (c) => ({ KORKEA: C.gr, KOHTALAINEN: C.ac3, MATALA: C.ac2 }[c] || C.ac);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.tx, fontFamily: "'DM Sans', sans-serif", overflowY: "auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes bar { to { width: 100% } }
        * { box-sizing: border-box; margin: 0; padding: 0 }
      `}</style>

      <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${C.bd}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 3, color: C.mu, marginBottom: 2 }}>AI-POWERED SPORTS ANALYTICS</div>
          <div style={{ fontFamily: disp, fontSize: 38, letterSpacing: 4, background: `linear-gradient(135deg,${C.ac},${C.ac2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
            SCORECASTER
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: C.ac, letterSpacing: 1, marginBottom: 3, textTransform: "uppercase" }}>{dateLong}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", fontFamily: mono, fontSize: 8, color: C.gr }}>
            <div style={{ width: 6, height: 6, background: C.gr, borderRadius: "50%", boxShadow: `0 0 8px ${C.gr}` }} />
            LIVE
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 14px 60px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {Object.entries(SPORTS).map(([k, sp]) => (
            <button
              key={k}
              onClick={() => changeSport(k)}
              style={{
                padding: "8px 15px",
                border: `1px solid ${sport === k ? C.ac : C.bd}`,
                background: sport === k ? C.ac : C.s1,
                color: sport === k ? C.bg : C.mu,
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: mono,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: sport === k ? 700 : 400
              }}
            >
              {sp.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: disp, fontSize: 16, letterSpacing: 3, color: C.ac3 }}>TÄMÄN PÄIVÄN PELIT</div>
            <button
              onClick={fetchGames}
              disabled={fetchSt === "loading"}
              style={{
                padding: "7px 14px",
                background: "transparent",
                border: `1px solid ${C.ac3}`,
                color: C.ac3,
                borderRadius: 4,
                fontFamily: mono,
                fontSize: 9,
                letterSpacing: 2,
                cursor: fetchSt === "loading" ? "not-allowed" : "pointer",
                opacity: fetchSt === "loading" ? 0.5 : 1
              }}
            >
              {fetchSt === "loading" ? "⟳ HAETAAN…" : "🔍 HAE PÄIVÄN PELIT"}
            </button>
          </div>

          {fetchSt === "idle" && (
            <div style={{ padding: 18, textAlign: "center", color: C.mu, fontFamily: mono, fontSize: 9, border: `1px dashed ${C.bd}`, borderRadius: 8 }}>
              Paina nappia hakiaksesi tämän päivän ottelut
            </div>
          )}

          {fetchSt === "loading" && (
            <div style={{ padding: 18, textAlign: "center", fontFamily: mono, fontSize: 9, color: C.mu }}>
              Haetaan otteluita…
              <div style={{ width: "100%", height: 2, background: C.bd, borderRadius: 2, overflow: "hidden", margin: "10px 0" }}>
                <div style={{ height: "100%", background: `linear-gradient(90deg,${C.ac},${C.ac2})`, animation: "bar 3s ease forwards", width: "0%" }} />
              </div>
            </div>
          )}

          {fetchSt === "error" && (
            <div style={{ padding: 14, color: C.ac2, fontFamily: mono, fontSize: 9, border: `1px dashed ${C.ac2}55`, borderRadius: 8, textAlign: "center" }}>
              Virhe: {errMsg}
            </div>
          )}

          {fetchSt === "done" && games.length === 0 && (
            <div style={{ padding: 18, textAlign: "center", color: C.mu, fontFamily: mono, fontSize: 9, border: `1px dashed ${C.bd}`, borderRadius: 8 }}>
              Ei otteluita tänään. Kokeile toista lajia.
            </div>
          )}

          {fetchSt === "done" && games.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 8 }}>
              {games.map((g, i) => (
                <div
                  key={i}
                  onClick={() => setSel(g)}
                  style={{
                    background: sel === g ? `${C.ac}0f` : C.s1,
                    border: `1px solid ${sel === g ? C.ac : C.bd}`,
                    borderLeft: `3px solid ${sel === g ? C.ac : C.bd}`,
                    borderRadius: 8,
                    padding: "11px 13px",
                    cursor: "pointer",
                    position: "relative"
                  }}
                >
                  <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 2, color: C.mu, marginBottom: 5 }}>
                    {g.league}{g.context ? " · " + g.context : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{g.home}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: C.mu }}>vs</div>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: "right" }}>{g.away}</div>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: C.ac }}>{g.time || "TBA"}</div>
                  {sel === g && (
                    <div style={{ position: "absolute", top: 7, right: 7, width: 15, height: 15, background: C.ac, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.bg, fontWeight: 700 }}>
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {sel && (
          <div style={{ background: C.s1, border: `1px solid ${C.ac}`, borderRadius: 8, padding: "12px 15px", marginBottom: 14 }}>
            <div style={{ fontFamily: mono, fontSize: 8, color: C.ac, letterSpacing: 3, marginBottom: 4 }}>✓ VALITTU OTTELU</div>
            <div style={{ fontFamily: disp, fontSize: 20, letterSpacing: 2, marginBottom: 2 }}>
              {sel.home} — {sel.away}
            </div>
            <div style={{ fontSize: 11, color: C.mu }}>{sel.league} · {sel.time || "TBA"}</div>
          </div>
        )}

        <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "13px 15px", marginBottom: 14 }}>
          <div style={{ fontFamily: disp, fontSize: 13, letterSpacing: 3, color: C.ac3, marginBottom: 9 }}>VAIKUTTAVAT TEKIJÄT</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 6 }}>
            {SPORTS[sport].factors.map((f) => (
              <div
                key={f}
                onClick={() => toggleF(f)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 9px",
                  border: `1px solid ${factors.has(f) ? C.ac3 : C.bd}`,
                  background: factors.has(f) ? `${C.ac3}08` : C.s2,
                  borderRadius: 5,
                  cursor: "pointer"
                }}
              >
                <div style={{ width: 12, height: 12, border: `2px solid ${factors.has(f) ? C.ac3 : C.bd}`, borderRadius: 2, flexShrink: 0, background: factors.has(f) ? C.ac3 : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.bg, fontWeight: 700 }}>
                  {factors.has(f) ? "✓" : ""}
                </div>
                <div style={{ fontSize: 11 }}>{f}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={predict}
          disabled={!sel || predSt === "loading"}
          style={{
            width: "100%",
            padding: 13,
            background: !sel || predSt === "loading" ? C.s1 : `linear-gradient(135deg,${C.ac},#0080ff)`,
            color: !sel || predSt === "loading" ? C.mu : C.bg,
            border: `1px solid ${!sel || predSt === "loading" ? C.bd : "transparent"}`,
            borderRadius: 8,
            fontFamily: disp,
            fontSize: 18,
            letterSpacing: 4,
            cursor: !sel || predSt === "loading" ? "not-allowed" : "pointer",
            marginBottom: 16
          }}
        >
          {predSt === "loading" ? `⟳ ${loadMsg}` : "⚡ ANALYSOI JA ENNUSTA"}
        </button>

        {predSt === "error" && (
          <div style={{ padding: 12, color: C.ac2, fontFamily: mono, fontSize: 9, marginBottom: 14, border: `1px dashed ${C.ac2}55`, borderRadius: 8 }}>
            Virhe: {errMsg}
          </div>
        )}

        {result && predSt === "done" && (
          <div>
            <div style={{ fontFamily: disp, fontSize: 19, letterSpacing: 4, color: C.ac3, marginBottom: 12 }}>📊 ENNUSTUSTULOS</div>

            <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "20px 14px", textAlign: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: disp, fontSize: 15, letterSpacing: 2, marginBottom: 3 }}>{sel.home}</div>
                  <div style={{ fontFamily: disp, fontSize: 50, lineHeight: 1, color: C.ac }}>{result.homeScore}</div>
                </div>
                <div style={{ fontFamily: disp, fontSize: 15, color: C.mu }}>VS</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: disp, fontSize: 15, letterSpacing: 2, marginBottom: 3 }}>{sel.away}</div>
                  <div style={{ fontFamily: disp, fontSize: 50, lineHeight: 1, color: C.ac }}>{result.awayScore}</div>
                </div>
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: C.mu, letterSpacing: 2 }}>
                LUOTTAMUS: {result.confidence} · {result.keyFactor}
              </div>
            </div>

            <div style={{ background: C.s1, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "13px 15px", marginBottom: 10 }}>
              <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 3, color: C.mu, textTransform: "uppercase", marginBottom: 9 }}>VOITTOTODENNÄKÖISYYDET</div>
              {[
                { l: sel.home, p: result.homeWinProb, c: C.ac },
                ...(SPORTS[sport].drawPossible ? [{ l: "Tasapeli", p: result.drawProb || 0, c: C.mu }] : []),
                { l: sel.away, p: result.awayWinProb, c: C.ac2 }
              ].map(({ l, p, c }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontFamily: mono, fontSize: 10, width: 85, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</div>
                  <div style={{ flex: 1, height: 20, background: C.s2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(p, 3)}%`, background: c, display: "flex", alignItems: "center", padding: "0 6px", fontFamily: mono, fontSize: 9, fontWeight: 700, color: C.bg }}>
                      {p}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
