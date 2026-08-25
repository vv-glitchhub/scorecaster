"use client";

import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";
import latest from "../../config/zero-cost-football-model-lab-v1-latest.json";

const num = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : "–";

function gate(value) {
  if (value === true) return "PASS";
  if (value === false) return "BLOCKED";
  return "–";
}

export default function ZeroCostFootballLabClient() {
  const { tr } = useLanguage();
  const evaluation = latest?.evaluation || null;
  const metrics = evaluation?.metrics || {};
  const skill = metrics?.skill || {};
  const gates = evaluation?.gates || {};
  const decision = latest?.conclusion || {};

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Zero-Cost Football Model Lab V1"
        title={tr({ fi: "Kannattaako live-xG-datasta maksaa? Todistetaan ensin ilmaisella holdoutilla.", en: "Should we pay for live xG? Prove it first on a free historical holdout.", es: "¿Vale la pena pagar por xG en vivo? Primero hay que demostrarlo con un holdout histórico gratuito." })}
        description={tr({ fi: "Tutkimuslabra parittaa StatsBomb Open Datan historiallisen shot-xG:n Football-Data.co.uk:n pregame-kertoimiin, ajaa kronologisen walk-forward Poisson-challengerin ja vertaa sitä no-vig-markkinachampioniin. Labra ei saa muuttaa tuotannon probabilitya, evidence gatea tai PLAY-päätöstä.", en: "The research lab pairs historical StatsBomb shot xG with Football-Data.co.uk pregame odds, runs a chronological walk-forward Poisson challenger, and compares it with a no-vig market champion. The lab cannot change production probability, evidence readiness, or PLAY decisions.", es: "El laboratorio empareja xG histórico de StatsBomb con cuotas prepartido de Football-Data.co.uk y compara un challenger Poisson walk-forward con el mercado no-vig." })}
        actions={<><Link href="/champion-challenger" className="sc-button-primary">Champion / Challenger</Link><Link href="/sources" className="sc-button-secondary">Sources & licences</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Latest lab status</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{String(latest?.status || "unknown").toUpperCase()}</div><div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">research-only<br />automatic promotion=false</div></div>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Dataset</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">EPL 2015/16</div><div className="mt-1 text-xs text-[var(--sc-muted)]">StatsBomb xG + Football-Data odds</div></div>
        <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Paired holdout</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{evaluation?.sampleSize ?? "–"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">review gate ≥ 100</div></div>
        <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Brier skill</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{pct(skill?.brierSkillScore)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">must be positive</div></div>
        <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Paid-data verdict</div><div className="mt-1 text-xl font-black text-[var(--sc-text)]">{String(decision?.paidLiveDataStatus || "inconclusive").toUpperCase()}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">trial justified: {String(decision?.paidLiveDataTrialJustified === true)}</div></div>
      </section>

      {evaluation ? <>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="sc-surface rounded-[1.6rem] p-5">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">XG POISSON CHALLENGER</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.challenger?.brier)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Log loss</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.challenger?.logLoss)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Calibration gap</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.challenger?.calibrationGap)}</div></div>
            </div>
          </article>
          <article className="sc-surface rounded-[1.6rem] p-5">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">NO-VIG MARKET CHAMPION</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.marketChampion?.brier)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Log loss</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.marketChampion?.logLoss)}</div></div>
              <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Calibration gap</div><div className="font-black text-[var(--sc-text)]">{num(metrics?.marketChampion?.calibrationGap)}</div></div>
            </div>
          </article>
        </section>

        <section className="sc-surface rounded-[1.6rem] p-5">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Purchase decision gates</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Paired n ≥ 100", gates.sampleGate],
              ["Positive Brier skill", gates.brierGate],
              ["Better log loss", gates.logLossGate],
              ["Brier bootstrap 95% > 0", gates.brierBootstrapGate],
              ["Log-loss bootstrap 95% > 0", gates.logLossBootstrapGate],
              ["Calibration acceptable", gates.calibrationGate]
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--sc-border)] p-3 text-sm"><span className="font-bold text-[var(--sc-text)]">{label}</span><span className="float-right text-xs font-black text-[var(--sc-muted)]">{gate(value)}</span></div>)}
          </div>
          <div className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">Brier improvement 95% CI: {num(skill?.bootstrap?.brierImprovement95?.[0])} … {num(skill?.bootstrap?.brierImprovement95?.[1])} · Log-loss improvement 95% CI: {num(skill?.bootstrap?.logLossImprovement95?.[0])} … {num(skill?.bootstrap?.logLossImprovement95?.[1])}</div>
        </section>
      </> : <div className="sc-surface rounded-2xl p-5 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Ensimmäinen täysin paritettu historiallinen ajo on keräystilassa. Tyhjä raportti ei tarkoita nollatulosta eikä mallin onnistumista tai epäonnistumista.", en: "The first fully paired historical run is in collecting state. An empty report is not a zero result and does not imply success or failure.", es: "La primera ejecución histórica emparejada está en estado de recopilación." })}</div>}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
          <h2 className="font-black text-[var(--sc-text)]">Chronology & leakage guard</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">70% chronological training → 30% untouched evaluation window. Each holdout prediction is made before that match&apos;s xG/result is used. Team state updates only after a completed match. Market odds are never model features.</p>
        </article>
        <article className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
          <h2 className="font-black text-[var(--sc-text)]">Research boundary</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">StatsBomb Open Data is treated as research-only in Scorecaster. It can answer whether a paid live-data trial looks statistically justified, but its rows cannot feed production predictions, satisfy verified evidence, or trigger PLAY.</p>
        </article>
      </section>

      <div className="rounded-2xl border border-[var(--sc-border)] p-4 text-xs leading-5 text-[var(--sc-muted)]">{decision?.reason || "first-historical-experiment-running"} · realMoneyActionAvailable=false · automaticPromotion=false · productionPlayUpgrade=false · paper-only</div>
    </div>
  );
}
