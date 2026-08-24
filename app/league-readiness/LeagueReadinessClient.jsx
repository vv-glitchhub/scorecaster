"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero } from "../components/ProductUI";

const pct = (value) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(0)}%` : "–";

function tone(status) {
  if (status === "full") return "border-emerald-400/25 bg-emerald-400/7 text-emerald-200";
  if (status === "partial") return "border-amber-400/25 bg-amber-400/7 text-amber-200";
  return "border-slate-400/20 bg-slate-400/5 text-[var(--sc-muted)]";
}

export default function LeagueReadinessClient() {
  const { tr } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations?limit=20", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) throw new Error(payload?.error || "League readiness unavailable");
      setData(payload);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : "League readiness unavailable");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const leagues = data?.leagueReadiness || [];

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="League Readiness V1"
        title={tr({ fi: "Missä nykyinen Recommendation-ikkuna on dataltaan vahvin?", en: "Where is the current Recommendation window strongest?", es: "¿Dónde es más sólida la ventana actual de recomendaciones?" })}
        description={tr({ fi: "Näkymä mittaa vain nykyisen live-recommendation-ikkunan otoskokoa, hintalähteitä, confidencea, tuoreutta ja verified-evidence-osuutta. Se ei ole historiallinen liiga-ranking eikä lupaus mallin laadusta.", en: "This view measures only the current live recommendation window: sample size, price-source depth, confidence, freshness and verified-evidence share. It is not a historical league ranking or a promise of model quality.", es: "Esta vista mide solo la ventana actual: muestra, fuentes, confianza, frescura y evidencia verificada. No es un ranking histórico de ligas." })}
        actions={<><button type="button" className="sc-button-primary" onClick={() => void load()} disabled={loading}>{loading ? "…" : tr({ fi: "Päivitä", en: "Refresh", es: "Actualizar" })}</button><Link href="/recommendations" className="sc-button-secondary">Recommendation Center</Link></>}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Current window</div><div className="mt-2 text-4xl font-black text-[var(--sc-text)]">{leagues.length}</div><div className="text-sm text-[var(--sc-muted)]">leagues observed</div></div>}
      />

      {error && <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
      {!loading && !error && leagues.length === 0 && <div className="sc-surface rounded-2xl p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Nykyisessä Recommendation-ikkunassa ei ole tarpeeksi liigadataa.", en: "The current Recommendation window does not contain enough league data.", es: "La ventana actual no contiene suficientes datos de ligas." })}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        {leagues.map((league) => <article key={league.league} className="sc-surface rounded-[1.6rem] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Current Window Readiness</div><h2 className="mt-1 text-xl font-black text-[var(--sc-text)]">{league.league}</h2></div><span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${tone(league.status)}`}>{league.status}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Sample</div><div className="text-xl font-black text-[var(--sc-text)]">{league.sampleSize}</div></div>
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Bookmakers</div><div className="text-xl font-black text-[var(--sc-text)]">{Number.isFinite(Number(league.averageBookmakers)) ? Number(league.averageBookmakers).toFixed(1) : "–"}</div></div>
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Confidence</div><div className="text-xl font-black text-[var(--sc-text)]">{pct(league.averageConfidence)}</div></div>
            <div><div className="text-[10px] uppercase text-[var(--sc-faint)]">Verified evidence</div><div className="text-xl font-black text-[var(--sc-text)]">{pct(league.verifiedEvidenceRate)}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-[var(--sc-muted)]"><span>Fresh {pct(league.freshRate)}</span><span>PLAY {league.playCount || 0}</span><span>CAUTION {league.cautionCount || 0}</span></div>
          <div className="mt-4 rounded-xl border border-[var(--sc-border)] p-3 text-xs leading-5 text-[var(--sc-muted)]">{league.limitation}</div>
        </article>)}
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-5 text-[var(--sc-muted)]">current live recommendation window only · historicalLeagueQualityClaim=false · decisionUpgradeAllowed=false · paper-only</section>
    </div>
  );
}
