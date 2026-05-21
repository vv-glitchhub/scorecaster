"use client";

export default function StickyLiveControls({
  isLiveMode,
  autoRefresh,
  loading,
  onToggleLive,
  onToggleRefresh,
  onRefresh,
}) {
  return (
    <div className="sticky-live-controls">
      <button className={isLiveMode ? "control-btn active red" : "control-btn"} onClick={onToggleLive}>
        {isLiveMode ? "LIVE ON" : "LIVE"}
      </button>

      <button className={autoRefresh ? "control-btn active" : "control-btn"} onClick={onToggleRefresh}>
        {autoRefresh ? "AUTO ON" : "AUTO"}
      </button>

      <button className="control-btn primary" onClick={onRefresh} disabled={loading}>
        {loading ? "Haetaan..." : "Päivitä"}
      </button>
    </div>
  );
}
