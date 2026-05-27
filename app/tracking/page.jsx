import Panel from "../components/Panel";
import {
  summarizeBets,
  calculateCLV,
  calculateProfitLoss,
  formatMoney,
  formatPercent
} from "../../lib/tracking-engine";

const bets = [
  {
    id: 1,
    date: "2026-05-27",
    match: "Tappara vs Ilves",
    pick: "Tappara ML",
    stake: 35,
    odds: 2.1,
    closingOdds: 1.92,
    result: "win"
  },
  {
    id: 2,
    date: "2026-05-27",
    match: "HIFK vs Kärpät",
    pick: "Under 5.5",
    stake: 25,
    odds: 1.92,
    closingOdds: 1.85,
    result: "loss"
  },
  {
    id: 3,
    date: "2026-05-28",
    match: "Lukko vs TPS",
    pick: "Lukko -1.5",
    stake: 20,
    odds: 2.35,
    closingOdds: 2.2,
    result: "pending"
  }
];

export default function TrackingPage() {
  const summary = summarizeBets(bets);
  const bankrollStart = 1000;
  const bankrollNow = bankrollStart + summary.totalProfit;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          Performance Tracking
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          Bankroll & Bet Tracking
        </h1>

        <p className="mt-3 text-slate-300">
          Seuraa vetoja, ROI:ta, CLV:tä ja mallin pitkäaikaista onnistumista.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Bankroll</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">
            {formatMoney(bankrollNow)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Start: {formatMoney(bankrollStart)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Profit / Loss</div>
          <div
            className={`mt-2 text-3xl font-black ${
              summary.totalProfit >= 0 ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {formatMoney(summary.totalProfit)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Settled bets: {summary.settledBets}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">ROI</div>
          <div className="mt-2 text-3xl font-black text-sky-300">
            {formatPercent(summary.roi)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Total staked: {formatMoney(summary.totalStaked)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Win Rate</div>
          <div className="mt-2 text-3xl font-black">
            {formatPercent(summary.winRate)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {summary.wins}W / {summary.losses}L / {summary.pushes}P
          </div>
        </div>
      </section>

      <Panel title="Bet History" subtitle="AI and manual bet performance">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-white/10 text-slate-400">
              <tr>
                <th className="py-3">Date</th>
                <th className="py-3">Match</th>
                <th className="py-3">Pick</th>
                <th className="py-3">Stake</th>
                <th className="py-3">Odds</th>
                <th className="py-3">Close</th>
                <th className="py-3">CLV</th>
                <th className="py-3">Result</th>
                <th className="py-3">P/L</th>
              </tr>
            </thead>

            <tbody>
              {bets.map((bet) => {
                const clv = calculateCLV({
                  takenOdds: bet.odds,
                  closingOdds: bet.closingOdds
                });

                const profitLoss = calculateProfitLoss(bet);

                return (
                  <tr key={bet.id} className="border-b border-white/5">
                    <td className="py-4 text-slate-400">{bet.date}</td>
                    <td className="py-4 font-medium">{bet.match}</td>
                    <td className="py-4">{bet.pick}</td>
                    <td className="py-4">{formatMoney(bet.stake)}</td>
                    <td className="py-4">{bet.odds}</td>
                    <td className="py-4">{bet.closingOdds}</td>
                    <td
                      className={`py-4 font-bold ${
                        clv >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {formatPercent(clv)}
                    </td>
                    <td className="py-4 capitalize">{bet.result}</td>
                    <td
                      className={`py-4 font-bold ${
                        profitLoss >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {bet.result === "pending"
                        ? "-"
                        : formatMoney(profitLoss)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
