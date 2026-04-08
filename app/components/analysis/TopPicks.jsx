function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatOdds(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toFixed(2);
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${Number(value).toFixed(2)} €`;
}

function GradeBadge({ grade }) {
  const styles = {
    A: "bg-green-600 text-white",
    B: "bg-emerald-600 text-white",
    C: "bg-yellow-500 text-black",
    D: "bg-orange-500 text-white",
    F: "bg-red-600 text-white",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-bold ${styles[grade] ?? "bg-slate-600 text-white"}`}
    >
      {grade}
    </span>
  );
}

export default function TopPicks({ picks = [] }) {
  if (!Array.isArray(picks) || picks.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-3xl font-extrabold text-white">Päivän Top 3 kohdetta</h3>
        <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 text-slate-300">
          Top-kohteita ei löytynyt.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-3xl font-extrabold text-white">Päivän Top 3 kohdetta</h3>

      {picks.map((bet, index) => (
        <div
          key={`${bet.bookmaker}-${bet.outcomeName}-${index}`}
          className="rounded-[28px] border border-green-700 bg-[#08183E] p-6 shadow-lg"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-green-400">
                #{index + 1} Suositus
              </div>
              <div className="mt-1 text-2xl font-extrabold text-white">
                {bet.outcomeName}
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {formatOdds(bet.odds)} • {bet.bookmaker}
              </div>
            </div>

            <GradeBadge grade={bet.grade} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-3">
              <div className="text-sm text-slate-300">Edge</div>
              <div className="text-xl font-bold text-white">
                {formatPercent(bet.edge)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-3">
              <div className="text-sm text-slate-300">Odotusarvo</div>
              <div className="text-xl font-bold text-white">
                {formatPercent(bet.ev)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-3">
              <div className="text-sm text-slate-300">Confidence</div>
              <div className="text-xl font-bold text-white">{bet.confidence}%</div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#071B49] px-4 py-3">
              <div className="text-sm text-slate-300">Suositeltu panos</div>
              <div className="text-xl font-bold text-white">
                {formatMoney(bet.recommendedStake)}
              </div>
            </div>
          </div>

          <div className="mt-4 inline-flex rounded-full border border-green-600 bg-green-900/30 px-3 py-1 text-sm font-semibold text-green-300">
            {bet.reasonTag}
          </div>
        </div>
      ))}
    </section>
  );
}
