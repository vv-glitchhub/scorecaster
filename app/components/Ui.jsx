export function PageShell({ children }) {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg,#020617,#071631)",
      color: "white",
      padding: "16px 16px 120px",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
        {children}
      </div>
    </main>
  );
}

export function Hero({ title, subtitle, children }) {
  return (
    <section style={cardStyle({ padding: "32px 22px" })}>
      <h1 style={{
        margin: 0,
        fontSize: "clamp(44px,10vw,86px)",
        lineHeight: 0.95,
        fontWeight: 950,
      }}>
        {title}
      </h1>

      {subtitle ? (
        <p style={{
          color: "#94a3b8",
          fontSize: 18,
          lineHeight: 1.5,
          fontWeight: 800,
          margin: "14px 0 0",
        }}>
          {subtitle}
        </p>
      ) : null}

      {children ? <div style={{ marginTop: 22 }}>{children}</div> : null}
    </section>
  );
}

export function Card({ children, style = {} }) {
  return <section style={cardStyle(style)}>{children}</section>;
}

export function SectionTitle({ children }) {
  return (
    <h2 style={{
      margin: "0 0 18px",
      fontSize: "clamp(34px,8vw,64px)",
      lineHeight: 0.95,
      fontWeight: 950,
    }}>
      {children}
    </h2>
  );
}

export function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active
          ? "1px solid rgba(34,197,94,0.75)"
          : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
        color: "white",
        borderRadius: 999,
        padding: "12px 18px",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        border: "1px solid rgba(34,197,94,0.75)",
        background: "rgba(34,197,94,0.18)",
        color: "white",
        borderRadius: 22,
        padding: 18,
        fontSize: 18,
        fontWeight: 950,
      }}
    >
      {children}
    </button>
  );
}

export function Row({ children }) {
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
    }}>
      {children}
    </div>
  );
}

function cardStyle(extra = {}) {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 30,
    background: "linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))",
    padding: 22,
    boxShadow: "0 20px 70px rgba(0,0,0,0.28)",
    ...extra,
  };
}
