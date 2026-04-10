import PageSection from "@/app/components/PageSection";

async function getOdds() {
  try {
    const res = await fetch("http://localhost:3000/api/odds?sport=icehockey_liiga", {
      cache: "no-store",
    });

    if (!res.ok) {
      return { matches: [], source: "unknown", cached: false };
    }

    return res.json();
  } catch {
    return { matches: [], source: "unknown", cached: false };
  }
}

async function getTopPicks() {
  try {
    const res = await fetch("http://localhost:3000/api/top-picks?sport=icehockey_liiga&limit=8", {
      cache: "no-store",
    });

    if (!res.ok) {
      return { picks: [], source: "unknown", cached: false };
    }

    return res.json();
  } catch {
    return { picks: [], source: "unknown", cached: false };
  }
}

async function getModelAnalysis(matchId) {
  try {
    const url = matchId
      ? `http://localhost:3000/api/model-analysis-v1?sport=icehockey_liiga&matchId=${matchId}`
      : "http://localhost:3000/api/model-analysis-v1?sport=icehockey_liiga";

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

export default async function BettingPage() {
  const oddsData = await getOdds();
  const matches = oddsData?.matches || [];
  const selectedMatch = matches[0] || null;

  const [topPicksData, analysisData] = await Promise.all([
    getTopPicks(),
    getModelAnalysis(selectedMatch?.id),
  ]);

  const topPicks = topPicksData?.picks || [];
  const valueBets = analysisData?.valueBets || [];
  const model = analysisData?.model || null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
          Betting Workspace
        </p>
        <h1 className="text-3xl font-bold text-white">
          Full betting analysis, odds comparison and value bet workflow.
        </h1>
        <p className="mt-3 text-slate-300">
          Tälle sivulle jää kaikki raskas analyysi. Myöhemmin tähän voi lisätä
          live bets, props, totals, handicap-markkinat ja lisää ranking-logiikkaa.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-4">
          <PageSection
            title="Filters"
            description="Sport / league / market controls can expand here."
          >
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">Sport</p>
                <p className="mt-1 font-semibold text-white">Ice Hockey</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">League</p>
                <p className="mt-1 font-semibold text-white">Liiga</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">Market</p>
                <p className="mt-1 font-semibold text-white">H2H</p>
              </div>
            </div>
          </PageSection>

          <PageSection
            title="Matches"
            description="Available matches for the selected sport."
          >
            <div className="space-y-3">
              {matches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No matches found.
                </div>
              ) : (
                matches.map((match) => (
                  <div
                    key={match.id}
                    className={`rounded-2xl border p-4 ${
                      selectedMatch?.id === match.id
                        ? "border-emerald-400 bg-emerald-500/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <p className="font-semibold text-white">
                      {match.home_team} vs {match.away_team}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {match.sport_title}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PageSection>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <PageSection
            title="Selected Match Analysis"
            description="Main match view, best odds and model output."
          >
            {!selectedMatch ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No selected match.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xl font-semibold text-white">
                    {selectedMatch.home_team} vs {selectedMatch.away_team}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedMatch.sport_title}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Home odds</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {selectedMatch.bestOdds?.home ?? "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Draw odds</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {selectedMatch.bestOdds?.draw ?? "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Away odds</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {selectedMatch.bestOdds?.away ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Model Home</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {model ? `${(model.home * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Model Draw</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {model ? `${(model.draw * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Model Away</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {model ? `${(model.away * 100).toFixed(1)}%` : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-slate-400">Confidence</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {model ? `${model.confidence}%` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </PageSection>

          <PageSection
            title="Value Bets"
            description="Model edge versus current best odds."
          >
            <div className="space-y-3">
              {valueBets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No value bet rows available.
                </div>
              ) : (
                valueBets.map((row) => (
                  <div
                    key={`${row.side}-${row.team}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          {row.side} • {row.team}
                        </p>
                        <p className="text-sm text-slate-400">
                          Bookmaker: {row.bookmaker || "-"}
                        </p>
                      </div>

                      <div className="text-right text-sm">
                        <p className="text-white">Odds {row.odds}</p>
                        <p className="text-slate-300">Fair {row.fairOdds}</p>
                        <p
                          className={
                            row.edgePct > 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }
                        >
                          EV {row.edgePct}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PageSection>
        </div>

        <div className="space-y-6 xl:col-span-3">
          <PageSection
            title="Backend Top Picks"
            description="Ranked value opportunities."
          >
            <div className="space-y-3">
              {topPicks.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No backend picks available.
                </div>
              ) : (
                topPicks.map((pick) => (
                  <div
                    key={`${pick.matchId}-${pick.selection}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <p className="font-semibold text-white">
                      {pick.selection} @ {pick.odds}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {pick.home_team} vs {pick.away_team}
                    </p>
                    <p className="mt-2 text-sm text-emerald-300">
                      EV {pick.edgePct}% • Confidence {pick.confidence}%
                    </p>
                  </div>
                ))
              )}
            </div>
          </PageSection>

          <PageSection
            title="Bankroll"
            description="Placeholder for staking and Kelly logic."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">Bankroll</p>
                <p className="mt-1 text-lg font-semibold text-white">€1,000</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-slate-400">Staking model</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  Quarter Kelly
                </p>
              </div>
            </div>
          </PageSection>
        </div>
      </div>
    </div>
  );
}
