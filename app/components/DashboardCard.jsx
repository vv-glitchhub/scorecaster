export default function DashboardCard({ title, description, children }) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 30,
        background:
          "linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))",
        padding: 24,
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(34px, 7vw, 54px)",
            lineHeight: 0.95,
            fontWeight: 950,
          }}
        >
          {title}
        </h2>

        {description ? (
          <p
            style={{
              color: "#94a3b8",
              fontSize: 18,
              lineHeight: 1.6,
              fontWeight: 800,
              marginTop: 18,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>

      {children ? <div style={{ marginTop: 20 }}>{children}</div> : null}
    </section>
  );
}
