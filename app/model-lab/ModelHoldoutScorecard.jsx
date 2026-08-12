"use client";

import { useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function number(value, digits = 4) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "—";
}

function percent(value, digits = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(digits)}%` : "—";
}

function clean(value) {
  return String(value || "—").replaceAll("-", " ");
}

function modelStatus(model = {}) {
  const skill = model.marketBenchmark || {};
  if (skill.skillClaimAllowed === true) return "PROVEN VS MARKET";
  if (skill.reviewEligible === true) return "MARKET-SKILL REVIEW";
  if (model.status === "review-ready") return "HOLDOUT REVIEW";
  if (model.status === "research") return "RESEARCH";
  return "COLLECTING";
}

function sortedModels(models = []) {
  return [...models].sort((left, right) => {
    const leftClaim = left?.marketBenchmark?.skillClaimAllowed === true ? 1 : 0;
    const rightClaim = right?.marketBenchmark?.skillClaimAllowed === true ? 1 : 0;
    if (leftClaim !== rightClaim) return rightClaim - leftClaim;
    const leftReview = left?.marketBenchmark?.reviewEligible === true ? 1 : 0;
    const rightReview = right?.marketBenchmark?.reviewEligible === true ? 1 : 0;
    if (leftReview !== rightReview) return rightReview - leftReview;
    const leftSkill = Number(left?.marketBenchmark?.brierSkillScore);
    const rightSkill = Number(right?.marketBenchmark?.brierSkillScore);
    if (Number.isFinite(leftSkill) && Number.isFinite(rightSkill) && leftSkill !== rightSkill) return rightSkill - leftSkill;
    return Number(right?.sampleSize || 0) - Number(left?.sampleSize || 0);
  });
}

export default function ModelHoldoutScorecard() {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: false, loaded: false, error: "", payload: null });

  async function loadHoldout() {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/model-holdout?days=180", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Holdout report unavailable");
      setState({ loading: false, loaded: true, error: "", payload });
    } catch (error) {
      setState({ loading: false, loaded: true, error: error instanceof Error ? error.message : "Holdout report unavailable", payload: null });
    }
  }

  const report = state.payload?.report || null;
  const models = sortedModels(Array.isArray(report?.models) ? report.models : []);
  const collection = state.payload?.collection || {};

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-model-holdout-scorecard-v1="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Model Research Scorecard V1</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">
            {tr({ fi: "Todisteet: malli vastaan markkina", en: "Evidence: model versus market", es: "Evidencia: modelo frente al mercado" })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Raportti ladataan vain pyynnöstä, koska holdout voi hakea tuloksia usealle liigalle. Scorecaster ei kutsu mallia markkinaa paremmaksi ennen 100+ samaan pregame-otokseen paritettua riviä, positiivista Brier Skill Scorea ja parempaa log lossia.",
              en: "The report loads only on request because holdout evaluation may fetch results for multiple leagues. Scorecaster does not call a model better than market before 100+ paired pregame rows, positive Brier Skill Score and improved log loss.",
              es: "El informe se carga solo bajo petición porque el holdout puede consultar resultados de varias ligas. Scorecaster no declara que un modelo supere al mercado sin 100+ filas prepartido emparejadas, Brier Skill Score positivo y mejor log loss."
            })}
          </p>
        </div>
        <button type="button" onClick={() => void loadHoldout()} disabled={state.loading} className="sc-button-primary disabled:opacity-50">
          {state.loading ? tr({ fi: "Lasketaan…", en: "Evaluating…", es: "Evaluando…" }) : state.loaded ? tr({ fi: "Päivitä scorecard", en: "Refresh scorecard", es: "Actualizar scorecard" }) : tr({ fi: "Laske 180 päivän holdout", en: "Evaluate 180-day holdout", es: "Evaluar holdout de 180 días" })}
        </button>
      </div>

      {!state.loaded && (
        <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">
          {tr({ fi: "Ei automaattista tuloshakua sivun avauksessa. Paina nappia, kun haluat päivitetyn tutkimusraportin.", en: "No automatic result-provider work on page load. Request the current research report when needed.", es: "No se consultan resultados automáticamente al abrir la página. Solicita el informe cuando lo necesites." })}
        </div>
      )}

      {state.error && <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{state.error}</div>}

      {state.loaded && !state.error && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Status", clean(state.payload?.status)],
              ["Shadow snapshots", collection.shadowSnapshotRows ?? 0],
              ["Settled", report?.counts?.settledEvaluations ?? 0],
              ["Market paired", report?.counts?.marketComparableEvaluations ?? 0],
              ["Models", report?.counts?.models ?? 0]
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{value}</div></div>)}
          </div>

          {models.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--sc-muted)]">
              {tr({ fi: "Advanced shadow -ennusteita ei vielä ole tarpeeksi arvioitavaksi. Tämä on collecting-tila, ei virhe eikä nollaksi täytetty tulos.", en: "There are not yet enough advanced shadow predictions to evaluate. This is a collecting state, not an error or a zero-filled result.", es: "Aún no hay suficientes predicciones shadow avanzadas. Es un estado de recolección, no un error ni un resultado rellenado con ceros." })}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {models.map((model) => {
                const skill = model.marketBenchmark || {};
                return (
                  <article key={model.modelVersion || model.modelId} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-brand)]">{clean(model.sport)} · {modelStatus(model)}</div>
                        <div className="mt-1 font-black text-[var(--sc-text)]">{model.modelId || model.modelVersion || "unknown model"}</div>
                        <div className="mt-1 text-xs text-[var(--sc-muted)]">{model.modelVersion || "—"}</div>
                      </div>
                      <div className="text-right text-xs text-[var(--sc-muted)]"><div>N={model.sampleSize || 0}</div><div>paired={skill.sampleSize || 0}</div></div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ["Brier", number(model.brier)],
                        ["Log loss", number(model.logLoss)],
                        ["Cal gap", number(model.calibrationGap)],
                        ["Brier skill", percent(skill.brierSkillScore)]
                      ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-2.5"><div className="text-[9px] font-black uppercase text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-sm font-black text-[var(--sc-text)]">{value}</div></div>)}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                      <div className="rounded-xl border border-[var(--sc-border)] p-3 text-[var(--sc-muted)]">Market Brier: <strong className="text-[var(--sc-text)]">{number(skill.marketBrier)}</strong><br />Model paired Brier: <strong className="text-[var(--sc-text)]">{number(skill.modelBrierOnBenchmarkRows)}</strong></div>
                      <div className="rounded-xl border border-[var(--sc-border)] p-3 text-[var(--sc-muted)]">Market log loss: <strong className="text-[var(--sc-text)]">{number(skill.marketLogLoss)}</strong><br />Improvement: <strong className="text-[var(--sc-text)]">{number(skill.logLossImprovement)}</strong></div>
                    </div>

                    <div className="mt-3 rounded-xl border border-[var(--sc-border)] p-3 text-xs leading-5 text-[var(--sc-muted)]">
                      Skill claim allowed: <strong className="text-[var(--sc-text)]">{skill.skillClaimAllowed === true ? "YES" : "NO"}</strong> · Market-skill review: <strong className="text-[var(--sc-text)]">{skill.reviewEligible === true ? "YES" : "NO"}</strong> · Ensemble weight: <strong className="text-[var(--sc-text)]">NO</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-5 text-[var(--sc-muted)]">
            Market benchmark is comparison-only, never an independent Ensemble vote. Automatic promotion: false · Performance weight generated automatically: false · Production probability changed: false · Paper-only: true.
          </div>
        </>
      )}
    </section>
  );
}
