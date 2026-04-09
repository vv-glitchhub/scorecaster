"use client";

import { useState } from "react";
import SectionCard from "./SectionCard";

export default function DebugPanel({ debug, title = "Debug" }) {
  const [open, setOpen] = useState(false);

  if (!debug) return null;

  return (
    <SectionCard
      title={title}
      rightSlot={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0b245d]"
        >
          {open ? "Piilota debug" : "Näytä debug"}
        </button>
      }
    >
      {open ? (
        <pre className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#071B49] p-4 text-sm text-sky-200">
          {JSON.stringify(debug, null, 2)}
        </pre>
      ) : (
        <p className="text-slate-300">Debug on piilotettu normaalikäyttöä varten.</p>
      )}
    </SectionCard>
  );
}
