"use client";

function formatPercent(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

function formatOdds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00 €";
  return `${n.toFixed(2)} €`;
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#071B49] px-5 py-4">
      <span className="text-lg font-semibold text-slate-100">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

export default function BackendValueBets({ valueBets = [], bets = [] }) {
  const items = Array.isArray(valueBets) && valueBets.length > 0 ? valueBets : bets;

  if (!Array.isArray(items) || items.length === 0) {
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

      {items.map((bet, index) => {
        const outcomeName =
          safeText(bet?.outcomeName) ||
          safeText(bet?.outcome) ||
          safeText(bet?.team) ||
          safeText(bet?.selection) ||
          "—";

        const bookmaker =
          safeText(bet?.bookmaker) ||
          safeText(bet?.bookmakerTitle) ||
          "Unknown";

        const status =
          safeText(bet?.status, "") ||
          (bet?.isBet ? "bet" : "no_bet");

        const grade = safeText(bet?.grade);
        const fairOdds = bet?.fairOdds;
        const modelProbability = bet?.modelProbability;
        const marketProbability = bet?.marketProbability;
        const edge = bet?.edge;
        const ev = bet?.ev;
        const kelly = bet?.kelly;
        const recommendedStake = bet?.recommendedStake;

        return (
          <div
            key={`${bookmaker}-${outcomeName}-${bet?.odds ?? index}-${index}`}
            className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 shadow-lg"
          >
            <div className="grid gap-3">
              <Row label="Kohde" value={outcomeName} />
              <Row label="Vedonvälittäjä" value={bookmaker} />
              <Row label="Kerroin" value={formatOdds(bet?.odds)} />
              <Row label="Fair odds" value={formatOdds(fairOdds)} />
              <Row
                label="Mallin todennäköisyys"
                value={formatPercent(modelProbability)}
              />
              <Row
                label="Markkinan todennäköisyys"
                value={formatPercent(marketProbability)}
              />
              <Row label="Edge" value={formatPercent(edge, 2)} />
              <Row label="Odotusarvo" value={formatPercent(ev, 2)} />
              <Row label="Quarter Kelly" value={formatPercent(kelly, 2)} />
              <Row
                label="Suositeltu panos"
                value={formatMoney(recommendedStake)}
              />
              <Row label="Taso" value={grade !== "—" ? grade : status} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
