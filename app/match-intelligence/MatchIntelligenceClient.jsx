"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { useProfessionalPreferences } from "../components/ProfessionalPreferencesProvider";
import MatchJourneyV1 from "./MatchJourneyV1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value, digits = 0) {
  const parsed = finite(value);
  return parsed === null ? "—" : `${(parsed * 100).toFixed(digits)}%`;
}

function fixed(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "—" : parsed.toFixed(digits);
}

function probability(value) {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 && parsed < 1 ? `${(parsed * 100).toFixed(1)}%` : "—";
}

function MetricCard({ label, value, detail }) {
  return <div className="sc-surface rounded-[1.4rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{value}</div>{detail ? <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div> : null}</div>;
}

function TeamSnapshot({ title, team, state, tr }) {
  const publishable = state === "observed" || state === "no-observations";
  const rows = [
    [tr({ fi: "Otos", en: "Sample", es: "Muestra" }), publishable ? team?.sampleSize : null],
    [tr({ fi: "Form strength", en: "Form strength", es: "Fuerza de forma" }), publishable ? fixed(team?.formStrength, 2) : "—"],
    [tr({ fi: "Tulosvauhti", en: "Result rate", es: "Tasa de resultado" }), publishable ? pct(team?.weightedResultRate, 0) : "—"],
    [tr({ fi: "Lepopäivät", en: "Rest days", es: "Días de descanso" }), publishable ? finite(team?.restDays) ?? "—" : "—"],
    [tr({ fi: "Ottelut 7 pv", en: "Games / 7d", es: "Partidos / 7d" }), publishable ? finite(team?.gamesLast7Days) ?? "—" : "—"]
  ];
  const stateLabel = state === "observed" ? tr({ fi: "havaittu", en: "observed", es: "observado" }) : state === "no-observations" ? tr({ fi: "0 havaintoa", en: "0 observations", es: "0 observaciones" }) : tr({ fi: "data puuttuu", en: "data missing", es: "faltan datos" });
  return <article className="rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5"><div className="flex items-center justify-between gap-3"><div className="text-lg font-black text-[var(--sc-text)]">{title || "—"}</div><span className="rounded-full border border-[var(--sc-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{stateLabel}</span></div><div className="mt-4 space-y-2">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-2.5 text-sm"><span className="text-[var(--sc-muted)]">{label}</span><strong className="text-[var(--sc-text)]">{value ?? "—"}</strong></div>)}</div></article>;
}

function ModelRoom({ models, tr }) {
  if (!models.length) return <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tälle ottelulle ei ole vielä julkaistavia research-mallirivejä.", en: "There are no publishable research-model rows for this event yet.", es: "Aún no hay modelos de investigación publicables para este evento." })}</div>;
  return <div className="grid gap-3 lg:grid-cols-2">{models.map((model) => <article key={`${model.modelId}-${model.modelVersion}`} className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-black text-[var(--sc-text)]">{model.modelId || model.modelVersion || "unknown model"}</div><div className="mt-1 truncate text-xs text-[var(--sc-muted)]">{model.modelVersion || "—"}</div></div><span className="rounded-full border border-[var(--sc-border)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">{model.performance?.calibrationReady === true ? tr({ fi: "kalibrointi ready", en: "calibration ready", es: "calibración lista" }) : model.performance?.status || "unvalidated"}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[var(--sc-faint)]">{tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" })}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{probability(model.probability)}</div></div><div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[var(--sc-faint)]">N</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{finite(model.performance?.sampleSize) > 0 ? finite(model.performance?.sampleSize) : "—"}</div></div></div></article>)}</div>;
}

function readinessCopy(level, tr) {
  if (level === "verified") return tr({ fi: "Analyysi on varmennettu nykyisillä vaadituilla lähteillä.", en: "The analysis is verified with the currently required evidence.", es: "El análisis está verificado con la evidencia requerida." });
  if (level === "partial") return tr({ fi: "Analyysi on käyttökelpoinen seurantaan, mutta osa riippumattomasta evidenssistä puuttuu vielä.", en: "The analysis is usable for monitoring, but some independent evidence is still missing.", es: "El análisis sirve para seguimiento, pero aún falta evidencia independiente." });
  if (level === "market-only") return tr({ fi: "Tällä hetkellä päätös perustuu pääosin markkinadataan. Tämä ei ole vielä PLAY-tason evidenssiä.", en: "The decision currently relies mainly on market data. This is not yet PLAY-level evidence.", es: "La decisión depende principalmente del mercado y aún no alcanza evidencia PLAY." });
  return tr({ fi: "Varmennettua analyysipayloadia ei ole vielä saatavilla.", en: "Verified analysis data is not yet available.", es: "Aún no hay datos de análisis verificados." });
}

export default function MatchIntelligenceClient({ eventId, sport, selection = "" }) {
  const { tr } = useLanguage();
  const { proMode, toggleProMode } = useProfessionalPreferences();
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        if (selection) query.set("selection", selection);
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store", signal: AbortSignal.timeout(35_000) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Analysis unavailable");
        if (!cancelled) setState({ loading: false, error: "", detail: payload.detail || null });
      } catch (error) {
        const message = error?.name === "TimeoutError" ? tr({ fi: "Analyysi ei valmistunut ajoissa. Päivitä näkymä ja yritä uudelleen.", en: "The analysis did not finish in time. Refresh and try again.", es: "El análisis no terminó a tiempo. Actualiza e inténtalo de nuevo." }) : error instanceof Error ? error.message : "Analysis unavailable";
        if (!cancelled) setState({ loading: false, error: message, detail: null });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, selection, sport, tr]);

  if (state.loading) return <section className="sc-surface overflow-hidden rounded-[1.65rem] p-6" data-match-journey-loading="true"><div className="mx-auto grid max-w-2xl place-items-center py-8 text-center"><div className="grid h-16 w-16 rotate-45 place-items-center rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] shadow-[var(--sc-brand-shadow)]"><div className="h-5 w-5 rounded-md bg-[var(--sc-brand)]" /></div><div className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1</div><h1 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Kootaan ottelun analyysiä…", en: "Building the match analysis…", es: "Preparando el análisis…" })}</h1><p className="mt-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Jos varmennettua dataa puuttuu, näkymä kertoo sen suoraan.", en: "If verified data is missing, the view will say so directly.", es: "Si faltan datos verificados, la vista lo indicará." })}</p><div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sc-border)]"><div className="h-full w-2/3 rounded-full bg-[var(--sc-brand)] motion-safe:animate-pulse" /></div></div></section>;
  if (!state.detail) return <section className="sc-surface rounded-[1.65rem] p-6"><div className="font-black text-[var(--sc-text)]">{tr({ fi: "Match Journey ei ole saatavilla", en: "Match Journey unavailable", es: "Match Journey no disponible" })}</div><div className="mt-2 text-sm text-[var(--sc-muted)]">{state.error}</div><Link href="/events" className="sc-button-secondary mt-4 inline-flex">{tr({ fi: "Takaisin otteluihin", en: "Back to events", es: "Volver a eventos" })}</Link></section>;

  const detail = state.detail;
  const intelligence = detail.sportsIntelligence || {};
  const featureEngine = detail.featureEngine || {};
  const ensemble = detail.ensembleEngine || {};
  const uncertainty = ensemble.uncertainty || {};
  const formRest = detail.formRestShadow || {};
  const models = Array.isArray(ensemble.models) ? ensemble.models : [];
  const eligibleFeatures = Array.isArray(featureEngine.eligibleFeatures) ? featureEngine.eligibleFeatures : [];
  const missingEvidence = Array.isArray(intelligence.readiness?.missing) ? intelligence.readiness.missing : [];
  const gateReasons = Array.isArray(ensemble.researchRiskGate?.reasons) ? ensemble.researchRiskGate.reasons : [];
  const intelligenceState = intelligence.evidenceState || "missing";
  const featureState = featureEngine.evidenceState || "missing";
  const ensembleState = ensemble.evidenceState || "missing";
  const formState = formRest.evidenceState || "missing";
  const homeState = formState === "missing" ? "missing" : formRest.home?.evidenceState || formState;
  const awayState = formState === "missing" ? "missing" : formRest.away?.evidenceState || formState;
  const level = intelligenceState === "missing" ? "unavailable" : intelligence.readiness?.level || "market-only";
  const missingCount = missingEvidence.length + gateReasons.length;

  return <div className="space-y-6" data-match-intelligence-v2="true" data-evidence-semantics-v2="true">
    <section className="sc-surface relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--sc-brand-soft)] blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1 · Intelligence V2</div><h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">{detail.match}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">{readinessCopy(level, tr)}</p></div><button type="button" onClick={toggleProMode} className="sc-button-secondary" aria-pressed={proMode} data-match-intelligence-mode-toggle="true">{proMode ? tr({ fi: "Pro Mode", en: "Pro Mode", es: "Modo Pro" }) : tr({ fi: "Näytä tekninen audit", en: "Show technical audit", es: "Ver auditoría técnica" })}</button></div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-3"><MetricCard label={tr({ fi: "Analyysin tila", en: "Analysis status", es: "Estado" })} value={level === "verified" ? tr({ fi: "VARMENNETTU", en: "VERIFIED", es: "VERIFICADO" }) : level === "partial" ? tr({ fi: "OSITTAINEN", en: "PARTIAL", es: "PARCIAL" }) : level === "market-only" ? tr({ fi: "MARKKINA + ODOTA", en: "MARKET + WAIT", es: "MERCADO + ESPERA" }) : tr({ fi: "EI SAATAVILLA", en: "UNAVAILABLE", es: "NO DISPONIBLE" })} /><MetricCard label={tr({ fi: "Puuttuvia tarkistuksia", en: "Missing checks", es: "Comprobaciones faltantes" })} value={missingCount} /><MetricCard label={tr({ fi: "Mitä tehdä", en: "Action", es: "Acción" })} value={level === "verified" ? tr({ fi: "TARKISTA PÄÄTÖS", en: "CHECK DECISION", es: "REVISAR DECISIÓN" }) : tr({ fi: "ODOTA", en: "WAIT", es: "ESPERAR" })} /></div>
    </section>

    <MatchJourneyV1 detail={detail} sport={sport} tr={tr} />

    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Mitä vielä puuttuu", en: "What is still missing", es: "Qué falta" })}</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{missingCount ? tr({ fi: `${missingCount} tarkistusta estää täyden varmistuksen`, en: `${missingCount} checks still block full verification`, es: `${missingCount} comprobaciones impiden la verificación` }) : tr({ fi: "Ei julkaistuja puutteita", en: "No published gaps", es: "Sin carencias publicadas" })}</h2><p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{missingCount ? tr({ fi: "Yksityiskohtaiset provider-, feature- ja malligatet löytyvät Pro Modesta. Normaalinäkymä näyttää vain päätöksen kannalta olennaisen tilan.", en: "Detailed provider, feature and model gates are available in Pro Mode. Simple mode shows only what matters for the decision.", es: "Los detalles técnicos están en Modo Pro; la vista simple muestra solo lo importante para la decisión." }) : tr({ fi: "Nykyiset julkaistavat tarkistukset eivät raportoi puuttuvaa evidenssiä.", en: "Current publishable checks do not report missing evidence.", es: "Las comprobaciones actuales no reportan evidencia faltante." })}</p></section>

    {proMode ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-technical-metrics="true"><MetricCard label={tr({ fi: "Feature coverage", en: "Feature coverage", es: "Cobertura" })} value={featureState === "observed" ? pct(featureEngine.eligibilityRate, 0) : "—"} detail={featureState} /><MetricCard label={tr({ fi: "Research-mallit", en: "Research models", es: "Modelos research" })} value={ensembleState === "missing" ? "—" : finite(ensemble.counts?.researchEligible) ?? "—"} detail={ensembleState} /><MetricCard label={tr({ fi: "Mallien erimielisyys", en: "Model disagreement", es: "Desacuerdo" })} value={ensembleState === "missing" ? "—" : uncertainty.band || "unknown"} detail={finite(uncertainty.range) === null ? "Range —" : `Range ${pct(uncertainty.range, 1)}`} /><MetricCard label={tr({ fi: "Varmennetut tarkistukset", en: "Verified checks", es: "Comprobaciones verificadas" })} value={`${finite(intelligence.readiness?.verifiedCount) ?? "—"}/${finite(intelligence.readiness?.totalChecks) ?? "—"}`} /></section>
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-team-comparison="true"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Form & Rest</div><div className="mt-5 grid gap-4 lg:grid-cols-2"><TeamSnapshot title={detail.homeTeam} team={formRest.home} state={homeState} tr={tr} /><TeamSnapshot title={detail.awayTeam} team={formRest.away} state={awayState} tr={tr} /></div></section>
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Map</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Tekninen feature-audit", en: "Technical feature audit", es: "Auditoría técnica de features" })}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{eligibleFeatures.slice(0, 10).map((item) => <div key={item.id} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="font-black text-[var(--sc-text)]">{item.id}</div><div className="mt-2 text-xs text-[var(--sc-muted)]">{item.source || "verified pipeline"} · trust {finite(item.trust) === null ? "—" : pct(item.trust, 0)}</div></div>)}{eligibleFeatures.length === 0 ? <div className="sm:col-span-2 text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei varmennettuja advanced-featureita.", en: "No verified advanced features.", es: "Sin features avanzadas verificadas." })}</div> : null}</div></section>
      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Model Room</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Riippumattomat research-mallit", en: "Independent research models", es: "Modelos research independientes" })}</h2><div className="mt-5"><ModelRoom models={models} tr={tr} /></div></section>
      <section className="sc-surface rounded-[1.65rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Raw gates</div><div className="mt-4 space-y-2 text-xs text-[var(--sc-muted)]">{missingEvidence.map((item) => <div key={`m-${item}`} className="rounded-xl border border-[var(--sc-border)] p-3">Missing: {item}</div>)}{gateReasons.map((item) => <div key={`g-${item}`} className="rounded-xl border border-[var(--sc-border)] p-3">Model gate: {item}</div>)}</div></section>
    </> : null}

    <section className="sc-surface rounded-[1.65rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Turvaraja", en: "Boundary", es: "Límite" })}</div><p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Puuttuva data pysyy puuttuvana. Tämä näkymä ei muuta tuotannon todennäköisyyttä eikä tee oikean rahan vetoja.", en: "Missing data stays missing. This view does not alter production probability or place real-money bets.", es: "Los datos ausentes siguen ausentes. Esta vista no altera probabilidades ni realiza apuestas reales." })}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(detail.sportKey || sport)}`} className="sc-button-secondary inline-flex">{tr({ fi: "Avaa täydellinen event-audit", en: "Open full event audit", es: "Abrir auditoría completa" })}</Link><Link href={`/market-timeline?eventId=${encodeURIComponent(detail.eventId)}`} className="sc-button-secondary inline-flex" data-match-activity-link="true">{tr({ fi: "Avaa Activity / History", en: "Open Activity / History", es: "Abrir actividad / historial" })}</Link></div></section>
  </div>;
}
