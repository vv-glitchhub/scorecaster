"use client";

export default function CustomRekkaBuilder({ picks = [], onRemove, onClear }) {
  const totalOdds = picks.reduce((acc, pick) => acc * Number(pick.odds || 1), 1);

  return (
    <section style={card()}>
      <h2 style={title()}>Oma rekka</h2>

      {picks.length === 0 ? (
        <p style={muted()}>
          Ei kohteita rekassa. Lisää kohteita painamalla “Lisää rekkaan”.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {picks.map((pick) => (
              <div key={pick.id} style={pickCard()}>
                <div style={match()}>
                  {pick.match.home_team} vs {pick.match.away_team}
                </div>

                <div style={green()}>
                  {pick.selection} · {pick.odds} · {pick.bookmaker}
                </div>

                <button onClick={() => onRemove(pick.id)} style={removeBtn()}>
                  Poista
                </button>
              </div>
            ))}
          </div>

          <div style={summary()}>
            <div style={muted()}>Kokonaiskerroin</div>
            <div style={big()}>{totalOdds.toFixed(2)}</div>
            <div style={muted()}>Kohteita rekassa: {picks.length}</div>
          </div>

          <button onClick={onClear} style={clearBtn()}>
            Tyhjennä rekka
          </button>
        </>
      )}
    </section>
  );
}

function card() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 30,
    background: "linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))",
    padding: 24,
  };
}

function title() {
  return {
    margin: "0 0 18px",
    fontSize: "clamp(36px,8vw,64px)",
    fontWeight: 950,
  };
}

function muted() {
  return {
    color: "#94a3b8",
    fontWeight: 800,
    lineHeight: 1.5,
  };
}

function pickCard() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(255,255,255,0.05)",
  };
}

function match() {
  return {
    fontSize: 19,
    fontWeight: 950,
    lineHeight: 1.25,
  };
}

function green() {
  return {
    color: "#86efac",
    fontWeight: 950,
    marginTop: 8,
  };
}

function summary() {
  return {
    marginTop: 18,
    border: "1px solid rgba(34,197,94,0.35)",
    borderRadius: 24,
    padding: 18,
    background: "rgba(34,197,94,0.10)",
  };
}

function big() {
  return {
    fontSize: 56,
    fontWeight: 950,
    marginTop: 4,
  };
}

function removeBtn() {
  return {
    marginTop: 12,
    border: "1px solid rgba(239,68,68,0.45)",
    background: "rgba(239,68,68,0.12)",
    color: "#fecaca",
    borderRadius: 16,
    padding: "10px 14px",
    fontWeight: 900,
  };
}

function clearBtn() {
  return {
    marginTop: 16,
    width: "100%",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    borderRadius: 18,
    padding: 16,
    fontWeight: 950,
  };
}
