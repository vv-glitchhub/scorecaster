export default function DashboardGrid({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 18,
        alignItems: "stretch",
      }}
    >
      {children}
    </div>
  );
}
