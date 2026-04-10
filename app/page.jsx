import Link from "next/link";
import PageSection from "@/app/components/PageSection";

async function getTopPicks() {
  try {
    const res = await fetch("http://localhost:3000/api/top-picks?sport=icehockey_liiga&limit=3", {
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

async function getOddsPreview() {
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

export default async function HomePage() {
  const [topPicksData, oddsData] = await Promise.all([
    getTopPicks(),
    getOddsPreview(),
  ]);

  const topPicks = topPicksData?.picks || [];
  const previewMatch = oddsData?.matches?.[0] || null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
            Scorecaster Dashboard
          </p>

          <h1 className="text-4xl font-bold text-white">
            Clearer home view, dedicated betting workspace, dedicated simulator.
          </h1>

          <p className="mt-4 text-slate-300">
            Dashboard näyttää vain tärkeimmät asiat nopeasti. Raskas analyysi
            on siirretty betting-sivulle ja simulaatiot simulator-sivulle.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/betting"
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:opacity-90"
            >
              Open Betting Workspace
            </Link>

            <Link
              href="/simulator"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Open Simulator
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <PageSection
          title="Top Picks"
          description="Best backend-ranked value spots right now."
        >
          <div className="space-y-3">
            {topPicks.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No top picks available.
              </div>
            ) : (
              topPicks.map((pick) => (
                <div
                  key={`${pick.matchId}-${pick.selection}`}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        {pick.home_team} vs {pick.away_team}
                      </p>
                      <p className="text-sm text-slate-400">
                        {pick.selection} • {pick.team}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-emerald-300">
                        EV {pick.edgePct}%
                      </p>
                      <p className="text-sm text-slate-300">
                        Odds {pick.odds}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PageSection>

        <PageSection
          title="Data Source Status"
          description="Quick source and cache visibility."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Odds source</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {oddsData?.source || "unknown"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Cache status</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {oddsData?.cached ? "cached" : "fresh"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Matches loaded</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {oddsData?.matches?.length || 0}
              </p>
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Simulator Preview"
          description="Quick look before opening the simulator."
        >
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-400">Next step</p>
            <p className="mt-1 text-lg font-semibold text-white">
              Run tournament / season simulations separately
            </p>
            <p className="mt-3 text-sm text-slate-300">
              Keep simulation logic isolated so betting workspace stays focused.
            </p>
            <Link
              href="/simulator"
              className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Go to simulator
            </Link>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="Match Preview"
        description="Lightweight preview on the dashboard."
      >
        {!previewMatch ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            No match preview available.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-2">
              <p className="text-lg font-semibold text-white">
                {previewMatch.home_team} vs {previewMatch.away_team}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {previewMatch.sport_title}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Dashboard näyttää vain kevyen preview’n. Täysi analyysi löytyy
                betting-sivulta.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-slate-400">Best odds</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-300">Home</span>
                  <span className="font-medium text-white">
                    {previewMatch.bestOdds?.home ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Draw</span>
                  <span className="font-medium text-white">
                    {previewMatch.bestOdds?.draw ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Away</span>
                  <span className="font-medium text-white">
                    {previewMatch.bestOdds?.away ?? "-"}
                  </span>
                </div>
              </div>

              <Link
                href="/betting"
                className="mt-4 inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
              >
                Open full betting analysis
              </Link>
            </div>
          </div>
        )}
      </PageSection>
    </div>
  );
}
