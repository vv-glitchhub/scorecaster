export default function PageSection({
  title,
  description,
  subtitle,
  eyebrow,
  rightSlot,
  children,
}) {
  const text = description || subtitle || "";

  return (
    <section
      style={{
        display: "grid",
        gap: "18px",
      }}
    >
      {(eyebrow || title || text || rightSlot) ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px",
            padding: "20px",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {(eyebrow || title || text || rightSlot) ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                {eyebrow ? (
                  <div
                    style={{
                      color: "#86efac",
                      fontWeight: 800,
                      letterSpacing: "0.16em",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      marginBottom: title ? "10px" : 0,
                    }}
                  >
                    {eyebrow}
                  </div>
                ) : null}

                {title ? (
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "clamp(28px, 6vw, 44px)",
                      lineHeight: 1.05,
                      fontWeight: 900,
                      color: "#ffffff",
                    }}
                  >
                    {title}
                  </h2>
                ) : null}

                {text ? (
                  <p
                    style={{
                      margin: title ? "14px 0 0" : 0,
                      fontSize: "clamp(15px, 2.8vw, 18px)",
                      lineHeight: 1.6,
                      color: "#94a3b8",
                      maxWidth: "780px",
                    }}
                  >
                    {text}
                  </p>
                ) : null}
              </div>

              {rightSlot ? (
                <div style={{ flexShrink: 0 }}>{rightSlot}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "16px",
        }}
      >
        {children}
      </div>
    </section>
  );
}
