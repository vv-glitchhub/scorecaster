"use client";

import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";
import latest from "../../config/football-ml-challenger-v1-latest.json";

const num = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "–";

function Gate({ label, value }) {
  return <div className="rounded-xl border border-[var(--sc-border)] p-3 text-sm"><span className="font-bold text-[var(--sc-text)]">{label}</span><span className="float-right text-xs font-black text-[var(--sc-muted)]">{value === true ? "PASS" : value === false ? "BLOCKED" : "–"}</span></div>;
}

function MetricCard({ title, metric }) {
  return <article className="sc-surface rounded-[1.5rem] p-5">
    <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{title}</div>
    <div className="mt-4 grid grid-cols-3 gap-3">
      <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier ↓</div><div className="font-black text-[var(--sc-text)]">{num(metric?.brier)}</div></div>
      <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Log loss ↓</div><div className="font-black text-[var(--sc-text)]">{num(metric?.logLoss)}</div></div>
      <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Calibration</div><div className="font-black text-[var(--sc-text)]">{num(metric?.calibrationGap)}</div></div>
    </div>
  </article>;
}

export default function FootballMlLabClient() {
  const { tr } = useLanguage();
  const ready = latest?.status === "evaluated" && latest?.metrics;
  const metrics = latest?.metrics || {};
  const mlComparison = latest?.comparisons?.mlVsMarket || {};
  const ensembleComparison = latest?.comparisons?.ensembleVsMarket || {};
  const importance = Array.isArray(latest?.model?.featureImportance) ? latest.model.featureImportance : [];
  const weights = latest?.ensembleWeights || {};

  return <div className="space-y-7">
    <PageHero
      tone="sky"
      eyebrow="Football ML Challenger V1"
      title={tr({ fi: "Koneoppiminen kohtaa markkinan — koskemattomalla holdoutilla.", en: "Machine learning meets the market — on an untouched holdout.", es: "Machine learning contra el mercado — con un holdout intacto." })}
      description={tr({ fi: "Multiclass gradient-boosted regression tree -malli oppii vain ennen ottelua tunnetusta xG-, maali-, laukaus-, lepo- ja Poisson-historiasta. Markkinatodennäköisyys ei ole independent ML:n feature; sitä käytetään benchmarkina ja erillisessä ensemble-kerroksessa.", en: "A multiclass gradient-boosted regression tree model learns only from pre-match xG, goals, shots, rest and Poisson history. Market probability is not an independent-ML feature; it is used as the benchmark and only in the separate ensemble layer.", es: "El modelo GBDT multiclase aprende solo de información histórica disponible antes del partido." })}
      actions={<><Link href="/zero-cost-football-lab" className="sc-button-secondary">Zero-Cost Lab</Link><Link href="/champion-challenger" className="sc-button-primary">Champion / Challenger</Link></>}
      aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">ML status</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{String(latest?.status || "unknown").toUpperCase()}</div><div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">research-only<br />auto promotion=false<br />PLAY upgrade=false</div></div>}
    />

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Dataset</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">EPL 2015/16</div><div className="mt-1 text-xs text-[var(--sc-muted)]">StatsBomb xG/shots + Football-Data market</div></div>
      <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Holdout</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{latest?.split?.holdout ?? "–"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">promotion review gate ≥ 100</div></div>
      <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Trees</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{latest?.model?.rounds ?? "–"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">3 class trees / boosting round</div></div>
      <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Paid-data verdict</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{String(latest?.paidLiveDataDecision?.status || "inconclusive").toUpperCase()}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">trial justified: {String(latest?.paidLiveDataDecision?.paidLiveDataTrialJustified === true)}</div></div>
    </section>

    {ready ? <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Market champion" metric={metrics.market} />
        <MetricCard title="Poisson baseline" metric={metrics.poisson} />
        <MetricCard title="Independent ML" metric={metrics.ml} />
        <MetricCard title="Market + ML + Poisson" metric={metrics.ensemble} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="sc-surface rounded-[1.6rem] p-5">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Independent ML vs market</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Gate label="Holdout n ≥ 100" value={mlComparison?.gate?.passes?.sample} />
            <Gate label="Better Brier" value={mlComparison?.gate?.passes?.brier} />
            <Gate label="Better log loss" value={mlComparison?.gate?.passes?.logLoss} />
            <Gate label="Brier 95% CI > 0" value={mlComparison?.gate?.passes?.brierCi} />
            <Gate label="Log-loss 95% CI > 0" value={mlComparison?.gate?.passes?.logLossCi} />
            <Gate label="Calibration acceptable" value={mlComparison?.gate?.passes?.calibration} />
          </div>
          <div className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">Brier improvement 95%: {num(mlComparison?.bootstrap?.brierImprovement95?.[0])} … {num(mlComparison?.bootstrap?.brierImprovement95?.[1])}<br />Log-loss improvement 95%: {num(mlComparison?.bootstrap?.logLossImprovement95?.[0])} … {num(mlComparison?.bootstrap?.logLossImprovement95?.[1])}</div>
        </article>

        <article className="sc-surface rounded-[1.6rem] p-5">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Ensemble vs market</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Market</div><div className="text-2xl font-black text-[var(--sc-text)]">{pct(weights.market)}</div></div>
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">ML</div><div className="text-2xl font-black text-[var(--sc-text)]">{pct(weights.ml)}</div></div>
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Poisson</div><div className="text-2xl font-black text-[var(--sc-text)]">{pct(weights.poisson)}</div></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Gate label="Better Brier" value={ensembleComparison?.gate?.passes?.brier} />
            <Gate label="Better log loss" value={ensembleComparison?.gate?.passes?.logLoss} />
            <Gate label="Brier 95% CI > 0" value={ensembleComparison?.gate?.passes?.brierCi} />
            <Gate label="Log-loss 95% CI > 0" value={ensembleComparison?.gate?.passes?.logLossCi} />
          </div>
        </article>
      </section>

      <section className="sc-surface rounded-[1.6rem] p-5">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">What the model learned</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {importance.slice(0, 12).map((row) => <div key={row.feature} className="rounded-xl border border-[var(--sc-border)] p-3"><div className="text-xs font-bold text-[var(--sc-text)]">{row.feature}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{pct(row.share)}</div><div className="text-[10px] uppercase text-[var(--sc-faint)]">split gain share</div></div>)}
        </div>
      </section>
    </> : <div className="sc-surface rounded-2xl p-5 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Ensimmäinen oikea ML-historia-ajo on vielä keräys-/evaluointitilassa. Tyhjä raportti ei tarkoita mallin onnistumista eikä epäonnistumista.", en: "The first real historical ML run is still collecting/evaluating. An empty report does not mean the model succeeded or failed.", es: "La primera evaluación histórica de ML sigue en proceso." })}</div>}

    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5"><h2 className="font-black text-[var(--sc-text)]">Chronology</h2><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">55% train → 15% validation → 30% untouched holdout. Match xG, result and shots update team state only after that match&apos;s prediction row has been frozen.</p></article>
      <article className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5"><h2 className="font-black text-[var(--sc-text)]">Calibration</h2><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">Boosting rounds use validation early stopping. A temperature parameter is learned only on validation and applied unchanged to holdout probabilities.</p></article>
      <article className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5"><h2 className="font-black text-[var(--sc-text)]">Safety boundary</h2><p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">Open-data ML cannot feed production probability, satisfy verified evidence, promote itself, or create PLAY. A live model requires a separately entitled feature pipeline and human review.</p></article>
    </section>

    <div className="rounded-2xl border border-[var(--sc-border)] p-4 text-xs leading-5 text-[var(--sc-muted)]">{latest?.paidLiveDataDecision?.reason || "first-football-ml-historical-experiment-pending"} · realMoneyActionAvailable=false · automaticPromotion=false · productionPlayUpgrade=false · paper-only</div>
  </div>;
}
