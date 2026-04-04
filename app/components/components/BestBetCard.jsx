export default function BestBetCard({ analysisData }) {
  if (!analysisData?.analysis) return null;

  const { match, analysis } = analysisData;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5 mt-4">
      <h2 className="text-xl font-bold mb-3">Best Bet</h2>

      <div className="text-sm text-zinc-300 mb-3">
        <b>{match.home_team}</b> vs <b>{match.away_team}</b>
      </div>

      <div className="text-sm">
        <div>Home prob: {(analysis.homeWinProbability * 100).toFixed(1)}%</div>
        <div>Away prob: {(analysis.awayWinProbability * 100).toFixed(1)}%</div>
      </div>

      {analysis.recommendedSide ? (
        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          🔥 BET:{" "}
          {analysis.recommendedSide === "home"
            ? match.home_team
            : match.away_team}
        </div>
      ) : (
        <div className="mt-3 text-zinc-400">No value bet</div>
      )}
    </div>
  );
}
