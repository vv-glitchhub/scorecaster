// components/analysis/BackendValueBets.jsx

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

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4">
      <span className="text-lg font-semibold text-slate-100">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function ValueBetCard({ bet }) {
  return (
    <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 shadow-lg">
      <div className="grid gap-3">
        <Row label="Kohde" value={bet.outcomeName ?? "—"} />
        <Row label="Vedonvälittäjä" value={bet.bookmaker ?? "—"} />
        <Row label="Kerroin" value={formatOdds(bet.odds)} />
        <Row
          label="Mallin todennäköisyys"
          value={formatPercent(bet.modelProbability)}
        />
        <Row
          label="Markkinan todennäköisyys"
          value={formatPercent(bet.marketProbability)}
        />
        <Row label="Fair odds" value={formatOdds(bet.fairOdds)} />
        <Row label="Edge" value={formatPercent(bet.edge)} />
        <Row label="Odotusarvo" value={formatPercent(bet.ev)} />
        <Row label="Quarter Kelly" value={formatPercent(bet.kelly)} />
        <Row label="Suositeltu panos" value={formatMoney(bet.recommendedStake)} />
        <Row label="Taso" value={bet.status ?? "—"} />
      </div>

      {Array.isArray(bet.noBetReasons) && bet.noBetReasons.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-[#061433] px-4 py-3 text-sm text-slate-300">
          {bet.noBetReasons.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

export default function BackendValueBets({ valueBets = [] }) {
  if (!Array.isArray(valueBets) || valueBets.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 text-slate-300">
        Ei value bettejä.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-3xl font-extrabold text-white">Value betit • Backend</h3>
      {valueBets.map((bet, index) => (
        <ValueBetCard
          key={`${bet.bookmaker}-${bet.outcomeName}-${bet.odds}-${index}`}
          bet={bet}
        />
      ))}
    </section>
  );
}
