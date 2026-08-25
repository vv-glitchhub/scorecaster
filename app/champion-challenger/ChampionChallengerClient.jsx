"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";
import { buildChampionChallengerScorecard } from "../../lib/champion-challenger-v1.mjs";

const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "–";
const num = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

export default function ChampionChallengerClient() {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: false, loaded: false, error: "", payload: null });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/model-holdout?days=180", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Holdout evidence unavailable");
      setState({ loading: false, loaded: true, error: "", payload });
    } catch (error) {
      setState({ loading: false, loaded: true, error: error instanceof Error ? error.message : "Holdout evidence unavailable", payload: null });
    }
  }

  const scorecard = useMemo(() => buildChampionChallengerScorecard(state.payload?.report || {}), [state.payload]);

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Champion / Challenger V1"
        title={tr({ fi: "Voittaako uusi malli oikeasti nykyisen benchmarkin?", en: "Does a new model actually beat the current benchmark?", es: "¿Supera realmente un nuevo modelo al benchmark actual?" })}
        description={tr({ fi: "Scorecaster vertaa shadow-malleja vain samaan immutable pregame -otokseen paritettuun no-vig-markkinaan. Nykyistä tuotantobenchmarkia ei korvata automaattisesti, vaikka challenger olisi review-ready.", en: "Scorecaster compares shadow models only against no-vig market evidence paired to the same immutable pregame sample. The production benchmark is never replaced automatically, even when a challenger becomes review-ready.", es: "Scorecaster compara modelos shadow solo contra evidencia no-vig emparejada en la misma muestra prepartido. El benchmark de producción nunca se sustituye automáticamente." })}
        actions={<><button type="button" onClick={() => void load()} className="sc-button-primary" disabled={state.loading}>{state.loading ? tr({ fi: "Lasketaan…", en: "Evaluating…", es: "Evaluando…" }) : tr({ fi: "Laske 180 päivän scorecard", en: "Evaluate 180-day scorecard", es: "Evaluar scorecard 180 días" })}</button><Link href="/zero-cost-football-lab" className="sc-button-secondary">Zero-Cost Football Lab</Link><Link href="/model-lab" className="sc-button-secondary">Model Lab</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Production benchmark</div><div className="mt-2 text-xl font-black text-[var(--sc-text)]">{scorecard.champion.label}</div><div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">independentPredictiveModel=false<br />automatic replacement=false</div></div>}
      />

      {!state.loaded && <div className="sc-surface rounded-2xl p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Holdout-tuloshaku käynnistyy vain pyynnöstä, jotta sivun avaus ei kuluta provider-resursseja.", en: "Holdout result-provider work starts only on request so opening the page does not consume provider resources.", es: "La evaluación holdout se ejecuta solo bajo petición para no consumir recursos al abrir la página." })}</div>}
      {state.error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{state.error}</div>}

      {state.loaded && !state.error && <>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Challengers</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{scorecard.challengers.length}</div></div>
          <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Human review queue</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{scorecard.reviewQueue.length}</div></div>
          <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Auto promotions</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">0</div></div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {scorecard.challengers.map((model, index) => <article key={model.modelVersion || model.modelId || index} className="sc-surface rounded-[1.6rem] p-5">
            <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">#{index + 1} CHALLENGER · {model.status}</div><h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">{model.modelId || "unknown"}</h2><div className="mt-1 text-xs text-[var(--sc-muted)]">{model.modelVersion || "–"} · {model.sport || "unknown"}</div></div><div className="text-right text-xs text-[var(--sc-muted)]">n={model.sampleSize}<br />paired={model.pairedSampleSize}</div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier skill</div><div className="font-black text-[var(--sc-text)]">{pct(model.brierSkillScore)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Log improvement</div><div className="font-black text-[var(--sc-text)]">{num(model.logLossImprovement)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier</div><div className="font-black text-[var(--sc-text)]">{num(model.brier)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Evidence score</div><div className="font-black text-[var(--sc-text)]">{model.evidenceScore.toFixed(1)}</div></div>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--sc-border)] p-3 text-xs leading-5 text-[var(--sc-muted)]">Beats market Brier: <strong>{String(model.beatsMarketOnBrier ?? "unknown")}</strong> · Beats market log loss: <strong>{String(model.beatsMarketOnLogLoss ?? "unknown")}</strong> · Full comparable sample: <strong>{String(model.fullComparableSample)}</strong> · production weight: <strong>NO</strong></div>
          </article>)}
        </section>

        {scorecard.challengers.length === 0 && <div className="sc-surface rounded-2xl p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Challenger-holdout-evidenssiä ei vielä ole. Tila on collecting, ei epäonnistuminen eikä nollaksi täytetty tulos.", en: "No challenger holdout evidence is available yet. This is a collecting state, not a failure or a zero-filled result.", es: "Aún no hay evidencia holdout de challengers. Es un estado de recolección, no un fallo." })}</div>}
      </>}

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-5 text-[var(--sc-muted)]">100+ paired immutable pregame rows required for skill review · positive Brier skill required · improved log loss required · automaticPromotion=false · rankingCanUpgradeDecision=false · paper-only</section>
    </div>
  );
}
