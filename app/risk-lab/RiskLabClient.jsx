"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { EmptyState, MetricTile, PageHero, SectionHeader } from "../components/ProductUI";

const pct = (value, digits = 1) => Number.isFinite(Number(value))
  ? `${(Number(value) * 100).toFixed(digits)} %`
  : "–";
const money = (value, locale = "fi-FI") => new Intl.NumberFormat(locale, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
}).format(Number(value || 0));
const decimal = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function pickIdentity(pick = {}) {
  return String(pick.eventId || pick.gameId || pick.id || "");
}

function normalizePick(pick = {}, index = 0) {
  const eventId = pickIdentity(pick);
  const selection = String(pick.selection || pick.label || `${pick.homeTeam || "Home"} / ${pick.awayTeam || "Away"}`);
  const marketProbability = Number(pick.marketProbability ?? pick.consensusProbability ?? pick.impliedProbability);
  const modelProbability = Number(pick.modelProbability ?? pick.consensusProbability ?? pick.probability);
  return {
    id: String(pick.id || `${eventId}:${selection}:${index}`),
    eventId,
    sport: String(pick.sport || pick.sportKey || pick.sport_key || "unknown"),
    league: String(pick.leagueTitle || pick.league || pick.sportTitle || "unknown"),
    selection,
    bookmaker: String(pick.bookmaker || "best available"),
    odds: Number(pick.odds),
    modelProbability,
    marketProbability,
    correlationGroup: eventId ? `event:${eventId}` : null,
    correlationCoefficient: 0.45,
    sourceDecision: String(pick.productDecision || pick.decision || "CAUTION")
  };
}

function ScenarioCard({ scenario, locale, tr }) {
  const selected = scenario?.selectedKelly;
  const flat = scenario?.flatStaking;
  const zero = scenario?.zeroBet;
  return (
    <section className="sc-surface rounded-[1.55rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{scenario?.scenario}</div>
          <h3 className="mt-1 text-xl font-black text-[var(--sc-text)]">{tr({ fi: "Skenaariovertailu", en: "Scenario comparison", es: "Comparación de escenarios" })}</h3>
        </div>
        <div className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-black text-[var(--sc-muted)]">
          {selected?.simulations || 0} sim
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {[
          [tr({ fi: "Rajattu Kelly", en: "Bounded Kelly", es: "Kelly limitado" }), selected],
          [tr({ fi: "Tasapanos", en: "Flat staking", es: "Apuesta fija" }), flat],
          [tr({ fi: "Nollapanos", en: "Zero-bet baseline", es: "Base sin apuesta" }), zero]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{label}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricTile compact label="P05" value={money(value?.endingBankroll?.p05, locale)} />
              <MetricTile compact label={tr({ fi: "Mediaani", en: "Median", es: "Mediana" })} value={money(value?.endingBankroll?.median, locale)} tone="blue" />
              <MetricTile compact label={tr({ fi: "Tappioriski", en: "Loss risk", es: "Riesgo de pérdida" })} value={pct(value?.probabilityOfLoss)} tone="yellow" />
              <MetricTile compact label={tr({ fi: "Ruin-riski", en: "Ruin risk", es: "Riesgo de ruina" })} value={pct(value?.riskOfRuin)} tone="red" />
            </div>
            <div className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">
              {tr({ fi: "P95 drawdown", en: "P95 drawdown", es: "Drawdown P95" })}: {pct(value?.maximumDrawdown?.p95)} · {tr({ fi: "P95 tappioputki", en: "P95 losing streak", es: "Racha negativa P95" })}: {decimal(value?.losingStreak?.p95, 0)}
            </div>
          </div>
        ))}
      </div>
      {scenario?.assumptions && (
        <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3 text-xs leading-5 text-[var(--sc-muted)]">
          {tr({ fi: "Stressioletukset", en: "Stress assumptions", es: "Supuestos de estrés" })}: edge shrink {pct(scenario.assumptions.overconfidenceShrink)} · probability shock {pct(scenario.assumptions.probabilityShock)} · net-odds deterioration {pct(scenario.assumptions.priceDeterioration)}
        </div>
      )}
    </section>
  );
}

export default function RiskLabClient() {
  const { tr, locale } = useLanguage();
  const [available, setAvailable] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bankroll, setBankroll] = useState("1000");
  const [simulations, setSimulations] = useState("1500");
  const [rounds, setRounds] = useState("100");
  const [seed, setSeed] = useState("scorecaster-risk-lab-v1");
  const [kellyMode, setKellyMode] = useState("quarter");
  const [riskProfile, setRiskProfile] = useState("balanced");
  const [overconfidenceShrink, setOverconfidenceShrink] = useState("0.50");
  const [priceDeterioration, setPriceDeterioration] = useState("0.08");
  const [probabilityShock, setProbabilityShock] = useState("0.02");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const loadPicks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/top-picks", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Top picks unavailable");
      const rows = (Array.isArray(payload?.data) ? payload.data : [])
        .map(normalizePick)
        .filter((pick) => pick.eventId && pick.odds > 1 && pick.modelProbability > 0 && pick.modelProbability < 1)
        .slice(0, 12);
      setAvailable(rows);
      setSelectedIds((current) => current.length ? current.filter((id) => rows.some((pick) => pick.id === id)) : rows
        .filter((pick) => pick.sourceDecision !== "SKIP")
        .slice(0, 5)
        .map((pick) => pick.id));
    } catch (loadError) {
      setAvailable([]);
      setSelectedIds([]);
      setError(loadError instanceof Error ? loadError.message : "Top picks unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPicks(); }, [loadPicks]);

  const selectedPicks = useMemo(
    () => available.filter((pick) => selectedIds.includes(pick.id)),
    [available, selectedIds]
  );

  function togglePick(id) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length >= 10 ? current : [...current, id]);
  }

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/risk-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankroll: Number(bankroll),
          simulations: Number(simulations),
          rounds: Number(rounds),
          seed,
          kellyMode,
          riskProfile,
          picks: selectedPicks,
          stress: {
            overconfidenceShrink: Number(overconfidenceShrink),
            priceDeterioration: Number(priceDeterioration),
            probabilityShock: Number(probabilityShock)
          }
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Risk simulation failed");
      setResult(payload);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Risk simulation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHero
        tone="purple"
        eyebrow="Bankroll Risk Lab V1"
        title={tr({ fi: "Näe vaihtelu ennen paperipanosta", en: "See variance before a paper stake", es: "Observa la variación antes de una apuesta simulada" })}
        description={tr({
          fi: "Toistettava Monte Carlo -laboratorio vertaa rajattua Kellyä, tasapanosta ja nollapanosta. Korrelaatio pienentää panosta ja kovat riskirajat ohittavat aina Kelly-tuloksen.",
          en: "A reproducible Monte Carlo lab compares bounded Kelly, flat staking and a zero-bet baseline. Correlation reduces exposure and hard risk caps always override Kelly.",
          es: "Un laboratorio Monte Carlo reproducible compara Kelly limitado, apuesta fija y una base sin apuesta. La correlación reduce la exposición y los límites duros siempre prevalecen."
        })}
        actions={
          <>
            <button type="button" onClick={() => void run()} disabled={running || selectedPicks.length === 0} className="sc-button-primary disabled:opacity-50">
              {running ? tr({ fi: "Simuloidaan…", en: "Simulating…", es: "Simulando…" }) : tr({ fi: "Aja riskisimulaatio", en: "Run risk simulation", es: "Ejecutar simulación" })}
            </button>
            <button type="button" onClick={() => void loadPicks()} className="sc-button-secondary">{tr({ fi: "Päivitä kohteet", en: "Refresh picks", es: "Actualizar selecciones" })}</button>
          </>
        }
        aside={
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Paper-only</div>
            <div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{selectedPicks.length} / {available.length}</div>
            <div className="mt-1 text-sm text-[var(--sc-muted)]">{tr({ fi: "valittua kohdetta", en: "selected picks", es: "selecciones" })}</div>
            <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-200">
              {tr({ fi: "Simulaatio ei lupaa tuottoa eikä aseta oikeita vetoja.", en: "The simulation does not promise returns or place real bets.", es: "La simulación no promete rentabilidad ni realiza apuestas reales." })}
            </div>
          </div>
        }
      />

      {error && <div className="rounded-[1.2rem] border border-rose-400/25 bg-rose-400/10 p-4 text-rose-200">{error}</div>}

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader
          eyebrow={tr({ fi: "Vaihe 1", en: "Step 1", es: "Paso 1" })}
          title={tr({ fi: "Valitse paperikohteet", en: "Choose paper selections", es: "Elige selecciones simuladas" })}
          description={tr({ fi: "Saman tapahtuman kohteet käsitellään korreloituina. Enintään kymmenen kohdetta yhteen ajoon.", en: "Selections from the same event are treated as correlated. Up to ten selections per run.", es: "Las selecciones del mismo evento se tratan como correlacionadas. Máximo diez por ejecución." })}
        />
        {loading ? (
          <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ladataan varmennettuja kohteita…", en: "Loading verified picks…", es: "Cargando selecciones verificadas…" })}</div>
        ) : available.length === 0 ? (
          <EmptyState title={tr({ fi: "Simuloitavia kohteita ei ole", en: "No picks are available to simulate", es: "No hay selecciones para simular" })} description={tr({ fi: "Risk Lab ei keksi puuttuvia todennäköisyyksiä tai kertoimia.", en: "Risk Lab does not invent missing probabilities or prices.", es: "Risk Lab no inventa probabilidades ni cuotas ausentes." })} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {available.map((pick) => {
              const active = selectedIds.includes(pick.id);
              return (
                <button key={pick.id} type="button" aria-pressed={active} onClick={() => togglePick(pick.id)} className={`rounded-[1.25rem] border p-4 text-left transition ${active ? "border-[var(--sc-brand)] bg-[var(--sc-brand-soft)]" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-[var(--sc-text)]">{pick.selection}</div>
                      <div className="mt-1 text-xs text-[var(--sc-muted)]">{pick.league} · {pick.bookmaker}</div>
                    </div>
                    <div className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-black text-[var(--sc-text)]">{decimal(pick.odds)}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MetricTile compact label={tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" })} value={pct(pick.modelProbability)} />
                    <MetricTile compact label={tr({ fi: "Markkina", en: "Market", es: "Mercado" })} value={pct(pick.marketProbability)} />
                    <MetricTile compact label={tr({ fi: "Tila", en: "State", es: "Estado" })} value={pick.sourceDecision} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow={tr({ fi: "Vaihe 2", en: "Step 2", es: "Paso 2" })} title={tr({ fi: "Aseta toistettava koe", en: "Configure a reproducible test", es: "Configura una prueba reproducible" })} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Paperikassa €", en: "Paper bankroll €", es: "Banca simulada €" })}<input value={bankroll} onChange={(event) => setBankroll(event.target.value)} inputMode="decimal" className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Simulaatioita", en: "Simulations", es: "Simulaciones" })}<input value={simulations} onChange={(event) => setSimulations(event.target.value)} inputMode="numeric" className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Kierroksia", en: "Rounds", es: "Rondas" })}<input value={rounds} onChange={(event) => setRounds(event.target.value)} inputMode="numeric" className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Seed<input value={seed} onChange={(event) => setSeed(event.target.value)} className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Kelly<select value={kellyMode} onChange={(event) => setKellyMode(event.target.value)} className="sc-input mt-2 w-full"><option value="full">Full Kelly</option><option value="half">Half Kelly</option><option value="quarter">Quarter Kelly</option><option value="conservative">1/8 Kelly</option></select></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Riskiprofiili", en: "Risk profile", es: "Perfil de riesgo" })}<select value={riskProfile} onChange={(event) => setRiskProfile(event.target.value)} className="sc-input mt-2 w-full"><option value="defensive">Defensive</option><option value="conservative">Conservative</option><option value="balanced">Balanced</option></select></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Edge shrink<input value={overconfidenceShrink} onChange={(event) => setOverconfidenceShrink(event.target.value)} inputMode="decimal" className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Price deterioration<input value={priceDeterioration} onChange={(event) => setPriceDeterioration(event.target.value)} inputMode="decimal" className="sc-input mt-2 w-full" /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">Probability shock<input value={probabilityShock} onChange={(event) => setProbabilityShock(event.target.value)} inputMode="decimal" className="sc-input mt-2 w-full" /></label>
        </div>
      </section>

      {result && (
        <>
          <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
            <SectionHeader eyebrow={tr({ fi: "Panossuunnitelma", en: "Stake plan", es: "Plan de importes" })} title={tr({ fi: "Kelly ei ohita turvarajoja", en: "Kelly never overrides safety caps", es: "Kelly nunca supera los límites" })} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label={tr({ fi: "Suunniteltu altistus", en: "Planned exposure", es: "Exposición prevista" })} value={money(result.stakePlan?.exposure?.plannedStake, locale)} tone="blue" />
              <MetricTile label={tr({ fi: "Osuus kassasta", en: "Bankroll share", es: "Parte de la banca" })} value={pct(result.stakePlan?.exposure?.plannedFraction)} />
              <MetricTile label={tr({ fi: "Valintakatto", en: "Selection cap", es: "Límite por selección" })} value={pct(result.stakePlan?.caps?.selection)} tone="green" />
              <MetricTile label={tr({ fi: "Kokonaiskatto", en: "Portfolio cap", es: "Límite de cartera" })} value={pct(result.stakePlan?.caps?.portfolio)} tone="green" />
            </div>
            {result.stakePlan?.overrideAttempts?.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">{tr({ fi: "Kovia rajoja ylittäneet asetukset estettiin.", en: "Requested settings above hard caps were blocked.", es: "Se bloquearon ajustes superiores a los límites duros." })}</div>}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[var(--sc-faint)]"><tr><th className="p-3">Selection</th><th className="p-3">Odds</th><th className="p-3">Full Kelly</th><th className="p-3">Penalty</th><th className="p-3">Final</th><th className="p-3">Paper stake</th><th className="p-3">Caps</th></tr></thead>
                <tbody>{(result.stakePlan?.picks || []).map((pick) => <tr key={pick.id} className="border-t border-[var(--sc-border)]"><td className="p-3 font-black text-[var(--sc-text)]">{pick.selection}<div className="text-xs font-normal text-[var(--sc-faint)]">{pick.league}</div></td><td className="p-3">{decimal(pick.odds)}</td><td className="p-3">{pct(pick.fullKellyFraction)}</td><td className="p-3">{decimal(pick.correlationPenalty)}</td><td className="p-3 font-black">{pct(pick.finalFraction)}</td><td className="p-3 font-black text-[var(--sc-brand)]">{money(pick.stake, locale)}</td><td className="p-3 text-xs text-[var(--sc-muted)]">{pick.capReasons?.join(", ") || "none"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <div className="space-y-5">{(result.scenarios || []).map((scenario) => <ScenarioCard key={scenario.scenario} scenario={scenario} locale={locale} tr={tr} />)}</div>

          <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
            <SectionHeader eyebrow={tr({ fi: "Auditointi", en: "Audit", es: "Auditoría" })} title={tr({ fi: "Menetelmä ja rajat", en: "Method and boundaries", es: "Método y límites" })} />
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(result.methodology || {}).map(([key, value]) => <div key={key} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-xs font-black uppercase text-[var(--sc-brand)]">{key}</div><div className="mt-2 text-sm leading-6 text-[var(--sc-text-secondary)]">{value}</div></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--sc-border)] p-4 text-sm leading-6 text-[var(--sc-muted)]">
              seed={result.input?.seed} · version={result.version} · hardCapsCanBeOverridden=false · realMoneyExecution=false
            </div>
          </section>
        </>
      )}
    </div>
  );
}
