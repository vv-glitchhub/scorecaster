"use client";

import SectionCard from "../ui/SectionCard";

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export default function SimulatorPreviewCard({
  top5 = [],
  onOpen,
  isPreview = true,
}) {
  return (
    <SectionCard
      title="Simulaattori"
      subtitle="MM-kisojen mestarisuosikit"
      rightSlot={
        isPreview ? (
          <span className="inline-flex rounded-full border border-slate-700 bg-[#1E293B] px-4 py-2 text-sm font-extrabold text-sky-200">
            Preview
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        {top5.slice(0, 5).map((team, index) => (
          <div
            key={`${team.team_name}-${index}`}
            className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4"
          >
            <span className="text-xl font-bold text-white">
              #{index + 1} {team.team_name}
            </span>
            <span className="text-xl font-extrabold text-white">
              {formatPct(team.championship_pct)}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={onOpen}
          className="mt-3 rounded-2xl bg-green-600 px-6 py-4 text-xl font-extrabold text-white transition hover:bg-green-500"
        >
          Avaa simulaattori
        </button>
      </div>
    </SectionCard>
  );
}
