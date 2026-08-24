"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";
import { buildOutcomeReview } from "../../lib/outcome-review-v1.mjs";

const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "–";

const LABELS = {
  "good-process-good-outcome": { fi: "Hyvä prosessi + voitto", en: "Good process + win", es: "Buen proceso + victoria" },
  "good-process-bad-outcome": { fi: "Hyvä prosessi + tappio", en: "Good process + loss", es: "Buen proceso + derrota" },
  "weak-process-good-outcome": { fi: "Heikko prosessi + voitto", en: "Weak process + win", es: "Proceso débil + victoria" },
  "weak-process-bad-outcome": { fi: "Heikko prosessi + tappio", en: "Weak process + loss", es: "Proceso débil + derrota" }
};

export default function OutcomeReviewClient() {
  const { tr } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/calibration?days=365&includeRecords=true", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Outcome evidence unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "Outcome evidence unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  const review = useMemo(() => buildOutcomeReview(data?.records || []), [data]);

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Outcome Review V1"
        title={tr({ fi: "Oliko päätös hyvä — vaikka tulos olisi huono?", en: "Was the decision good — even if the outcome was bad?", es: "¿Fue buena la decisión aunque el resultado fuera malo?" })}
        description={tr({ fi: "Outcome Review erottaa prosessin laadun yksittäisen vedon tuloksesta. Positiivinen closing-line value voi tarkoittaa hyvää päätösprosessia myös tappiossa; vastaavasti voitto ei tee heikosta hinnasta jälkikäteen hyvää päätöstä.", en: "Outcome Review separates process quality from a single result. Positive closing-line value can support a good process even on a loss, while a win does not retroactively make a weak price a good decision.", es: "Outcome Review separa la calidad del proceso del resultado individual. El CLV positivo puede respaldar un buen proceso incluso con derrota." })}
        actions={<><button type="button" className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? "…" : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/calibration" className="sc-button-secondary">CLV & Calibration</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">365d paper evidence</div><div className="mt-2 text-4xl font-black text-[var(--sc-text)]">{review.sampleSize}</div><div className="text-sm text-[var(--sc-muted)]">classified outcomes</div></div>}
      />

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}

      {!error && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Good process rate</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{pct(review.goodProcessRate)}</div></div>
            <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Hit rate</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{pct(review.hitRate)}</div></div>
            <div className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Excluded</div><div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{review.excludedForMissingOutcomeOrClv}</div></div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {review.buckets.map((bucket) => (
              <article key={bucket.key} className="sc-surface rounded-[1.6rem] p-5">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{tr(LABELS[bucket.key])}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">n</div><div className="text-xl font-black text-[var(--sc-text)]">{bucket.count}</div></div>
                  <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Share</div><div className="text-xl font-black text-[var(--sc-text)]">{pct(bucket.share)}</div></div>
                  <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Avg CLV</div><div className="text-xl font-black text-[var(--sc-text)]">{pct(bucket.averagePriceClv)}</div></div>
                  <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Brier</div><div className="text-xl font-black text-[var(--sc-text)]">{Number.isFinite(Number(bucket.averageBrier)) ? Number(bucket.averageBrier).toFixed(3) : "–"}</div></div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-6 text-[var(--sc-muted)]">
        {tr({ fi: "Tulosta ei käytetä muuttamaan aiempaa päätöstä jälkikäteen. Tämä näkymä arvioi paper-only-prosessia closing-linjan ja toteutuneen tuloksen avulla; automatic promotion=false ja real-money action=false.", en: "The outcome never retroactively changes the earlier decision. This view reviews the paper-only process using closing-line evidence and results; automatic promotion=false and real-money action=false.", es: "El resultado nunca cambia retroactivamente la decisión anterior. Esta vista revisa el proceso paper-only; automatic promotion=false y real-money action=false." })}
      </section>
    </div>
  );
}
