"use client";

const styles = {
  live: "border-green-700 bg-[#0E3B22] text-green-200",
  cache: "border-yellow-700 bg-[#4A3708] text-yellow-200",
  demo: "border-red-700 bg-[#5C0A0A] text-red-200",
  unknown: "border-slate-700 bg-[#1E293B] text-slate-200",
};

const labels = {
  live: "Live-data",
  cache: "Cache-data",
  demo: "Demo-data",
  unknown: "Unknown",
};

export default function SourceBadge({ source }) {
  const key = String(source ?? "unknown").toLowerCase();
  const className = styles[key] ?? styles.unknown;
  const label = labels[key] ?? labels.unknown;

  return (
    <span
      className={`inline-flex rounded-full border px-4 py-2 text-sm font-extrabold ${className}`}
    >
      {label}
    </span>
  );
}
