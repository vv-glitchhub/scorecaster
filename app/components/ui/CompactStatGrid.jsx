export default function CompactStatGrid({ items = [] }) {
  return (
    <div className="compact-stat-grid">
      {items.map((item) => (
        <div className="compact-stat" key={item.label}>
          <div className="compact-stat-label">{item.label}</div>
          <div className={item.good ? "compact-stat-value good" : "compact-stat-value"}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
