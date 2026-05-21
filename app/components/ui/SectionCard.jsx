export default function SectionCard({ children, title, subtitle, style = {} }) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 24,
        padding: 18,
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.92))",
        boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
        ...style,
      }}
    >
      {title ? (
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 28 }}>
            {title}
          </h2>
          {subtitle ? (
            <p style={{ color: "#94a3b8", margin: "8px 0 0", lineHeight: 1.5 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
