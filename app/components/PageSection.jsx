export default function PageSection({
  title,
  description,
  rightSlot = null,
  children,
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "24px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(24px, 4vw, 32px)",
              lineHeight: 1.1,
              color: "#fff",
            }}
          >
            {title}
          </h2>

          {description ? (
            <p
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(14px, 2vw, 16px)",
                lineHeight: 1.5,
                color: "#94a3b8",
              }}
            >
              {description}
            </p>
          ) : null}
        </div>

        {rightSlot ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flex: "0 1 auto",
            }}
          >
            {rightSlot}
          </div>
        ) : null}
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "20px",
        }}
      >
        {children}
      </div>
    </section>
  );
}
