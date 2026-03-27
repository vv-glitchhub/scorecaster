"use client";

import { useEffect, useMemo, useState } from "react";

function formatMatchTime(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleString("fi-FI", {
    timeZone: "Europe/Helsinki",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getBestSide(bet) {
  const homeValue = Number(bet.home_value || 0);
  const drawValue = Number(bet.draw_value || 0);
  const awayValue = Number(bet.away_value || 0);

  if (homeValue >= drawValue && homeValue >= awayValue) {
    return {
      label: bet.home_team,
      type: "HOME",
      ev: homeValue,
      odds: Number(bet.best_home_odds || 0)
    };
  }

  if (drawValue >= homeValue && drawValue >= awayValue) {
    return {
      label: "Tasapeli",
      type: "DRAW",
      ev: drawValue,
      odds: Number(bet.best_draw_odds || 0)
    };
  }

  return {
    label: bet.away_team,
    type: "AWAY",
    ev: awayValue,
    odds: Number(bet.best_away_odds || 0)
  };
}

function getEvLevel(ev) {
  if (ev >= 1.15) {
    return {
      label: "ELITE EDGE",
      className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
    };
  }

  if (ev >= 1.08) {
    return {
      label: "HIGH VALUE",
      className: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
    };
  }

  if (ev >= 1.03) {
    return {
      label: "VALUE",
      className: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
    };
  }

  return {
    label: "SMALL EDGE",
    className: "bg-white/10 text-white/70 border border-white/10"
  };
}

function getConfidenceLabel(confidence) {
  const c = String(confidence || "").toUpperCase();

  if (c === "HIGH") return "KORKEA";
  if (c === "MEDIUM") return "KESKITASO";
  if (c === "LOW") return "MATALA";
  return confidence || "-";
}

function getRecommendationText(bestSide) {
  return `Bet suggestion: ${bestSide.label}`;
}

export default function ValueBetsSection() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchValueBets() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/value-bets", {
        cache: "no-store"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Value bets fetch failed");
      }

      setBets(data.valueBets || []);
    } catch (err) {
      setError(err.message || "Virhe value bettien haussa");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchValueBets();
  }, []);

  const topBets = useMemo(() => {
    return bets.slice(0, 10);
  }, [bets]);

  return (
    <section className="mt-8 rounded-[28px] border border-white/10 bg-gradient-to-b from-[#0a1020] to-[#060912] p-4 shadow-2xl shadow-black/30 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">
            Premium Betting Intelligence
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
            Value Bets
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Highest expected value opportunities ranked from your model probabilities
            and best available odds.
          </p>
        </div>

        <button
          onClick={fetchValueBets}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Päivitä
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70">
          Ladataan value bettejä...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && topBets.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70">
          Ei value bettejä juuri nyt.
        </div>
      )}

      {!loading && !error && topBets.length > 0 && (
        <div className="grid gap-4">
          {topBets.map((bet) => {
            const bestSide = getBestSide(bet);
            const evLevel = getEvLevel(bestSide.ev);

            return (
              <article
                key={bet.id}
                className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 backdrop-blur-sm transition hover:border-cyan-400/30 hover:bg-white/[0.07] md:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${evLevel.className}`}>
                      {evLevel.label}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                      {bet.league || "-"}
                    </span>
                  </div>

                  <div className="text-xs text-white/45">
                    {formatMatchTime(bet.commence_time)}
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-black leading-tight text-white md:text-2xl">
                    {bet.home_team} <span className="text-white/40">vs</span> {bet.away_team}
                  </h3>

                  <p className="mt-3 text-sm font-medium text-cyan-300">
                    {getRecommendationText(bestSide)}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                      Best Side
                    </div>
                    <div className="mt-2 text-sm font-bold text-white">
                      {bestSide.type}
                    </div>
                    <div className="mt-1 text-sm text-white/70">
                      {bestSide.label}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                      EV
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-300">
                      {bestSide.ev.toFixed(3)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                      Best Odds
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                      {bestSide.odds ? bestSide.odds.toFixed(2) : "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                      Confidence
                    </div>
                    <div className="mt-2 text-sm font-bold text-white">
                      {getConfidenceLabel(bet.confidence)}
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      {bet.recommendation || "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/40">
                      Home EV
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {Number(bet.home_value || 0).toFixed(3)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/40">
                      Draw EV
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {Number(bet.draw_value || 0).toFixed(3)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-white/40">
                      Away EV
                    </div>
                    <div className="mt-2 text-lg font-bold text-white">
                      {Number(bet.away_value || 0).toFixed(3)}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
