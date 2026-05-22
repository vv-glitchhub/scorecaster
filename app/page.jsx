import HomeDashboardClient from "@/app/components/HomeDashboardClient";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#020617,#071631)",
        color: "white",
        padding: "16px 16px 120px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 32,
            background:
              "linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))",
            padding: "34px 24px",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(46px,10vw,88px)",
              lineHeight: 0.95,
              fontWeight: 950,
            }}
          >
            Scorecaster
          </h1>

          <p
            style={{
              color: "#94a3b8",
              fontSize: 20,
              lineHeight: 1.6,
              fontWeight: 800,
              marginTop: 18,
            }}
          >
            Yksinkertainen vedonlyöntityöpöytä, parhaat kertoimet,
            bookkerivertailu ja simulaattori.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 26,
            }}
          >
            <a href="/betting" style={primary()}>
              Avaa vedonlyöntityöpöytä
            </a>

            <a href="/simulator" style={secondary()}>
              Avaa simulaattori
            </a>
          </div>
        </section>

        <section
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 30,
            background:
              "linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))",
            padding: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(34px,7vw,56px)",
              fontWeight: 950,
            }}
          >
            Vastuuvapaus
          </h2>

          <p
            style={{
              color: "#94a3b8",
              fontSize: 18,
              lineHeight: 1.8,
              fontWeight: 800,
              marginTop: 18,
            }}
          >
            Scorecaster on vedonlyönnin analyysi- ja seurantatyökalu.
            Sovellus ei takaa voitollista vedonlyöntiä eikä anna
            taloudellista tai juridista neuvontaa. Kaikki
            vedonlyöntipäätökset tehdään käyttäjän omalla vastuulla.
          </p>
        </section>

        <HomeDashboardClient />
      </div>
    </main>
  );
}

function primary() {
  return {
    textDecoration: "none",
    color: "white",
    border: "1px solid rgba(34,197,94,0.75)",
    background: "rgba(34,197,94,0.18)",
    borderRadius: 20,
    padding: "16px 20px",
    fontWeight: 950,
  };
}

function secondary() {
  return {
    textDecoration: "none",
    color: "white",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "16px 20px",
    fontWeight: 950,
  };
}
