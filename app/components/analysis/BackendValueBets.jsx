"use client";

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

function StatusBadge({ isBet }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${
        isBet
          ? "bg-green-600 text-white"
          : "bg-orange-600 text-white"
      }`}
    >
      {isBet ? "Bet" : "No bet"}
    </span>
  );
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
      className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${
        styles[grade] ?? "bg-slate-600 text-white"
      }`}
    >
      {grade ?? "—"}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4">
      <span className="text-base font-semibold text-slate-100">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
    </div>
  );
}

function NoBetReasons({ reasons }) {
  if (!Array.isArray(reasons) || reasons.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-orange-800 bg-[#3A220C] px-4 py-3 text-sm text-orange-200">
      {reasons.join(", ")}
    </div>
  );
}

function ValueBetCard({ bet }) {
  return (
    <div
      className={`rounded-[28px] border p-6 shadow-lg ${
        bet.isBet
          ? "border-green-700 bg-[#08183E]"
          : "border-orange-700 bg-[#08183E]"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-white">
            {bet.outcomeName ?? "—"}
          </div>
          <div className="mt-2 text-sm text-slate-300">
            {bet.bookmaker ?? "—"} • {bet.marketKey ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GradeBadge grade={bet.grade} />
          <StatusBadge isBet={bet.isBet} />
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-full border border-slate-700 bg-[#061433] px-3 py-1 text-sm font-semibold text-slate-300">
        {bet.reasonTag ?? "—"}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Row label="Kerroin" value={formatOdds(bet.odds)} />
        <Row label="Fair odds" value={formatOdds(bet.fairOdds)} />
        <Row
          label="Mallin todennäköisyys"
          value={formatPercent(bet.modelProbability)}
        />
        <Row
          label="Markkinan todennäköisyys"
          value={formatPercent(bet.marketProbability)}
        />
        <Row label="Edge" value={formatPercent(bet.edge)} />
        <Row label="Odotusarvo" value={formatPercent(bet.ev)} />
        <Row label="Quarter Kelly" value={formatPercent(bet.kelly)} />
        <Row label="Confidence" value={`${bet.confidence ?? 0}%`} />
        <Row label="Suositeltu panos" value={formatMoney(bet.recommendedStake)} />
        <Row label="Taso" value={bet.status ?? "—"} />
      </div>

      <NoBetReasons reasons={bet.noBetReasons} />
    </div>
  );
}

export default function BackendValueBets({ valueBets = [] }) {
  if (!Array.isArray(valueBets) || valueBets.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-3xl font-extrabold text-white">
          Value betit • Backend
        </h3>
        <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 text-slate-300">
          Ei value bettejä.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-3xl font-extrabold text-white">
        Value betit • Backend
      </h3>

      {valueBets.map((bet, index) => (
        <ValueBetCard
          key={`${bet.bookmaker}-${bet.outcomeName}-${bet.odds}-${index}`}
          bet={bet}
        />
      ))}
    </section>
  );
}
