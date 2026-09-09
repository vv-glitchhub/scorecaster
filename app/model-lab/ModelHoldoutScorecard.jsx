"use client";

import { useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { formatValidationMetric, validationNumber, VALIDATION_REVIEW_POLICY as policy } from "../../lib/validation-lab-v1.mjs";
import ModelValidationSummary from "./ModelValidationSummary";

function number(value, digits = 4) {
  return formatValidationMetric(value, { digits });
}

function percent(value, digits = 1) {
  return formatValidationMetric(value, { percent: true, digits });
}

function clean(value) {
  return String(value || "—").replaceAll("-", " ");
}

function modelStatus(model = {}) {
  const skill = model.marketBenchmark || {};
  if (model.validationEvidence?.stage === "research-review") return "RESEARCH REVIEW";
  if (skill.reviewEligible === true) return "MARKET-SKILL REVIEW";
  if (model.status === "review-ready") return "HOLDOUT REVIEW";
  if (model.status === "research") return "RESEARCH";
  return "COLLECTING";
}

function sortedModels(models = []) {
  return [...models].sort((left, right) => {
    const leftClaim = left?.validationEvidence?.stage === "research-review" ? 1 : 0;
    const rightClaim = right?.validationEvidence?.stage === "research-review" ? 1 : 0;
    if (leftClaim !== rightClaim) return rightClaim - leftClaim;
    const leftReview = left?.marketBenchmark?.reviewEligible === true ? 1 : 0;
    const rightReview = right?.marketBenchmark?.reviewEligible === true ? 1 : 0;
    if (leftReview !== rightReview) return rightReview - leftReview;
    const leftSkill = validationNumber(left?.marketBenchmark?.brierSkillScore);
    const rightSkill = validationNumber(right?.marketBenchmark?.brierSkillScore);
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
      const response = await fetch("/api/model-holdout?days=180", { cache: "no-store", signal: AbortSignal.timeout(55_000) });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Holdout report unavailable");
      setState({ loading: false, loaded: true, error: "", payload });
    } catch (error) {
      setState({ loading: false, loaded: true, error: error?.name === "TimeoutError" ? tr({ fi: "Laskenta kesti liian kauan. Yritä uudelleen.", en: "Evaluation timed out. Please try again.", es: "La evaluación tardó demasiado. Inténtalo de nuevo." }) : tr({ fi: "Testiraporttia ei saada juuri nyt. Yritä uudelleen.", en: "The validation report is unavailable. Please try again.", es: "El informe no está disponible. Inténtalo de nuevo." }), payload: null });
    }
  }

  const report = state.payload?.report || null;
  const models = sortedModels(Array.isArray(report?.models) ? report.models : []);
  const collection = state.payload?.collection || {};
  const readiness = collection.advancedModelReadiness || {};
  const readinessModels = Array.isArray(readiness.models) ? readiness.models : [];

  return (
    <section id="validation-lab" className="sc-surface scroll-mt-24 rounded-[1.65rem] p-5 sm:p-6" data-model-holdout-scorecard-v1="true" aria-busy={state.loading}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Validation Lab V1</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">
            {tr({ fi: "Todisteet: malli vastaan markkina", en: "Evidence: model versus market", es: "Evidencia: modelo frente al mercado" })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Kuinka hyvin riippumattomat tutkimusmallit ennustavat? Vertaa ennen ottelua tallennettuja arvioita lopputuloksiin ja saman ottelun markkinahintaan. Näet otoskoon, puuttuvat todisteet ja kuukausittaisen kehityksen. Historiallinen vertailu ei vielä osoita tulevaa tuottavuutta.",
              en: "How well do independent research models predict? Compare pregame snapshots with final results and the same event's market benchmark. Inspect sample size, missing evidence and monthly performance. A historical comparison does not establish future profitability.",
              es: "¿Qué precisión tienen los modelos independientes de investigación? Compara predicciones previas con resultados finales y el mercado del mismo evento. Consulta el tamaño de muestra, la evidencia pendiente y la evolución mensual. Una comparación histórica no demuestra rentabilidad futura."
            })}
          </p>
        </div>
        <button type="button" onClick={() => void loadHoldout()} disabled={state.loading} className="sc-button-primary disabled:opacity-50">
          {state.loading ? tr({ fi: "Lasketaan…", en: "Evaluating…", es: "Evaluando…" }) : state.loaded ? tr({ fi: "Päivitä scorecard", en: "Refresh scorecard", es: "Actualizar scorecard" }) : tr({ fi: "Laske 180 päivän holdout", en: "Evaluate 180-day holdout", es: "Evaluar holdout de 180 días" })}
        </button>
      </div>

      <details className="mt-4 rounded-xl border border-[var(--sc-border)] p-4">
        <summary className="cursor-pointer text-sm font-bold text-[var(--sc-text)]">{tr({ fi: "Miten testinäyttö arvioidaan?", en: "How is validation evidence assessed?", es: "¿Cómo se evalúa la evidencia?" })}</summary>
        <p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{tr({
          fi: `Tutkimusarvioon tarvitaan vähintään ${policy.minimumPairedEvents} ottelua, markkinavertailu jokaiselle arvioidulle ottelulle, pienempi Brier-virhe ja log loss sekä toistuva parannus vähintään ${policy.minimumCompleteMonths} päättyneessä kuukaudessa (${policy.minimumEventsPerMonth}+ ottelua/kuukausi). Nämä ovat version ${policy.version} tutkimusrajoja, eivät todistettuja tuottavuusrajoja.`,
          en: `Research review needs at least ${policy.minimumPairedEvents} events, a benchmark for every evaluated event, lower Brier error and log loss, and repeated improvement across ${policy.minimumCompleteMonths} completed months (${policy.minimumEventsPerMonth}+ events/month). These are research rules in ${policy.version}, not proven profitability thresholds.`,
          es: `La revisión requiere al menos ${policy.minimumPairedEvents} eventos, referencia para cada evento, menor Brier y log loss y mejora repetida durante ${policy.minimumCompleteMonths} meses completos (${policy.minimumEventsPerMonth}+ eventos/mes). Son reglas de investigación de ${policy.version}, no umbrales de rentabilidad demostrada.`
        })}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Historiallisia tuloksia ei merkitä jälkikäteen ennakkoon rekisteröidyksi testiksi. Mallin tuotantohyväksyntä edellyttää erillistä testisuunnitelmaa, koulutusaineiston ajallista varmennusta ja arviointia.", en: "Historical results are not retroactively labeled preregistered. Production approval requires a separate test protocol, verified training chronology and review.", es: "Los resultados históricos no se etiquetan retrospectivamente como preregistrados. La aprobación requiere protocolo separado, cronología de entrenamiento verificada y revisión." })}</p>
      </details>

      {!state.loaded && (
        <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">
          {tr({ fi: "Ei automaattista tuloshakua sivun avauksessa. Paina nappia, kun haluat päivitetyn tutkimusraportin.", en: "No automatic result-provider work on page load. Request the current research report when needed.", es: "No se consultan resultados automáticamente al abrir la página. Solicita el informe cuando lo necesites." })}
        </div>
      )}

      {state.error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{state.error}</div>}

      {state.loaded && !state.error && (
        <>
          <p className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Raportti käsittelee riippumattomia shadow-tutkimusmalleja ja saatavilla olevaa otosta. Se ei ole kaikkien Scorecaster-mallien eikä koko 180 päivän aineiston kattavuustodistus.", en: "This report covers independent shadow research models and the available sample. It does not certify all Scorecaster models or complete 180-day coverage.", es: "Este informe cubre modelos shadow independientes y la muestra disponible. No certifica todos los modelos ni una cobertura completa de 180 días." })}</p>
          {(collection.snapshotLimitReached || collection.leagueLimitReached || collection.providerFailures?.length > 0) && <p role="status" className="mt-3 rounded-xl border border-amber-400/30 p-3 text-sm text-amber-100">{tr({ fi: "Aineisto on rajallinen: haku saavutti rajarvon tai osa tuloslähteistä ei vastannut. Tarkastele tuloksia osittaisena otoksena.", en: "Coverage is limited: the query reached a cap or some result sources were unavailable. Treat this report as a partial sample.", es: "Cobertura limitada: se alcanzó un límite o faltan fuentes de resultados. Este informe es una muestra parcial." })}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {[
              ["Status", clean(state.payload?.status)],
              ["Shadow snapshots", collection.shadowSnapshotRows ?? 0],
              ["Settled", report?.counts?.settledEvaluations ?? 0],
              ["Market paired", report?.counts?.marketComparableEvaluations ?? 0],
              ["Models", report?.counts?.models ?? 0],
              ["Advanced ready", readiness.readyEvents ?? 0],
              ["Advanced blocked", readiness.blockedEvents ?? 0]
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{value}</div></div>)}
          </div>

          {readinessModels.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4" data-advanced-model-readiness-v1="true">
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">Advanced Model Input Readiness V1</div>
              <h3 className="mt-1 text-lg font-black text-[var(--sc-text)]">
                {tr({ fi: "Mikä estää holdout-otoksen kertymisen?", en: "What is blocking holdout collection?", es: "¿Qué bloquea la recolección holdout?" })}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">
                {tr({ fi: "Näyttää viimeisimmän tilan per tapahtuma ja malli. Providerin raakavirheitä tai avaimia ei tallenneta.", en: "Shows the latest state per event and model. Raw provider errors and credentials are never retained.", es: "Muestra el último estado por evento y modelo. No se guardan errores sin procesar ni credenciales del proveedor." })}
              </p>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {readinessModels.map((model) => (
                  <div key={`readiness-${model.modelVersion || model.modelId}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-[var(--sc-text)]">{model.modelId || model.modelVersion || "advanced model"}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[var(--sc-faint)]">{clean(model.sport)}</div>
                      </div>
                      <div className="text-right text-xs text-[var(--sc-muted)]"><strong className="text-emerald-300">{model.readyEvents || 0}</strong> ready · <strong className="text-amber-300">{model.blockedEvents || 0}</strong> blocked</div>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">Provider: {Object.entries(model.providerModes || {}).map(([mode, count]) => `${clean(mode)} ${count}`).join(" · ") || "—"}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(model.topBlockers || []).length ? model.topBlockers.map((item) => <span key={item.reason} className="rounded-full border border-amber-300/20 bg-amber-300/5 px-2 py-1 text-[10px] font-bold text-amber-100">{clean(item.reason)} · {item.count}</span>) : <span className="text-xs text-emerald-300">No current input blocker</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {models.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--sc-muted)]">
              {tr({ fi: "Advanced shadow -ennusteita ei vielä ole tarpeeksi arvioitavaksi. Tämä on collecting-tila, ei virhe eikä nollaksi täytetty tulos.", en: "There are not yet enough advanced shadow predictions to evaluate. This is a collecting state, not an error or a zero-filled result.", es: "Aún no hay suficientes predicciones shadow avanzadas. Es un estado de recolección, no un error ni un resultado rellenado con ceros." })}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {models.map((model) => {
                const skill = model.marketBenchmark || {};
                return (
                  <article key={JSON.stringify([model.modelId, model.modelVersion, model.sportKey, model.league])} className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--sc-brand)]">{clean(model.sport)} · {modelStatus(model)}</div>
                        <div className="mt-1 font-black text-[var(--sc-text)]">{model.modelId || model.modelVersion || "unknown model"}</div>
                        <div className="mt-1 break-words text-xs text-[var(--sc-muted)]">{model.modelVersion || "—"} · {model.league || model.sportKey || "—"}</div>
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

                    <ModelValidationSummary evidence={model.validationEvidence} />

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
