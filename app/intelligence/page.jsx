"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "../components/Panel";
import { buildIntelligenceSummary } from "../../lib/intelligence-summary-engine";
import { formatPercent } from "../../lib/analysis-engine";

function decisionTone(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "SKIP") return "border-red-400/30 bg-red-400/10 text-red-300";
  return "border-amber-400/30 bg-amber-400/10 text-amber-300";
}

export default function IntelligencePage() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/top-picks", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Top Picks could not be loaded");
      setPicks(Array.isArray(data.data) ? data.data : []);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
    } catch (loadError) {
      setPicks([]);
      setError(loadError instanceof Error ? loadError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = buildIntelligenceSummary(picks);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
              V8 Market Consensus
            </div>
            <h1 className="text-4xl font-black tracking-tight">Intelligence Layer</h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Scorecaster poistaa vedonvälittäjien marginaalin, muodostaa markkinakonsensuksen ja vertaa sitä parhaaseen saatavilla olevaan hintaan. Näkymä kertoo myös aineiston kattavuuden, tuoreuden ja epävarmuuden.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            {loading ? "Päivitetään…" : "Päivitä analyysi"}
          </button>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          {generatedAt ? `Luotu ${new Date(generatedAt).toLocaleString("fi-FI")}` : "Analyysiä ei ole vielä ladattu"} · vain paperiseuranta · ei voittotakuuta
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Kohteet</div>
          <div className="mt-2 text-3xl font-black text-sky-300">{summary.totalPicks}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">PLAY / CAUTION / SKIP</div>
          <div className="mt-2 text-xl font-black text-white">
            {summary.decisions.PLAY} / {summary.decisions.CAUTION} / {summary.decisions.SKIP}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Average Trust</div>
          <div className="mt-2 text-3xl font-black text-purple-300">{formatPercent(summary.averageTrust)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Confidence</div>
          <div className="mt-2 text-3xl font-black text-emerald-300">{formatPercent(summary.averageConfidence)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Average Edge</div>
          <div className="mt-2 text-3xl font-black text-amber-300">{formatPercent(summary.averageEdge)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-slate-400">Bookmakers / Stale</div>
          <div className="mt-2 text-xl font-black text-white">
            {summary.averageBookmakerCount.toFixed(1)} / {summary.stalePicks}
          </div>
        </div>
      </section>

      <Panel title="Top consensus opportunities" subtitle="Parhaat hinnat suhteessa no-vig-konsensukseen">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {!loading && picks.length === 0 && (
            <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">
              Riittävän laadukkaita kohteita ei löytynyt. SKIP on hyväksytty tulos.
            </div>
          )}
          {picks.slice(0, 9).map((pick) => {
            const decision = pick.productDecision || "CAUTION";
            return (
              <article key={pick.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${decisionTone(decision)}`}>
                    {decision}
                  </span>
                  <span className="text-xs text-slate-500">{pick.leagueTitle || pick.league}</span>
                </div>
                <h2 className="mt-4 text-lg font-black text-white">{pick.match}</h2>
                <div className="mt-1 font-bold text-emerald-300">
                  {pick.selection} · {Number(pick.odds || 0).toFixed(2)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="text-slate-500">Consensus</div>
                    <div className="font-black text-white">{formatPercent(pick.consensusProbability || pick.modelProbability)}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="text-slate-500">Fair odds</div>
                    <div className="font-black text-white">{pick.fairOdds ? Number(pick.fairOdds).toFixed(2) : "–"}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="text-slate-500">Edge / EV</div>
                    <div className="font-black text-white">{formatPercent(pick.edge)} / {formatPercent(pick.ev)}</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="text-slate-500">Confidence</div>
                    <div className="font-black text-white">{formatPercent(pick.confidence)}</div>
                  </div>
                </div>
                <div className="mt-4 text-xs leading-5 text-slate-400">
                  {pick.bookmakerCount || 0} bookmakers · {pick.freshnessLabel || "unknown"} · best price at {pick.bookmaker || "unknown"}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="Positive Signals" subtitle="Aineistoa tukevat signaalit">
          <div className="space-y-3">
            {summary.positiveSignals.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Ei vahvistavia signaaleja.</div>
            )}
            {summary.positiveSignals.slice(0, 20).map((item, index) => (
              <div key={`${item.match}-${index}`} className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm">
                <div className="font-bold text-emerald-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Negative Signals" subtitle="Riskit ja varoitukset">
          <div className="space-y-3">
            {summary.negativeSignals.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Ei erityisiä varoituksia.</div>
            )}
            {summary.negativeSignals.slice(0, 20).map((item, index) => (
              <div key={`${item.match}-${index}`} className="rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm">
                <div className="font-bold text-red-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.note}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Missing Data" subtitle="Miksi kohde ei ehkä ansaitse PLAY-päätöstä">
          <div className="space-y-3">
            {summary.missingData.length === 0 && (
              <div className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-400">Ei tunnistettuja aineistopuutteita.</div>
            )}
            {summary.missingData.slice(0, 20).map((item, index) => (
              <div key={`${item.match}-${item.item}-${index}`} className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 text-sm">
                <div className="font-bold text-yellow-300">{item.match}</div>
                <div className="mt-1 text-slate-300">{item.item}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
