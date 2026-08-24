"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";

const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "–";
const num = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";

function processStatus(overall = {}) {
  const sample = overall.sampleStatus?.level || "insufficient";
  if (sample !== "usable") return { code: "collecting", label: "COLLECTING", reason: "Sample is not yet large enough for a strong process conclusion." };
  if (Number(overall.averagePriceClv) > 0 && Number(overall.brierScore) < 0.25) return { code: "healthy", label: "PROCESS HEALTHY", reason: "Usable sample, positive price CLV and bounded calibration error." };
  if (Number(overall.averagePriceClv) > 0) return { code: "mixed", label: "MIXED", reason: "Closing-line process is positive, but probability calibration still needs review." };
  return { code: "review", label: "REVIEW NEEDED", reason: "Usable sample does not currently show positive average price CLV." };
}

function strongestSlice(rows = []) {
  return [...rows]
    .filter((row) => row.sampleStatus?.level === "usable" && Number.isFinite(Number(row.averagePriceClv)))
    .sort((a, b) => Number(b.averagePriceClv) - Number(a.averagePriceClv))[0] || null;
}

function weakestSlice(rows = []) {
  return [...rows]
    .filter((row) => row.sampleStatus?.level === "usable" && Number.isFinite(Number(row.averagePriceClv)))
    .sort((a, b) => Number(a.averagePriceClv) - Number(b.averagePriceClv))[0] || null;
}

export default function CalibrationCenterV2Client() {
  const { tr } = useLanguage();
  const [days, setDays] = useState("365");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/calibration?days=${encodeURIComponent(days)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Calibration evidence unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "Calibration evidence unavailable");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [days]);

  const overall = data?.overall || {};
  const status = processStatus(overall);
  const leagueBest = useMemo(() => strongestSlice(data?.slices?.league || []), [data]);
  const leagueWeak = useMemo(() => weakestSlice(data?.slices?.league || []), [data]);
  const marketBest = useMemo(() => strongestSlice(data?.slices?.market || []), [data]);
  const modelBest = useMemo(() => strongestSlice(data?.slices?.modelVersion || []), [data]);

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Calibration Center V2"
        title={tr({ fi: "Onko Scorecasterin päätösprosessi oikeasti parantumassa?", en: "Is Scorecaster's decision process actually improving?", es: "¿Está mejorando realmente el proceso de decisión?" })}
        description={tr({ fi: "Kuluttajanäkymä tiivistää oikean closing-line-evidenssin, Brierin, log lossin, kalibraation ja käyttökelpoiset siivut yhdeksi process-health-näkymäksi. Pieniä otoksia ei ylianalysoida eikä tämä näkymä koskaan promovoi mallia automaattisesti.", en: "This consumer view condenses real closing-line evidence, Brier score, log loss, calibration and usable slices into one process-health view. Small samples are not overinterpreted and this view never promotes a model automatically.", es: "Esta vista resume evidencia real de cierre, Brier, log loss y calibración sin sobreinterpretar muestras pequeñas ni promover modelos automáticamente." })}
        actions={<><select className="sc-input" value={days} onChange={(event) => setDays(event.target.value)}><option value="90">90d</option><option value="365">365d</option><option value="730">730d</option><option value="1825">5y</option></select><button className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? "…" : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/calibration" className="sc-button-secondary">Open Calibration Lab</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Process health</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{status.label}</div><div className="mt-2 text-sm leading-5 text-[var(--sc-muted)]">{status.reason}</div></div>}
      />

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error} {/auth|sign|session/i.test(error) && <Link href="/login" className="ml-2 font-black underline">{tr({ fi: "Kirjaudu", en: "Sign in", es: "Iniciar sesión" })}</Link>}</div>}

      {data && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Eligible", data.eligible || 0],
            ["Price CLV", pct(overall.averagePriceClv)],
            ["Brier", num(overall.brierScore)],
            ["Log loss", num(overall.logLoss)],
            ["Positive CLV", pct(overall.positivePriceClvRate)],
            ["Hit rate", pct(overall.hitRate)],
            ["Yield", pct(overall.yield)],
            ["Sample", overall.sampleStatus?.level || "insufficient"]
          ].map(([label, value]) => <div key={label} className="sc-surface rounded-2xl p-4"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-2xl font-black text-[var(--sc-text)]">{value}</div></div>)}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Strongest usable league", leagueBest],
            ["Weakest usable league", leagueWeak],
            ["Strongest usable market", marketBest],
            ["Strongest usable model slice", modelBest]
          ].map(([title, row]) => <article key={title} className="sc-surface rounded-[1.5rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-brand)]">{title}</div><div className="mt-2 text-xl font-black text-[var(--sc-text)]">{row?.name || "Not enough data"}</div><div className="mt-2 text-sm text-[var(--sc-muted)]">n={row?.count || 0} · CLV {pct(row?.averagePriceClv)} · Brier {num(row?.brierScore)}</div></article>)}
        </section>

        <section className="sc-surface rounded-[1.6rem] p-5">
          <div className="text-xs font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">Next review actions</div>
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/outcome-review" className="sc-button-secondary">Outcome Review</Link><Link href="/bookmakers" className="sc-button-secondary">Bookmaker Intelligence</Link><Link href="/model-lab" className="sc-button-secondary">Model Lab</Link><Link href="/champion-challenger" className="sc-button-secondary">Champion / Challenger</Link></div>
        </section>
      </>}

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-5 text-[var(--sc-muted)]">usable sample required for strong slice claims · automaticPromotion=false · productionProbabilityChanged=false · paper-only</section>
    </div>
  );
}
