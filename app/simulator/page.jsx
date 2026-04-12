import PageSection from "@/app/components/PageSection";

export default function SimulatorPage() {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <section
        style={{
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "24px",
          padding: "32px",
        }}
      >
        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#67e8f9",
            fontWeight: 700,
          }}
        >
          Simulator Workspace
        </p>
        <h1 style={{ margin: 0, fontSize: "36px", lineHeight: 1.1 }}>
          Dedicated area for tournament and season simulations.
        </h1>
        <p style={{ marginTop: "16px", color: "#cbd5e1" }}>
          Tällä sivulla pidetään kaikki simulaatiologiikka erillään bettingistä,
          jotta vedonlyöntisivu pysyy nopeana ja selkeänä.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gap: "24px",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <PageSection
          title="Simulation Setup"
          description="Competition, model and iteration settings."
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Competition</p>
              <p style={{ margin: "8px 0 0", fontWeight: 700 }}>World Cup / League</p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Iterations</p>
              <p style={{ margin: "8px 0 0", fontWeight: 700 }}>10,000</p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>Mode</p>
              <p style={{ margin: "8px 0 0", fontWeight: 700 }}>Monte Carlo</p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Outcome Preview"
          description="Example result cards for future simulation output."
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>Team A</p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                Win title: 24.5%
              </p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>Team B</p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                Reach final: 38.2%
              </p>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "16px",
                padding: "16px",
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>Team C</p>
              <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
                Top 4: 51.7%
              </p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Planned Extensions"
          description="Features that belong here, not on the betting page."
        >
          <div style={{ display: "grid", gap: "10px", fontSize: "14px", color: "#cbd5e1" }}>
            <div>• tournament brackets</div>
            <div>• season table simulations</div>
            <div>• top 4 / top 8 probabilities</div>
            <div>• final and champion probabilities</div>
            <div>• scenario comparison</div>
          </div>
        </PageSection>
      </div>
    </div>
  );
}
