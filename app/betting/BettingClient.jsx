"use client";

import { useEffect, useState } from "react";
import Panel from "../components/Panel";
import { SPORTS } from "../../lib/sports";
import { parseOddsResponse } from "../../lib/odds-parser";
import {
  analyzeBet,
  formatPercent,
  formatMoney
} from "../../lib/analysis-engine";

function getGamesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.games)) return data.games;
  return [];
}

export default function BettingClient() {
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].group);
  const [selectedLeague, setSelectedLeague] = useState(SPORTS[0].leagues[0].key);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("not loaded");
  const [reason, setReason] = useState("");
  const [selectedBet, setSelectedBet] = useState(null);

  const bankroll = 1000;

  useEffect(() => {
    async function loadOdds() {
      setLoading(true);
      setMatches([]);
      setSelectedBet(null);
      setReason("");

      try {
        const res = await fetch(`/api/odds?sport=${selectedLeague}`, {
          cache: "no-store"
        });

        const data = await res.json();
        const rawGames = getGamesFromResponse(data);
        const parsedGames = parseOddsResponse(rawGames);

        setSource(data?.source || "api");
        setReason(data?.reason || data?.error || "");

        setMatches(parsedGames);
      } catch (error) {
        setSource("error");
        setReason(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadOdds();
  }, [selectedLeague]);

  function handleSportChange(groupName) {
    const group = SPORTS.find((sport) => sport.group === groupName);

    setSelectedSport(groupName);

    if (group?.leagues?.length > 0) {
      setSelectedLeague(group.leagues[0].key);
    }
  }

  function selectBet({ match, selection, odds }) {
    const analysis = analyzeBet({
      selection,
      decimalOdds: Number(odds),
      modelProbability: 0.55,
      volatility: "medium",
      bankroll
    });

    setSelectedBet({
      match,
      selection,
      odds,
      analysis
    });
  }

  const currentLeagues =
    SPORTS.find((sport) => sport.group === selectedSport)?.leagues || [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="mb-2 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">
          Multi-Sport Betting Workspace
        </div>

        <h1 className="text-4xl font-black tracking-tight">
          AI Betting Terminal
        </h1>

        <p className="mt-3 text-slate-300">
          Valitse laji ja sarja, hae oikeat kertoimet, tarkista EV, Kelly, edge
          ja lisää veto seurantaan.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <select
            value={selectedSport}
            onChange={(event) => handleSportChange(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
          >
            {SPORTS.map((sport) => (
              <option key={sport.group} value={sport.group}>
                {sport.group}
              </option>
            ))}
          </select>

          <select
            value={selectedLeague}
            onChange={(event) => setSelectedLeague(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
          >
            {currentLeagues.map((league) => (
              <option key={league.key} value={league.key}>
                {league.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          Data source:{" "}
          <span className="font-bold text-emerald-300">{source}</span>
          {loading && <span className="ml-2 text-yellow-300">Loading...</span>}
          {reason && <div className="mt-2 text-yellow-300">{reason}</div>}
          {!loading && matches.length === 0 && (
            <div className="mt-2 text-red-300">
              Tästä sarjasta ei löytynyt nyt kertoimellisiä otteluita.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-4">
          {matches.map((match, index) => {
            const previewOutcome = match.outcomes[0];
            const previewOdds = Number(previewOutcome?.odds || 2);

            const preview = analyzeBet({
              selection: previewOutcome?.name || match.home,
              decimalOdds: previewOdds,
              modelProbability: 0.55,
              volatility: "medium",
              bankroll
            });

            return (
              <div
                key={match.id || `${match.home}-${match.away}-${index}`}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-xl"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xl font-black">
                      {match.home} vs {match.away}
                    </div>

                    <div className="mt-2 text-sm text-slate-400">
                      {match.sport} · {match.market} · {match.bookmaker}
                    </div>

                    {match.commenceTime && (
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(match.commenceTime).toLocaleString("fi-FI")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {match.outcomes.map((outcome) => (
                      <button
                        key={`${match.id}-${outcome.name}-${outcome.point ?? ""}`}
                        onClick={() =>
                          selectBet({
                            match: `${match.home} vs ${match.away}`,
                            selection:
                              outcome.point !== null
                                ? `${outcome.name} ${outcome.point}`
                                : outcome.name,
                            odds: outcome.odds
                          })
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-left hover:bg-emerald-400/10"
                      >
                        <div className="text-sm text-slate-400">
                          {outcome.name}
                          {outcome.point !== null ? ` ${outcome.point}` : ""}
                        </div>
                        <div className="mt-1 text-lg font-black">
                          {outcome.odds}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Market Prob.</div>
                    <div className="mt-2 text-2xl font-black">
                      {formatPercent(preview.marketProbability)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">AI Edge</div>
                    <div className="mt-2 text-2xl font-black text-emerald-300">
                      {formatPercent(preview.edge)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">EV</div>
                    <div className="mt-2 text-2xl font-black text-sky-300">
                      {formatPercent(preview.ev)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Confidence</div>
                    <div className="mt-2 text-2xl font-black">
                      {preview.confidence}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel title="Bet Slip" subtitle="Click odds to select a bet">
            {!selectedBet ? (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
                Ei valittua vetoa. Paina kerrointa vasemmalta.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/[0.04] p-4">
                  <div className="font-bold">{selectedBet.match}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedBet.selection} @ {selectedBet.odds}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Edge</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatPercent(selectedBet.analysis.edge)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">EV</div>
                    <div className="mt-2 text-xl font-black text-sky-300">
                      {formatPercent(selectedBet.analysis.ev)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Quarter Kelly</div>
                    <div className="mt-2 text-xl font-black">
                      {formatPercent(selectedBet.analysis.quarterKelly)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.04] p-4">
                    <div className="text-sm text-slate-400">Stake</div>
                    <div className="mt-2 text-xl font-black text-emerald-300">
                      {formatMoney(selectedBet.analysis.suggestedStake)}
                    </div>
                  </div>
                </div>

                <button className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-300">
                  Add To Tracking
                </button>
              </div>
            )}
          </Panel>

          <Panel title="AI Reasoning" subtitle="Why this may have value">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-xl bg-white/[0.04] p-4">
                Market probability is compared against internal model probability.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Stake uses conservative quarter Kelly sizing.
              </div>
              <div className="rounded-xl bg-white/[0.04] p-4">
                Next step: save selected bets into Supabase.
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
