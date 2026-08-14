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
  return (
    <div className="sc-surface rounded-[1.4rem] p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{value}</div>
      {detail ? <div className="mt-2 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div> : null}
    </div>
  );
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

  const stateLabel = state === "observed"
    ? tr({ fi: "havaittu", en: "observed", es: "observado" })
    : state === "no-observations"
      ? tr({ fi: "0 havaintoa", en: "0 observations", es: "0 observaciones" })
      : tr({ fi: "data puuttuu", en: "data missing", es: "faltan datos" });

  return (
    <article className="rounded-[1.4rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-black text-[var(--sc-text)]">{title || "—"}</div>
        <span className="rounded-full border border-[var(--sc-border)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--sc-muted)]">{stateLabel}</span>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-2.5 text-sm">
            <span className="text-[var(--sc-muted)]">{label}</span>
            <strong className="text-[var(--sc-text)]">{value ?? "—"}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ModelRoom({ models, tr }) {
  if (!models.length) {
    return <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tälle ottelulle ei ole vielä julkaistavia research-mallirivejä.", en: "There are no publishable research-model rows for this event yet.", es: "Aún no hay modelos de investigación publicables para este evento." })}</div>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {models.map((model) => (
        <article key={`${model.modelId}-${model.modelVersion}`} className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="truncate font-black text-[var(--sc-text)]">{model.modelId || model.modelVersion || "unknown model"}</div><div className="mt-1 truncate text-xs text-[var(--sc-muted)]">{model.modelVersion || "—"}</div></div>
            <span className="rounded-full border border-[var(--sc-border)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">{model.performance?.calibrationReady === true ? tr({ fi: "kalibrointi ready", en: "calibration ready", es: "calibración lista" }) : model.performance?.status || "unvalidated"}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[var(--sc-faint)]">{tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" })}</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{probability(model.probability)}</div></div>
            <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[var(--sc-faint)]">N</div><div className="mt-1 text-lg font-black text-[var(--sc-text)]">{finite(model.performance?.sampleSize) > 0 ? finite(model.performance?.sampleSize) : "—"}</div></div>
          </div>
          <div className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Päätöspaino", en: "Decision weight", es: "Peso de decisión" })}: <strong className="text-[var(--sc-text)]">{model.eligibleForDecisionWeight === true ? tr({ fi: "kelpoinen", en: "eligible", es: "apto" }) : tr({ fi: "ei", en: "no", es: "no" })}</strong> · {tr({ fi: "Riippumaton", en: "Independent", es: "Independiente" })}: <strong className="text-[var(--sc-text)]">{model.independentPredictiveModel === true ? tr({ fi: "kyllä", en: "yes", es: "sí" }) : tr({ fi: "ei", en: "no", es: "no" })}</strong></div>
        </article>
      ))}
    </div>
  );
}

export default function MatchIntelligenceClient({ eventId, sport }) {
  const { tr, locale } = useLanguage();
  const { proMode, toggleProMode } = useProfessionalPreferences();
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Analysis unavailable");
        if (!cancelled) setState({ loading: false, error: "", detail: payload.detail || null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "Analysis unavailable", detail: null });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, sport]);

  if (state.loading) return <section className="sc-surface overflow-hidden rounded-[1.65rem] p-6" data-match-journey-loading="true"><div className="mx-auto grid max-w-2xl place-items-center py-8 text-center"><div className="grid h-16 w-16 rotate-45 place-items-center rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] shadow-[var(--sc-brand-shadow)]"><div className="h-5 w-5 rounded-md bg-[var(--sc-brand)]" /></div><div className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1</div><h1 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Kartoitetaan varmennettua evidenssiä…", en: "Mapping verified evidence…", es: "Mapeando evidencia verificada…" })}</h1><div className="mt-6 grid w-full grid-cols-4 gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-[var(--sc-muted)]"><span>{tr({ fi: "Tilanne", en: "Context", es: "Contexto" })}</span><span>{tr({ fi: "Evidenssi", en: "Evidence", es: "Evidencia" })}</span><span>{tr({ fi: "Päätös", en: "Decision", es: "Decisión" })}</span><span>Story</span></div><div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sc-border)]"><div className="h-full w-3/4 rounded-full bg-[var(--sc-brand)] motion-safe:animate-pulse" /></div></div></section>;
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
  const featureTotal = finite(featureEngine.counts?.total);
  const featureCoverageAvailable = featureState === "observed" && featureTotal !== null && featureTotal > 0 && finite(featureEngine.eligibilityRate) !== null;

  const readinessDetail = intelligenceState === "missing" ? tr({ fi: "Evidenssipayload puuttuu", en: "Evidence payload missing", es: "Falta el payload de evidencia" }) : intelligenceState === "no-observations" ? tr({ fi: "0 varmennettua havaintoa", en: "0 verified observations", es: "0 observaciones verificadas" }) : `${finite(intelligence.readiness?.verifiedCount) ?? "—"}/${finite(intelligence.readiness?.totalChecks) ?? "—"} ${tr({ fi: "varmennettua tarkistusta", en: "verified checks", es: "comprobaciones verificadas" })}`;
  const featureDetail = featureState === "missing" ? tr({ fi: "Feature-payload puuttuu", en: "Feature payload missing", es: "Falta el payload de features" }) : featureState === "no-observations" ? tr({ fi: "Feature-putki ajoi, mutta havaintoja oli 0", en: "Feature pipeline ran with 0 observations", es: "El pipeline corrió con 0 observaciones" }) : featureCoverageAvailable ? `${finite(featureEngine.counts?.eligible) ?? "—"}/${featureTotal} ${tr({ fi: "kelpoista featurea", en: "eligible features", es: "features aptas" })}` : tr({ fi: "Feature-otos ei ole julkaistavissa", en: "Feature sample is not publishable", es: "La muestra no es publicable" });
  const researchValue = ensembleState === "missing" ? "—" : finite(ensemble.counts?.researchEligible) ?? "—";
  const researchDetail = ensembleState === "missing" ? tr({ fi: "Mallipayload puuttuu", en: "Model payload missing", es: "Falta el payload de modelos" }) : ensembleState === "no-observations" ? tr({ fi: "Malliputki ajoi, mutta mallihavaintoja oli 0", en: "Model pipeline ran with 0 observations", es: "El pipeline corrió con 0 observaciones" }) : `${finite(ensemble.counts?.calibrationReady) ?? "—"} ${tr({ fi: "kalibrointi-ready", en: "calibration-ready", es: "con calibración lista" })}`;

  return (
    <div className="space-y-6" data-match-intelligence-v2="true" data-evidence-semantics-v2="true">
      <section className="sc-surface relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--sc-brand-soft)] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Match Journey V1 · Intelligence V2</div><h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">{detail.match}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Yksi visuaalinen näkymä varmennetusta kontekstista, mallipeitosta, joukkueiden form/rest-tilasta ja mallien erimielisyydestä. Puuttuva tieto pysyy puuttuvana.", en: "One visual view of verified context, model coverage, team form/rest state and model disagreement. Missing information stays missing.", es: "Una vista visual del contexto verificado, cobertura de modelos, forma/descanso y desacuerdo entre modelos. Los datos ausentes siguen ausentes." })}</p></div><button type="button" onClick={toggleProMode} className="sc-button-secondary" aria-pressed={proMode} data-match-intelligence-mode-toggle="true">{proMode ? tr({ fi: "Pro Mode", en: "Pro Mode", es: "Modo Pro" }) : tr({ fi: "Simple Mode", en: "Simple Mode", es: "Modo simple" })}</button></div>
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={tr({ fi: "Analyysin valmius", en: "Analysis readiness", es: "Preparación" })} value={intelligenceState === "missing" ? "—" : intelligence.readiness?.level || "market-only"} detail={readinessDetail} />
          <MetricCard label={tr({ fi: "Feature coverage", en: "Feature coverage", es: "Cobertura" })} value={featureCoverageAvailable ? pct(featureEngine.eligibilityRate, 0) : featureState === "no-observations" ? "0%" : "—"} detail={featureDetail} />
          <MetricCard label={tr({ fi: "Research-mallit", en: "Research models", es: "Modelos research" })} value={researchValue} detail={researchDetail} />
          <MetricCard label={tr({ fi: "Mallien erimielisyys", en: "Model disagreement", es: "Desacuerdo" })} value={ensembleState === "missing" ? "—" : uncertainty.band || "unknown"} detail={finite(uncertainty.range) === null ? tr({ fi: "Range ei saatavilla", en: "Range unavailable", es: "Rango no disponible" }) : `${tr({ fi: "Range", en: "Range", es: "Rango" })}: ${pct(uncertainty.range, 1)}`} />
        </div>
      </section>

      <MatchJourneyV1 detail={detail} sport={sport} tr={tr} locale={locale} />

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-team-comparison="true"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Joukkuekuva", en: "Team snapshot", es: "Vista de equipos" })}</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Form & Rest", en: "Form & Rest", es: "Forma y descanso" })}</h2></div><div className="text-xs text-[var(--sc-muted)]">{formState === "observed" ? tr({ fi: "Chronology-safe shadow-data", en: "Chronology-safe shadow data", es: "Datos shadow cronológicamente seguros" }) : formState === "no-observations" ? tr({ fi: "Putki ajoi · 0 havaintoa", en: "Pipeline ran · 0 observations", es: "Pipeline ejecutado · 0 observaciones" }) : tr({ fi: "Form/rest-data puuttuu", en: "Form/rest data missing", es: "Faltan datos de forma/descanso" })}</div></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><TeamSnapshot title={detail.homeTeam} team={formRest.home} state={homeState} tr={tr} /><TeamSnapshot title={detail.awayTeam} team={formRest.away} state={awayState} tr={tr} /></div></section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Match Map</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Missä analyysi on vahva — ja missä ei", en: "Where the analysis is strong — and where it is not", es: "Dónde es fuerte el análisis — y dónde no" })}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{eligibleFeatures.slice(0, proMode ? 10 : 6).map((item) => <div key={item.id} className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="flex items-start justify-between gap-3"><span className="font-black text-[var(--sc-text)]">{item.id}</span><span className="rounded-full border border-[var(--sc-border)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">{item.family || item.role || "feature"}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--sc-border)]"><div className="h-full rounded-full bg-[var(--sc-brand)]" style={{ width: finite(item.trust) === null ? "0%" : `${Math.max(8, Math.min(100, Math.round(finite(item.trust) * 100)))}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--sc-muted)]"><span>{item.source || tr({ fi: "varmennettu putki", en: "verified pipeline", es: "pipeline verificado" })}</span><span>{finite(item.trust) === null ? "trust —" : `trust ${pct(item.trust, 0)}`}</span></div></div>)}{eligibleFeatures.length === 0 ? <div className="sm:col-span-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-[var(--sc-muted)]">{featureState === "missing" ? tr({ fi: "Feature-data puuttuu tältä ottelulta.", en: "Feature data is missing for this event.", es: "Faltan datos de features para este evento." }) : tr({ fi: "Tälle ottelulle ei ole vielä varmennettuja advanced-featureita.", en: "No verified advanced features are available for this event yet.", es: "Todavía no hay features avanzadas verificadas para este evento." })}</div> : null}</div></div>
        <div className="space-y-6"><section className="sc-surface rounded-[1.65rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Mikä muuttaa analyysiä", en: "What changes the analysis", es: "Qué cambia el análisis" })}</div><div className="mt-4 space-y-3 text-sm text-[var(--sc-muted)]">{missingEvidence.slice(0, 5).map((item) => <div key={`missing-${item}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><strong className="text-[var(--sc-text)]">{tr({ fi: "Puuttuu", en: "Missing", es: "Falta" })}:</strong> {item}</div>)}{gateReasons.slice(0, 5).map((item) => <div key={`gate-${item}`} className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><strong className="text-[var(--sc-text)]">{tr({ fi: "Malligate", en: "Model gate", es: "Gate del modelo" })}:</strong> {item}</div>)}{!missingEvidence.length && !gateReasons.length ? <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">{tr({ fi: "Lisätriggeriä ei ole julkaistu tälle hetkelle.", en: "No additional analysis trigger is currently published.", es: "No hay un trigger adicional publicado actualmente." })}</div> : null}</div></section><section className="sc-surface rounded-[1.65rem] p-5"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Turvaraja", en: "Boundary", es: "Límite" })}</div><p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Näkymä tiivistää vain olemassa olevan varmennetun analyysin. Se ei keksi puuttuvia arvoja, muuta production-todennäköisyyksiä tai muuta tuotepäätöstä.", en: "This view summarizes existing verified analysis only. It does not invent missing values, change production probabilities, or alter product decisions.", es: "Esta vista solo resume el análisis verificado existente. No inventa valores ausentes ni cambia probabilidades o decisiones de producción." })}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/event/${encodeURIComponent(detail.eventId)}?sport=${encodeURIComponent(detail.sportKey || sport)}`} className="sc-button-secondary inline-flex">{tr({ fi: "Avaa täydellinen event-audit", en: "Open full event audit", es: "Abrir auditoría completa" })}</Link><Link href={`/market-timeline?eventId=${encodeURIComponent(detail.eventId)}`} className="sc-button-secondary inline-flex" data-match-activity-link="true">{tr({ fi: "Avaa Activity / History", en: "Open Activity / History", es: "Abrir actividad / historial" })}</Link></div></section></div>
      </section>

      {proMode ? <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-model-room="true"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Model Room</div><h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Riippumattomat research-mallit", en: "Independent research models", es: "Modelos research independientes" })}</h2></div><div className="text-xs text-[var(--sc-muted)]">{ensembleState === "missing" ? "—" : models.length} {tr({ fi: "malliriviä", en: "model rows", es: "modelos" })}</div></div><div className="mt-5"><ModelRoom models={models} tr={tr} /></div><div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Market benchmark ei ole itsenäinen malli. Research-mallin näkyminen tässä ei tarkoita production-painoa tai automaattista promootiota.", en: "The market benchmark is not an independent model. Appearance here does not imply a production weight or automatic promotion.", es: "El benchmark de mercado no es un modelo independiente. Aparecer aquí no implica peso de producción ni promoción automática." })}</div></section> : null}
    </div>
  );
}
