"use client";

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatOdds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} €`;
}

function Badge({ label, className = "" }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ isBet }) {
  return (
    <Badge
      label={isBet ? "Bet" : "No bet"}
      className={isBet ? "bg-green-600 text-white" : "bg-orange-600 text-white"}
    />
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
    <Badge
      label={grade ?? "—"}
      className={styles[grade] ?? "bg-slate-600 text-white"}
    />
  );
}

function MarketSignalBadge({ signal }) {
  const styles = {
    market_underpricing: "bg-blue-600 text-white",
    model_edge: "bg-indigo-600 text-white",
    neutral: "bg-slate-600 text-white",
    market_expensive: "bg-red-700 text-white",
    unknown: "bg-slate-700 text-white",
  };

  return (
    <Badge
      label={signal ?? "unknown"}
      className={styles[signal] ?? "bg-slate-700 text-white"}
    />
  );
}

function BucketBadge({ label }) {
  const styles = {
    elite: "bg-green-700 text-white",
    strong: "bg-emerald-700 text-white",
    solid: "bg-blue-700 text-white",
    thin: "bg-yellow-600 text-black",
    marginal: "bg-orange-600 text-white",
    negative: "bg-red-700 text-white",
    none: "bg-slate-700 text-white",
    tiny: "bg-slate-600 text-white",
    small: "bg-cyan-700 text-white",
    medium: "bg-blue-700 text-white",
    aggressive: "bg-purple-700 text-white",
    unknown: "bg-slate-700 text-white",
  };

  return (
    <Badge
      label={label ?? "unknown"}
      className={styles[label] ?? "bg-slate-700 text-white"}
    />
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

function ClvBox({ clv }) {
  if (!clv) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-700 bg-[#061433] px-4 py-3 text-sm text-slate-200">
      <div>Opening odds: {formatOdds(clv.openingOdds)}</div>
      <div>Current odds: {formatOdds(clv.currentOdds)}</div>
      <div>Target close odds: {formatOdds(clv.targetCloseOdds)}</div>
      <div>Estimated CLV edge: {formatOdds(clv.estimatedClvEdge)}</div>
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
  if (!bet) return null;

  const outcomeName =
    bet.outcomeName ??
    bet.outcome ??
    bet.team ??
    bet.selection ??
    "—";

  const bookmaker =
    bet.bookmaker ??
    bet.bookmakerTitle ??
    "Unknown";

  const status =
    bet.status ??
    (bet.isBet ? "bet" : "no_bet");

  const confidence = Number.isFinite(Number(bet.confidence))
    ? `${Number(bet.confidence)}%`
    : "0%";

  return (
    <div
      className={`rounded-[28px] border p-6 shadow-lg ${
        bet.isBet ? "border-green-700 bg-[#08183E]" : "border-orange-700 bg-[#08183E]"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-white">
            {outcomeName}
          </div>
          <div className="mt-2 text-sm text-slate-300">
            {bookmaker} • {bet.marketKey ?? "h2h"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GradeBadge grade={bet.grade} />
          <StatusBadge isBet={Boolean(bet.isBet)} />
          <MarketSignalBadge signal={bet.marketSignal} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <BucketBadge label={bet.edgeBucket} />
        <BucketBadge label={bet.evBucket} />
        <BucketBadge label={bet.kellyBucket} />
      </div>

      <div className="mb-4 inline-flex rounded-full border border-slate-700 bg-[#061433] px-3 py-1 text-sm font-semibold text-slate-300">
        {bet.reasonTag ?? "—"}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Row label="Kohde" value={outcomeName} />
        <Row label="Vedonvälittäjä" value={bookmaker} />
        <Row label="Kerroin" value={formatOdds(bet.odds)} />
        <Row label="Fair odds" value={formatOdds(bet.fairOdds)} />
        <Row label="Mallin todennäköisyys" value={formatPercent(bet.modelProbability)} />
        <Row label="Markkinan todennäköisyys" value={formatPercent(bet.marketProbability)} />
        <Row label="Edge" value={formatPercent(bet.edge)} />
        <Row label="Odotusarvo" value={formatPercent(bet.ev)} />
        <Row label="Quarter Kelly" value={formatPercent(bet.kelly)} />
        <Row label="Confidence" value={confidence} />
        <Row label="Grade" value={bet.grade ?? "—"} />
        <Row label="Taso" value={status} />
        <Row label="Suositeltu panos" value={formatMoney(bet.recommendedStake)} />
      </div>

      <ClvBox clv={bet.clv} />
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
          key={`${bet?.bookmaker ?? "book"}-${bet?.outcomeName ?? bet?.outcome ?? "outcome"}-${bet?.odds ?? index}-${index}`}
          bet={bet}
        />
      ))}
    </section>
  );
}
