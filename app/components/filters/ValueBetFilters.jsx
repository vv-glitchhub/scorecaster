"use client";

export default function ValueBetFilters({
  filters,
  onChange,
  onReset,
}) {
  return (
    <section className="rounded-[28px] border border-slate-800 bg-[#08183E] p-6 shadow-lg">
      <h2 className="mb-6 text-4xl font-extrabold text-white">Suodattimet</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-base font-bold text-slate-300">
            Min edge (%)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={filters.minEdge}
            onChange={(e) => onChange("minEdge", e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-4 text-white outline-none"
            placeholder="esim. 1"
          />
        </div>

        <div>
          <label className="mb-2 block text-base font-bold text-slate-300">
            Min kerroin
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={filters.minOdds}
            onChange={(e) => onChange("minOdds", e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-4 text-white outline-none"
            placeholder="esim. 1.50"
          />
        </div>

        <div>
          <label className="mb-2 block text-base font-bold text-slate-300">
            Max kerroin
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={filters.maxOdds}
            onChange={(e) => onChange("maxOdds", e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-4 text-white outline-none"
            placeholder="esim. 5.00"
          />
        </div>
      </div>

      <label className="mt-5 flex items-center gap-3 text-lg font-semibold text-slate-200">
        <input
          type="checkbox"
          checked={filters.onlyPositiveEV}
          onChange={(e) => onChange("onlyPositiveEV", e.target.checked)}
          className="h-5 w-5"
        />
        Vain positiivinen EV
      </label>

      <button
        onClick={onReset}
        className="mt-5 rounded-2xl border border-slate-600 bg-slate-700 px-6 py-4 text-xl font-bold text-white transition hover:bg-slate-600"
      >
        Nollaa suodattimet
      </button>
    </section>
  );
}
