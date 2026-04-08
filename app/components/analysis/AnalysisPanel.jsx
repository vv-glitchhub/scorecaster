"use client";

import { useEffect, useState } from "react";
import BackendValueBets from "./BackendValueBets";
import TopPicks from "./TopPicks";
import { fetchAnalyze } from "../../lib/api/fetchAnalyze";

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

function BestBetCard({ bestBet }) {
  if (!bestBet) {
    return (
      <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 text-slate-300">
        Ei löydetty pelattavaa kohdetta.
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 shadow-lg">
      <div className="mb-6 rounded-[24px] border border-slate-700 bg-[#0A1B45] p-6">
        <h3 className="mb-3 text-2xl font-extrabold text-white">Miksi tämä kohde?</h3>
        <p className="text-lg text-slate-300">
          Malli pitää tätä kohdetta markkinaa parempana. Edge, EV ja Kelly tukevat tätä valintaa.
        </p>
      </div>

      <div className="grid gap-3">
        <Row label="Kohde" value={bestBet.outcomeName ?? "—"} />
        <Row label="Mallin todennäköisyys" value={formatPercent(bestBet.modelProbability)} />
        <Row label="Markkinan todennäköisyys" value={formatPercent(bestBet.marketProbability)} />
        <Row label="Kerroin" value={formatOdds(bestBet.odds)} />
        <Row label="Fair odds" value={formatOdds(bestBet.fairOdds)} />
        <Row label="Vedonvälittäjä" value={bestBet.bookmaker ?? "—"} />
        <Row label="Edge" value={formatPercent(bestBet.edge)} />
        <Row label="Odotusarvo" value={formatPercent(bestBet.ev)} />
        <Row label="Quarter Kelly" value={formatPercent(bestBet.kelly)} />
        <Row label="Confidence" value={`${bestBet.confidence ?? 0}%`} />
        <Row label="Grade" value={bestBet.grade ?? "—"} />
        <Row label="Suositeltu panos" value={formatMoney(bestBet.recommendedStake)} />
      </div>
    </div>
  );
}

function BestOddsList({ bestOdds = [] }) {
  if (!Array.isArray(bestOdds) || bestOdds.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-3xl font-extrabold text-white">Parhaat kertoimet</h3>
      {bestOdds.map((row, index) => (
        <div
          key={`${row.outcomeName}-${row.bookmaker}-${index}`}
          className="flex items-center justify-between rounded-2xl border border-slate-700 bg-[#08183E] px-6 py-5"
        >
          <span className="text-2xl font-bold text-white">{row.outcomeName}</span>
          <span className="text-2xl font-bold text-white">
            {formatOdds(row.odds)} • {row.bookmaker}
          </span>
        </div>
      ))}
    </section>
  );
}

export default function AnalysisPanel({
  match,
  oddsData,
  bankroll,
  teamRatings = null,
}) {
  const [analyzeData, setAnalyzeData] = useState(null);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  useEffect(() => {
    let active = true;

    async function run() {
      if (!match || !oddsData) return;

      setLoadingAnalyze(true);
      setAnalyzeError("");

      const data = await fetchAnalyze({
        match,
        oddsData,
        bankroll,
        teamRatings,
      });

      if (!active) return;

      if (data) {
        setAnalyzeData(data);
        setAnalyzeError("");
      } else {
        setAnalyzeData(null);
        setAnalyzeError("Backend-analyysiä ei saatu haettua.");
      }

      setLoadingAnalyze(false);
    }

    run();

    return () => {
      active = false;
    };
  }, [match, oddsData, bankroll, teamRatings]);

  return (
    <section className="space-y-6">
      {loadingAnalyze ? (
        <div className="rounded-[28px] border border-slate-700 bg-[#08183E] p-6 text-slate-300">
          Haetaan backend-analyysiä...
        </div>
      ) : null}

      {analyzeError ? (
        <div className="rounded-[28px] border border-red-700 bg-[#5C0A0A] p-6 text-red-100">
          <h3 className="mb-3 text-2xl font-extrabold">Value betit • Backend</h3>
          <p className="text-lg">{analyzeError}</p>
          <p className="mt-4 text-lg text-red-200">
            Jos data ei ole liveä, analyysi on vain suuntaa-antava.
          </p>
        </div>
      ) : null}

      {analyzeData ? (
        <>
          <TopPicks picks={analyzeData.topPicks ?? []} />

          <BestOddsList bestOdds={analyzeData.bestOdds ?? []} />

          <section className="space-y-4">
            <h3 className="text-3xl font-extrabold text-white">Paras kohde • Legacy</h3>
            <BestBetCard bestBet={analyzeData.bestBet} />
          </section>

          <BackendValueBets valueBets={analyzeData.valueBets ?? []} />
        </>
      ) : null}
    </section>
  );
}
