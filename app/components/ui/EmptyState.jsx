export default function EmptyState({ title, text, action }) {
  return (
    <div
      style={{
        border: "1px dashed rgba(255,255,255,0.18)",
        borderRadius: 20,
        padding: 18,
        background: "rgba(255,255,255,0.035)",
        color: "#fff",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#94a3b8", lineHeight: 1.5 }}>{text}</p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}
