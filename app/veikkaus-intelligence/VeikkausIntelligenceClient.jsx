"use client";

import { useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { PageHero, SectionHeader } from "../components/ProductUI";

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{value}</div>
    </div>
  );
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)} %` : "–";
}

function number(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
}

export default function VeikkausIntelligenceClient() {
  const { tr } = useLanguage();
  const [fixed, setFixed] = useState({ decimalOdds: "2.00", modelProbability: "50" });
  const [pool, setPool] = useState({ modelProbability: "50", playedShare: "40" });
  const [score, setScore] = useState({ observedOdds: "10.00", modelProbability: "10" });
  const [marketLabel, setMarketLabel] = useState("Voittaja (1X2)");
  const [fixedResult, setFixedResult] = useState(null);
  const [poolResult, setPoolResult] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [marketResult, setMarketResult] = useState(null);
  const [error, setError] = useState("");

  async function analyze(mode, payload, setter) {
    setError("");
    setter(null);
    try {
      const response = await fetch("/api/veikkaus-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...payload }),
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) throw new Error(body?.error || "Analysis unavailable");
      setter(body.analysis);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analysis unavailable");
    }
  }

  return (
    <div className="space-y-7">
      <PageHero
        tone="sky"
        eyebrow="Veikkaus Intelligence V1"
        title={tr({ fi: "Kiinteät kertoimet ja poolipelit eri matematiikalla", en: "Fixed odds and pool games with the correct mathematics", es: "Cuotas fijas y pools con la matemática correcta" })}
        description={tr({
          fi: "Syötä käsin näkyvä Veikkaus-snapshot tai mallisi todennäköisyys. Scorecaster erottaa Pitkävedon hintavertailun Vakion, Tulosvedon, Monivedon, Voittajavedon ja Toton poolilogiikasta.",
          en: "Enter a visible Veikkaus snapshot or your model probability manually. Scorecaster separates Pitkäveto price analysis from Vakio, Tulosveto, Moniveto, Voittajaveto and Toto pool logic.",
          es: "Introduce manualmente un snapshot visible de Veikkaus o la probabilidad de tu modelo. Scorecaster separa cuotas fijas de la lógica de pools.",
        })}
        aside={<div><div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">Boundary</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">PAPER ONLY</div><div className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">No Veikkaus login<br />No bet placement<br />No money movement<br />No live scraping</div></div>}
      />

      {error && <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Pitkäveto" title={tr({ fi: "Kiinteäkertoiminen value-analyysi", en: "Fixed-odds value analysis", es: "Análisis de valor de cuota fija" })} />
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          void analyze("fixed_odds", {
            decimalOdds: Number(fixed.decimalOdds),
            modelProbability: Number(fixed.modelProbability) / 100,
          }, setFixedResult);
        }}>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Veikkaus-kerroin", en: "Veikkaus odds", es: "Cuota Veikkaus" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={fixed.decimalOdds} onChange={(event) => setFixed((current) => ({ ...current, decimalOdds: event.target.value }))} /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Mallin todennäköisyys %", en: "Model probability %", es: "Probabilidad del modelo %" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={fixed.modelProbability} onChange={(event) => setFixed((current) => ({ ...current, modelProbability: event.target.value }))} /></label>
          <div className="flex items-end"><button type="submit" className="sc-button-primary w-full">{tr({ fi: "Analysoi hinta", en: "Analyze price", es: "Analizar cuota" })}</button></div>
        </form>
        {fixedResult && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Implied" value={percent(fixedResult.impliedProbability)} /><Metric label="Model" value={percent(fixedResult.modelProbability)} /><Metric label="Fair odds" value={number(fixedResult.fairOdds, 2)} /><Metric label="Edge" value={percent(fixedResult.edgeProbability)} /><Metric label="EV" value={percent(fixedResult.expectedValue)} /></div>}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Vakio / Toto / pool" title={tr({ fi: "Mallin ja pelijakauman ero", en: "Model versus played share", es: "Modelo frente a porcentaje jugado" })} />
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          void analyze("pool_popularity", {
            modelProbability: Number(pool.modelProbability) / 100,
            playedShare: Number(pool.playedShare) / 100,
          }, setPoolResult);
        }}>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Mallin todennäköisyys %", en: "Model probability %", es: "Probabilidad del modelo %" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={pool.modelProbability} onChange={(event) => setPool((current) => ({ ...current, modelProbability: event.target.value }))} /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Pelattu osuus %", en: "Played share %", es: "Porcentaje jugado %" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={pool.playedShare} onChange={(event) => setPool((current) => ({ ...current, playedShare: event.target.value }))} /></label>
          <div className="flex items-end"><button type="submit" className="sc-button-primary w-full">{tr({ fi: "Vertaa jakaumaa", en: "Compare shares", es: "Comparar porcentajes" })}</button></div>
        </form>
        {poolResult && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Model" value={percent(poolResult.modelProbability)} /><Metric label="Played" value={percent(poolResult.playedShare)} /><Metric label="Difference" value={percent(poolResult.difference)} /><Metric label="Value ratio" value={number(poolResult.valueRatio, 3)} /></div>}
        {poolResult && <div className="mt-3 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">{tr({ fi: "Tila", en: "State", es: "Estado" })}: <strong>{poolResult.popularityState}</strong>. {tr({ fi: "EV:tä ei keksitä ilman kyseisen poolin palautusprosenttia.", en: "EV is not invented without that pool's return rate.", es: "No se inventa EV sin el retorno del pool." })}</div>}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Tulosveto" title={tr({ fi: "77 % kierrospalautukseen perustuva exact-score-analyysi", en: "Exact-score analysis using the 77% round return", es: "Análisis de marcador exacto con retorno del 77 %" })} />
        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          void analyze("tulosveto", {
            observedOdds: Number(score.observedOdds),
            modelProbability: Number(score.modelProbability) / 100,
          }, setScoreResult);
        }}>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Näkyvä kerroin", en: "Observed odds", es: "Cuota observada" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={score.observedOdds} onChange={(event) => setScore((current) => ({ ...current, observedOdds: event.target.value }))} /></label>
          <label className="text-sm font-bold text-[var(--sc-text-secondary)]">{tr({ fi: "Exact score -todennäköisyys %", en: "Exact-score probability %", es: "Probabilidad de marcador exacto %" })}<input className="sc-input mt-2 w-full" inputMode="decimal" value={score.modelProbability} onChange={(event) => setScore((current) => ({ ...current, modelProbability: event.target.value }))} /></label>
          <div className="flex items-end"><button type="submit" className="sc-button-primary w-full">{tr({ fi: "Analysoi Tulosveto", en: "Analyze Tulosveto", es: "Analizar Tulosveto" })}</button></div>
        </form>
        {scoreResult && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Model" value={percent(scoreResult.modelProbability)} /><Metric label="Pool share est." value={percent(scoreResult.estimatedPlayedShare)} /><Metric label="Fair odds" value={number(scoreResult.fairOdds, 2)} /><Metric label="Observed" value={number(scoreResult.observedOrEstimatedOdds, 2)} /><Metric label="EV" value={percent(scoreResult.expectedValue)} /></div>}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Market mapper" title={tr({ fi: "Veikkauksen markkinanimet Scorecaster-muotoon", en: "Normalize Veikkaus market labels", es: "Normalizar mercados de Veikkaus" })} />
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => {
          event.preventDefault();
          void analyze("market_map", { label: marketLabel }, setMarketResult);
        }}>
          <input className="sc-input w-full" value={marketLabel} onChange={(event) => setMarketLabel(event.target.value)} placeholder="Voittaja (1X2)" />
          <button type="submit" className="sc-button-secondary">{tr({ fi: "Normalisoi", en: "Normalize", es: "Normalizar" })}</button>
        </form>
        {marketResult && <div className="mt-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-text-secondary)]"><strong>{marketResult.sourceLabel || "–"}</strong> → <span className="font-mono">{marketResult.canonicalMarket || "unsupported"}</span></div>}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="Source boundary" title={tr({ fi: "Kuvista opittu rakenne, ei kuvista luettua live-dataa", en: "Structure learned from screenshots, not live data read from screenshots", es: "Estructura observada, no datos en vivo extraídos de capturas" })} />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">{tr({ fi: "Markkinanimet voidaan normalisoida, mutta tämän version käyttäjä syöttää kertoimet ja peliosuudet itse.", en: "Market labels can be normalized, but this version requires manual odds and pool-share input.", es: "Los mercados se normalizan, pero las cuotas y porcentajes se introducen manualmente." })}</div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">{tr({ fi: "Seuraava data-adapteri saa olla vain read-only ja oikeuksien mukainen. Puuttuvaa Veikkaus-dataa ei täytetä esimerkkiluvuilla.", en: "A future data adapter must remain read-only and rights-compliant. Missing Veikkaus data is never filled with sample values.", es: "Un futuro adaptador debe ser solo lectura y respetar derechos. No se inventan datos ausentes." })}</div>
        </div>
      </section>
    </div>
  );
}
