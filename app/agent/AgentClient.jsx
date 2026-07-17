"use client";

import { useEffect, useMemo, useState } from "react";
import Panel from "../components/Panel";
import { addTrackedBet, getTrackedBets } from "../../lib/tracking-storage";
import { calculateAgentPerformance } from "../../lib/agent-learning";
import { buildAgentV9Portfolio } from "../../lib/agent-v9-engine.mjs";
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

function optionalPercent(value) {
  return Number.isFinite(Number(value)) ? formatPercent(Number(value)) : "–";
}

function optionalNumber(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
}

function Metric({ label, value, tone = "text-slate-100" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

export default function AgentClient() {
  const [rawPicks, setRawPicks] = useState([]);
  const [learning, setLearning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const [message, setMessage] = useState("");
  const [bankroll, setBankroll] = useState(1000);
  const [maxStakePercent, setMaxStakePercent] = useState(1);
  const [maxTotalExposurePercent, setMaxTotalExposurePercent] = useState(4);
  const [maxLeagueExposurePercent, setMaxLeagueExposurePercent] = useState(2);
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const settings = getSettings();
    setBankroll(Number(settings.bankroll || 1000));
    setMaxStakePercent(Number(settings.agentMaxStakePercent || 1));
    setMaxTotalExposurePercent(Number(settings.agentMaxTotalExposurePercent || 4));
    setMaxLeagueExposurePercent(Number(settings.agentMaxLeagueExposurePercent || 2));
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

  const portfolio = useMemo(() => buildAgentV9Portfolio(rawPicks, {
    learning,
    bankroll,
    maxStakePercent,
    maxTotalExposurePercent,
    maxLeagueExposurePercent
  }), [rawPicks, learning, bankroll, maxStakePercent, maxTotalExposurePercent, maxLeagueExposurePercent]);

  const decisions = portfolio.decisions;
  const visibleDecisions = useMemo(
    () => decisions.filter((pick) => filter === "ALL" || pick.decision === filter),
    [decisions, filter]
  );

  function saveAgentSettings(next) {
    saveSettings({ ...getSettings(), ...next });
  }

  function updateNumber(setter, key, fallback, minimum, maximum) {
    return (event) => {
      const raw = Number(event.target.value);
      const value = Number.isFinite(raw) ? Math.max(minimum, Math.min(maximum, raw)) : fallback;
      setter(value);
      saveAgentSettings({ [key]: value });
    };
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
      kellyMode: "agent-v9-conservative-quarter-kelly",
      source: "scorecaster-agent-v9-adversarial-portfolio",
      sportKey: pick.sportKey,
      marketKey: pick.marketKey || pick.market,
      league: pick.league,
      leagueTitle: pick.leagueTitle,
      decision: pick.decision,
      decisionReason: pick.decisionReason,
      trustScore: pick.trustScore,
      robustnessScore: pick.robustnessScore,
      learningSampleSize: pick.learningSignal?.sampleSize || 0,
      probabilityAdjustedByLearning: false,
      uncertaintyLower: pick.stressTest?.lower,
      uncertaintyUpper: pick.stressTest?.upper,
      downsideEv: pick.stressTest?.downsideEv,
      minimumPlayOdds: pick.priceGuard?.minimumPlayOdds,
      evidence: pick.evidence,
      counterArguments: pick.counterArguments,
      missingEvidence: pick.missingEvidence,
      portfolioReason: pick.portfolioReason,
      riskWarnings: [
        "Agent V9 uses virtual paper tracking only.",
        "The probability is not changed by local learning or an LLM narrative.",
        "The stake uses the uncertainty interval's lower probability and portfolio exposure caps.",
        "No result or profit is guaranteed."
      ],
      paperOnly: true
    });

    setMessage(`${pick.selection} lisättiin Agent V9 -paperiseurantaan.`);
  }

  const learningTone = Number(learning?.roi || 0) > 0 ? "text-emerald-300" : Number(learning?.roi || 0) < 0 ? "text-red-300" : "text-slate-100";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-2 inline-flex rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-sm text-purple-300">
          Agent V9 · Adversarial Portfolio AI
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Scorecaster Decision Copilot</h1>
        <p className="mt-3 max-w-4xl text-slate-300">
          Agentti yrittää nyt myös kumota oman suosituksensa. Se stressaa todennäköisyyden alarajan, näyttää hinnan jolla etu katoaa ja rakentaa koko paperiportfolion yksittäisen kohteen sijaan.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="PLAY" value={portfolio.counts.PLAY} tone="text-emerald-300" />
          <Metric label="WATCH" value={portfolio.counts.WATCH} tone="text-yellow-300" />
          <Metric label="SKIP" value={portfolio.counts.SKIP} tone="text-red-300" />
          <Metric label="Suunniteltu altistus" value={formatMoney(portfolio.totalAllocated)} tone="text-sky-300" />
          <Metric label="Altistus kassasta" value={formatPercent(portfolio.exposurePercent)} tone="text-purple-300" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Virtuaalinen pelikassa
            <input type="number" min="0" value={bankroll} onChange={updateNumber(setBankroll, "bankroll", 1000, 0, 10000000)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Yksittäinen panos %
            <input type="number" min="0.1" max="5" step="0.1" value={maxStakePercent} onChange={updateNumber(setMaxStakePercent, "agentMaxStakePercent", 1, 0.1, 5)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Kokonaisaltistus %
            <input type="number" min="0.5" max="20" step="0.5" value={maxTotalExposurePercent} onChange={updateNumber(setMaxTotalExposurePercent, "agentMaxTotalExposurePercent", 4, 0.5, 20)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <label className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
            Liiga-altistus %
            <input type="number" min="0.25" max="10" step="0.25" value={maxLeagueExposurePercent} onChange={updateNumber(setMaxLeagueExposurePercent, "agentMaxLeagueExposurePercent", 2, 0.25, 10)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" />
          </label>
          <button onClick={() => void loadAgentPicks()} disabled={loading} className="rounded-xl bg-purple-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">
            {loading ? "Analysoidaan…" : "Päivitä Agent V9"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
          <div>Lähde <span className="font-bold text-emerald-300">{source}</span></div>
          <div>Oppimisotos <span className="font-bold text-sky-300">{learning?.sampleSize || 0}</span></div>
          <div>Historian ROI <span className={`font-bold ${learningTone}`}>{optionalPercent(learning?.roi)}</span></div>
          <div>CLV / Brier <span className="font-bold text-purple-300">{optionalPercent(learning?.averageClv)} / {optionalNumber(learning?.brierScore)}</span></div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Oppiminen vaikuttaa vain prioriteettiin riittävän otoksen jälkeen. Se ei muuta konsensustodennäköisyyttä, edgeä eikä EV:tä.
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {["ALL", "PLAY", "WATCH", "SKIP"].map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filter === item ? "border-purple-400/40 bg-purple-400/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-400"}`}>{item}</button>
        ))}
      </div>

      {message && <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">{message}</div>}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-4">
          {!loading && visibleDecisions.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-400">Tällä suodattimella ei ole agenttipäätöksiä.</div>}
          {visibleDecisions.map((pick, index) => {
            const id = String(pick.id || pick.gameId || `${pick.match}-${pick.selection}-${index}`);
            const expanded = expandedId === id;
            const stress = pick.stressTest || {};
            const priceGuard = pick.priceGuard || {};

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

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Konsensus</div><div className="mt-1 font-black">{formatPercent(stress.probability)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">95 % stressialue</div><div className="mt-1 font-black">{formatPercent(stress.lower)}–{formatPercent(stress.upper)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Perus-EV</div><div className="mt-1 font-black text-sky-300">{formatPercent(stress.baseEv)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Alarajan EV</div><div className={`mt-1 font-black ${Number(stress.downsideEv) > 0 ? "text-emerald-300" : "text-red-300"}`}>{formatPercent(stress.downsideEv)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Robustness</div><div className="mt-1 font-black">{formatPercent(pick.robustnessScore)}</div></div>
                  <div className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-slate-400">Paperipanos</div><div className="mt-1 font-black text-purple-300">{formatMoney(pick.suggestedStake)}</div></div>
                </div>

                <div className="mt-4 rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-sm text-slate-200">{pick.decisionReason}</div>
                {pick.portfolioReason && <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-200">Portfolio: {pick.portfolioReason}</div>}
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                  <div>Data {freshnessLabel(pick)} · {pick.bookmakerCount || 0} vedonvälittäjää</div>
                  <div>Nykyinen kerroin {Number(priceGuard.currentOdds || 0).toFixed(2)} · PLAY-raja {Number(priceGuard.minimumPlayOdds || 0).toFixed(2)}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setExpandedId(expanded ? null : id)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">{expanded ? "Piilota AI-auditointi" : "Näytä AI-auditointi"}</button>
                  <button onClick={() => addPickToTracking(pick)} disabled={pick.decision !== "PLAY" || pick.suggestedStake <= 0} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">Lisää paperiseurantaan</button>
                </div>

                {expanded && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="font-bold text-emerald-300">Todennettu evidenssi</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.evidence.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4">
                      <div className="font-bold text-red-300">AI:n vastaväite</div>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.counterArguments.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                      <div className="font-bold text-yellow-300">Puuttuva evidenssi</div>
                      {pick.missingEvidence.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{pick.missingEvidence.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-300">Ei tunnistettuja puutteita.</p>}
                    </div>
                    <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4">
                      <div className="font-bold text-sky-300">Hinta- ja päätösrajat</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        <p>Break-even-kerroin {Number(priceGuard.breakEvenOdds || 0).toFixed(2)}</p>
                        <p>3 % tavoite-EV:n minimikerroin {Number(priceGuard.minimumPlayOdds || 0).toFixed(2)}</p>
                        <p>Alarajan break-even {Number(priceGuard.conservativeBreakEvenOdds || 0).toFixed(2)}</p>
                        <p>Hintapuskuri {Number(priceGuard.buffer || 0).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 lg:col-span-2">
                      <div className="font-bold text-purple-300">Oppimissignaali</div>
                      <p className="mt-2 text-sm text-slate-300">{pick.learningSignal.note}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Segmentti {pick.learningSignal.segment || "ei valittu"} · otos {pick.learningSignal.sampleSize} · ROI {optionalPercent(pick.learningSignal.metrics?.roi)} · CLV {optionalPercent(pick.learningSignal.metrics?.averageClv)} · Brier {optionalNumber(pick.learningSignal.metrics?.brierScore)}. Todennäköisyyttä ei muutettu.
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="space-y-6">
          <Panel title="Agent V9 -päätösketju" subtitle="AI:n audit trail">
            <div className="space-y-3 text-sm text-slate-300">
              <p>1. Lukee no-vig-markkinakonsensuksen muuttamatta sitä.</p>
              <p>2. Rakentaa epävarmuusvälin kattavuudesta, hajonnasta ja tuoreudesta.</p>
              <p>3. Testaa, säilyykö EV positiivisena alarajalla.</p>
              <p>4. Muodostaa oman vastaväitteen ja listaa puuttuvan evidenssin.</p>
              <p>5. Tarkistaa hinta-, tapahtuma-, liiga- ja kokonaisaltistusrajat.</p>
              <p>6. Käyttää historiaa vain riittävällä CLV-, Brier- tai kalibrointiotoksella.</p>
              <p>7. Saa aina sanoa WATCH tai SKIP.</p>
            </div>
          </Panel>

          <Panel title="Portfolioportit" subtitle="Virtuaalinen papeririski">
            <div className="space-y-2 text-sm text-slate-300">
              <p>Kokonaiskatto: <span className="font-bold text-sky-300">{formatMoney(portfolio.totalCap)}</span></p>
              <p>Liigakohtainen katto: <span className="font-bold text-purple-300">{formatMoney(portfolio.leagueCap)}</span></p>
              <p>Yksi PLAY-valinta per tapahtuma.</p>
              <p>Alarajan Kelly, ei optimistisen keskiarvon Kelly.</p>
            </div>
          </Panel>

          <Panel title="Tuoteraja" subtitle="Paper only">
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Ei oikean rahan vetoja tai automaattista toimeksiantoa.</p>
              <p>• Ei vedonvälittäjätunnuksia tai maksutietoja.</p>
              <p>• Ei keksittyjä uutisia, kokoonpanoja tai loukkaantumisia.</p>
              <p>• Ei AI:n kirjoittamaa väitettä ilman laskettua evidenssiä.</p>
              <p>• Ei tuottolupausta.</p>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
