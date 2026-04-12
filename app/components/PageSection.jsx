export default function PageSection({
  title,
  description,
  rightSlot,
  children,
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "24px",
        padding: "24px",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          paddingBottom: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "22px" }}>{title}</h2>
          {description ? (
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#94a3b8" }}>
              {description}
            </p>
          ) : null}
        </div>

        {rightSlot ? <div>{rightSlot}</div> : null}
      </div>

      <div>{children}</div>
    </section>
  );
}
