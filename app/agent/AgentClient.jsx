"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { addTrackedBet, getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { buildAgentExcellenceDecisions } from "../../lib/agent-excellence-engine.mjs";
import { getSettings, saveSettings } from "../../lib/settings-storage";
import { formatMoney, formatPercent } from "../../lib/analysis-engine";

function decisionClass(decision) {
  if (decision === "PLAY") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (decision === "WATCH") return "border-yellow-400/30 bg-yellow-400/10 text-yellow-300";
  return "border-red-400/30 bg-red-400/10 text-red-300";
}

function freshnessLabel(pick) {
  return pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
}

export default function AgentClient() {
  const [rawPicks, setRawPicks] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [message, setMessage] = useState("");
  const [bankroll, setBankroll] = useState(1000);
  const [maxStakePercent, setMaxStakePercent] = useState(1);
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setMaxStakePercent(Number(settings.agentMaxStakePercent || 1));
    void loadAgentPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAgentPicks() {
    setLoading(true);
    setMessage("");
    try {
      const trackedBets = getTrackedBets();
      const learningData = calculateAgentPerformance(trackedBets);
      const response = await fetch("/api/top-picks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Agentin kohteita ei voitu ladata.");

      setLearning(learningData);
      setRawPicks(Array.isArray(data.data) ? data.data : []);
      setSource(data.source || "no-vig-market-consensus");
    } catch (error) {
      setRawPicks([]);
      setSource("error");
      setMessage(error instanceof Error ? error.message : "Tuntematon virhe");
    } finally {
      setLoading(false);
    }
  }

  const decisions = useMemo(() => buildAgentExcellenceDecisions(rawPicks, {
    learning,
    bankroll,
    maxStakePercent
  }), [rawPicks, learning, bankroll, maxStakePercent]);

  const visibleDecisions = useMemo(() => decisions.filter((pick) => filter === "ALL" || pick.decision === filter), [decisions, filter]);
  const counts = {
    PLAY: decisions.filter((pick) => pick.decision === "PLAY").length,
    WATCH: decisions.filter((pick) => pick.decision === "WATCH").length,
    SKIP: decisions.filter((pick) => pick.decision === "SKIP").length
  };
  const totalStake = decisions.reduce((sum, pick) => sum + Number(pick.suggestedStake || 0), 0);

  function saveAgentSettings(next) {
    saveSettings({ ...getSettings(), ...next });
  }

  function addPickToTracking(pick) {
    if (pick.decision !== "PLAY" || pick.suggestedStake <= 0) return;

    addTrackedBet({
      eventId: pick.gameId || pick.eventId || pick.id,
      match: pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`,
      homeTeam: pick.homeTeam,
      awayTeam: pick.awayTeam,
      selection: pick.selection,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      edge: pick.edge,
      ev: pick.ev,
      confidence: pick.confidence,
      modelProbability: pick.consensusProbability || pick.modelProbability,
      marketProbability: pick.marketProbability,
      fairOdds: pick.fairOdds,
      stake: pick.suggestedStake,
      bankroll,
      kellyMode: "agent-v8-quarter-kelly",
      source: "scorecaster-agent-v8-evidence",
      sportKey: pick.sportKey,
      marketKey: pick.marketKey || pick.market,
      league: pick.league,
      leagueTitle: pick.leagueTitle,
      decision: pick.decision,
      decisionReason: pick.decisionReason,
      trustScore: pick.trustScore,
      learningSampleSize: pick.learningSignal?.sampleSize || 0,
      probabilityAdjustedByLearning: false,
      evidence: pick.evidence,
      missingEvidence: pick.missingEvidence,
      riskWarnings: [
        "Agent V8 uses paper tracking only.",
        "Learning changes prioritization only after a sufficient sample; it never changes the stored probability.",
        "No result or profit is guaranteed."
      ],
      paperOnly: true
    });

    setMessage(`${pick.selection} lisättiin Agent V8 -paperiseurantaan.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Agent V8 · Evidence-first
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Scorecaster Decision Copilot</h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Agentti käyttää tuotannon no-vig-konsensusta, datan laatua ja käyttäjän paperihistoriaa. Se ei enää lisää vahvistamatonta oletuskontekstia eikä muuta todennäköisyyttä pienen voittoputken perusteella.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">PLAY</div>
            <div className="mt-1 text-3xl font-black text-emerald-300">{counts.PLAY}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">WATCH</div>
            <div className="mt-1 text-3xl font-black text-yellow-300">{counts.WATCH}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">SKIP</div>
            <div className="mt-1 text-3xl font-black text-red-300">{counts.SKIP}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm text-slate-400">Suunniteltu paperialtistus</div>
            <div className="mt-1 text-3xl font-black text-sky-300">{formatMoney(totalStake)}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Virtuaalinen pelikassa
            <input type="number" min="0" value={bankroll} onChange={(event) => { const value = Number(event.target.value || 0); setBankroll(value); saveAgentSettings({ bankroll: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Agentin enimmäispanos %
            <input type="number" min="0.1" max="5" step="0.1" value={maxStakePercent} onChange={(event) => { const value = Number(event.target.value || 1); setMaxStakePercent(value); saveAgentSettings({ agentMaxStakePercent: value }); }} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <button onClick={() => void loadAgentPicks()} disabled={loading} className="rounded-xl bg-purple-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{loading ? "Analysoidaan…" : "Päivitä agentti"}</button>
        </div>

        <div className="mt-4 text-sm text-slate-400">
          Lähde <span className="font-bold text-emerald-300">{source}</span> · oppimisotos {learning?.sampleSize || 0} ratkaistua paikallista paperivetoa
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {["ALL", "PLAY", "WATCH", "SKIP"].map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filter === item ? "border-purple-400/40 bg-purple-400/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-400"}`}>{item}</button>
        ))}
      </div>

      {message && <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">{message}</div>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {!loading && visibleDecisions.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-400">Tällä suodattimella ei ole agenttipäätöksiä.</div>}
          {visibleDecisions.map((pick, index) => {
            const id = String(pick.id || pick.gameId || `${pick.match}-${pick.selection}-${index}`);
            const expanded = expandedId === id;
            return (
              <article key={id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm text-slate-400">#{index + 1} · {pick.leagueTitle || pick.league || pick.sportKey || "Sport"}</div>
                    <h2 className="mt-1 text-xl font-black">{pick.match || `${pick.homeTeam || ""} vs ${pick.awayTeam || ""}`}</h2>
                    <p className="mt-1 text-slate-300">{pick.selection} @ {Number(pick.odds || 0).toFixed(2)} · {pick.bookmaker || "paras hinta"}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${decisionClass(pick.decision)}`}>{pick.decision}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Konsensus</div><div className="mt-1 font-black">{formatPercent(pick.consensusProbability || pick.modelProbability)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Edge</div><div className="mt-1 font-black text-emerald-300">{formatPercent(pick.edge)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">EV</div><div className="mt-1 font-black text-sky-300">{formatPercent(pick.ev)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Trust</div><div className="mt-1 font-black">{Number(pick.trustScore || 0).toFixed(0)}/100</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Paperipanos</div><div className="mt-1 font-black text-purple-300">{formatMoney(pick.suggestedStake)}</div></div>
                </div>

                <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-slate-200">{pick.decisionReason}</div>
                <div className="mt-3 text-sm text-slate-400">Data {freshnessLabel(pick)} · {pick.bookmakerCount || 0} vedonvälittäjää · prioriteetti {(Number(pick.priorityScore || 0) * 100).toFixed(0)}/100</div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setExpandedId(expanded ? null : id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">{expanded ? "Piilota evidenssi" : "Näytä evidenssi"}</button>
                  <button onClick={() => addPickToTracking(pick)} disabled={pick.decision !== "PLAY" || pick.suggestedStake <= 0} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">Lisää paperiseurantaan</button>
                </div>

                {expanded && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="font-bold text-emerald-300">Todennettu evidenssi</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.evidence.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                      <div className="font-bold text-yellow-300">Puuttuva evidenssi</div>
                      {pick.missingEvidence.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.missingEvidence.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-300">Ei tunnistettuja puutteita.</p>}
                    </div>
                    <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 lg:col-span-2">
                      <div className="font-bold text-sky-300">Oppimissignaali</div>
                      <p className="mt-2 text-sm text-slate-300">{pick.learningSignal.note} Otos {pick.learningSignal.sampleSize}. Todennäköisyyttä ei muutettu.</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel title="Agent V8 -periaate" subtitle="Mitä agentti oikeasti tekee">
            <div className="space-y-3 text-sm text-slate-300">
              <p>1. Käyttää vain Top Picks -konsensusdataa.</p>
              <p>2. Tarkistaa kattavuuden, tuoreuden, edge/EV:n ja trust scoren.</p>
              <p>3. Käyttää historiaa vasta vähintään 20 havainnon jälkeen.</p>
              <p>4. Historia voi muuttaa vain prioriteettia, ei todennäköisyyttä.</p>
              <p>5. Agentti saa sanoa WATCH tai SKIP.</p>
            </div>
          </Panel>

          <Panel title="Tuoteraja" subtitle="Paper only">
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Ei automaattista oikean rahan vetoa.</p>
              <p>• Ei vedonvälittäjätunnuksia.</p>
              <p>• Ei keksittyjä loukkaantumis- tai kokoonpanotietoja.</p>
              <p>• Ei tuottolupausta.</p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
