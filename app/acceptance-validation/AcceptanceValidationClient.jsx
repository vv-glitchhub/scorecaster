"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { MetricTile, PageHero, SectionHeader } from "../components/ProductUI";
import { buildAcceptanceValidationV1 } from "../../lib/acceptance-validation-v1.mjs";

const EMPTY = {
  health: null,
  intelligence: null,
  calibration: null,
  control: null,
  operations: null
};

const STATUS_STYLE = {
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  collecting: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  checking: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  external: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  "auth-required": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  "optional-gap": "border-slate-400/20 bg-slate-400/10 text-slate-300",
  "provider-gap": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  unknown: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  blocked: "border-rose-400/30 bg-rose-400/10 text-rose-300"
};

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value) {
  const parsed = finite(value);
  return parsed === null ? "–" : Math.round(parsed).toLocaleString("fi-FI");
}

function decimal(value, digits = 4) {
  const parsed = finite(value);
  return parsed === null ? "–" : parsed.toFixed(digits);
}

function percent(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "–" : `${(parsed * 100).toFixed(digits)} %`;
}

function statusLabel(value, tr) {
  const labels = {
    ready: tr({ fi: "VALMIS", en: "READY", es: "LISTO" }),
    collecting: tr({ fi: "KERÄÄNTYY", en: "COLLECTING", es: "RECOPILANDO" }),
    checking: tr({ fi: "TARKISTETAAN", en: "CHECKING", es: "COMPROBANDO" }),
    external: tr({ fi: "ULKOINEN TESTI", en: "EXTERNAL TEST", es: "PRUEBA EXTERNA" }),
    "auth-required": tr({ fi: "KIRJAUDU", en: "SIGN IN", es: "INICIAR SESIÓN" }),
    "optional-gap": tr({ fi: "VALINNAINEN PUUTE", en: "OPTIONAL GAP", es: "FALTA OPCIONAL" }),
    "provider-gap": tr({ fi: "PROVIDER-PUUTE", en: "PROVIDER GAP", es: "FALTA PROVEEDOR" }),
    unknown: tr({ fi: "TARKISTETAAN", en: "CHECKING", es: "COMPROBANDO" }),
    blocked: tr({ fi: "BLOKATTU", en: "BLOCKED", es: "BLOQUEADO" })
  };
  return labels[value] || String(value || "–").toUpperCase();
}

function CheckRow({ item, tr }) {
  return (
    <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-black text-[var(--sc-text)]">{item.label}</div>
          {item.detail && <div className="mt-1 break-words text-xs leading-5 text-[var(--sc-muted)]">{item.detail}</div>}
          {item.value !== undefined && <div className="mt-1 text-xs text-[var(--sc-muted)]">{number(item.value)}</div>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.12em] ${STATUS_STYLE[item.status] || STATUS_STYLE.unknown}`}>
          {statusLabel(item.status, tr)}
        </span>
      </div>
    </div>
  );
}

function overallCopy(status, tr) {
  const map = {
    checking: {
      label: "CHECKING LIVE STATE",
      tone: "sky",
      title: tr({ fi: "Tarkistetaan tuotanto ja todistusaineisto", en: "Checking production and evidence", es: "Comprobando producción y evidencia" })
    },
    "code-blocked": {
      label: "CODE BLOCKED",
      tone: "sky",
      title: tr({ fi: "Tuotantokoodissa on vielä blokkeri", en: "Production code still has a blocker", es: "El código de producción aún tiene un bloqueo" })
    },
    "collecting-evidence": {
      label: "EVIDENCE COLLECTING",
      tone: "sky",
      title: tr({ fi: "Koodi toimii — nyt kerätään todistusaineisto", en: "The code works — now the evidence must accumulate", es: "El código funciona — ahora debe acumularse evidencia" })
    },
    "external-acceptance-pending": {
      label: "EXTERNAL ACCEPTANCE",
      tone: "sky",
      title: tr({ fi: "Mallinäyttö riittää arviointiin — ulkoiset testit ovat jäljellä", en: "Model evidence is reviewable — external acceptance remains", es: "La evidencia del modelo es revisable — falta aceptación externa" })
    },
    "release-review-ready": {
      label: "RELEASE REVIEW READY",
      tone: "emerald",
      title: tr({ fi: "Scorecaster on valmis release-arvioon", en: "Scorecaster is ready for release review", es: "Scorecaster está listo para revisión de lanzamiento" })
    }
  };
  return map[status] || map.checking;
}

function bestModel(models = []) {
  return [...models].sort((left, right) => {
    const leftSkill = finite(left?.marketBenchmark?.brierSkillScore) ?? -Infinity;
    const rightSkill = finite(right?.marketBenchmark?.brierSkillScore) ?? -Infinity;
    if (leftSkill !== rightSkill) return rightSkill - leftSkill;
    return Number(right?.sampleSize || 0) - Number(left?.sampleSize || 0);
  })[0] || null;
}

export default function AcceptanceValidationClient() {
  const { tr, locale } = useLanguage();
  const [overview, setOverview] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [holdout, setHoldout] = useState({ loading: false, loaded: false, error: "", payload: null });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setOverviewError("");
    try {
      const responses = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/intelligence-core/health", { cache: "no-store" }),
        fetch("/api/calibration/health", { cache: "no-store" }),
        fetch("/api/production-control-center?hours=24&limit=5000", { cache: "no-store" }),
        fetch("/api/operations", { cache: "no-store" })
      ]);
      const payloads = await Promise.all(responses.map(async (response) => {
        try { return await response.json(); } catch { return null; }
      }));
      const [health, intelligence, calibration, control, operations] = payloads;
      if (!health?.app) throw new Error("Production health response is invalid");
      setOverview({
        health,
        intelligence: intelligence || null,
        calibration: calibration || null,
        control: control || null,
        operations: responses[4].ok ? operations : null
      });
      const publicFailures = responses.slice(0, 4).filter((response) => !response.ok).length;
      if (publicFailures) setOverviewError(tr({
        fi: "Osa julkisista tuotantotarkistuksista ei vastannut täydellisesti. Näkymä näyttää saatavilla olevan tilan.",
        en: "Some public production checks did not respond cleanly. Available evidence is still shown.",
        es: "Algunas comprobaciones públicas no respondieron correctamente. Se muestra la evidencia disponible."
      }));
    } catch (error) {
      setOverview(EMPTY);
      setOverviewError(error instanceof Error ? error.message : tr({ fi: "Tilaa ei voitu ladata.", en: "Status could not be loaded.", es: "No se pudo cargar el estado." }));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  async function loadHoldout() {
    setHoldout((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/api/model-holdout?days=180", { cache: "no-store", signal: AbortSignal.timeout(55_000) });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Holdout report unavailable");
      setHoldout({ loading: false, loaded: true, error: "", payload });
    } catch (error) {
      setHoldout({
        loading: false,
        loaded: true,
        payload: null,
        error: error?.name === "TimeoutError"
          ? tr({ fi: "180 päivän validointi aikakatkaistiin. Yritä uudelleen.", en: "The 180-day validation timed out. Try again.", es: "La validación de 180 días agotó el tiempo. Inténtalo de nuevo." })
          : tr({ fi: "Holdout-validointia ei saatu nyt ladattua.", en: "Holdout validation is currently unavailable.", es: "La validación holdout no está disponible." })
      });
    }
  }

  const status = useMemo(() => buildAcceptanceValidationV1(overview), [overview]);
  const hero = overallCopy(status.overallStatus, tr);
  const report = holdout.payload?.report || null;
  const models = Array.isArray(report?.models) ? report.models : [];
  const leader = bestModel(models);
  const benchmark = leader?.marketBenchmark || {};
  const timestamp = overview.health?.timestamp ? new Date(overview.health.timestamp) : null;
  const timestampText = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleString(locale) : "–";
  const checking = status.overallStatus === "checking";

  return (
    <div className="space-y-7" data-acceptance-validation-v1="true">
      <PageHero
        eyebrow={`Acceptance & Validation V1 · ${hero.label}`}
        tone={hero.tone}
        title={hero.title}
        description={tr({
          fi: "Yksi näkymä kertoo, onko tuotanto terve, paljonko ennuste- ja lopputulosdataa on kertynyt, onko kronologisesti turvallista learning-aineistoa syntynyt, onko paperikalibraatiota riittävästi ja päihittääkö riippumaton malli markkinan holdout-testissä.",
          en: "One surface shows production health, prediction and outcome volume, chronology-safe learning evidence, settled paper calibration and whether an independent model beats the market benchmark on holdout data.",
          es: "Una vista muestra salud de producción, volumen de predicciones y resultados, evidencia cronológica, calibración simulada y comparación holdout del modelo con el mercado."
        })}
        actions={<>
          <button type="button" onClick={() => void loadOverview()} disabled={loading} className="sc-button-primary disabled:opacity-50">
            {loading ? tr({ fi: "Tarkistetaan…", en: "Checking…", es: "Comprobando…" }) : tr({ fi: "Päivitä kaikki", en: "Refresh all", es: "Actualizar todo" })}
          </button>
          <button type="button" onClick={() => void loadHoldout()} disabled={holdout.loading} className="sc-button-secondary disabled:opacity-50">
            {holdout.loading ? tr({ fi: "Lasketaan…", en: "Evaluating…", es: "Evaluando…" }) : tr({ fi: "Aja 180 pv model vs market", en: "Run 180d model vs market", es: "Ejecutar modelo vs mercado 180d" })}
          </button>
          <Link href="/model-lab#validation-lab" className="sc-button-ghost">Validation Lab</Link>
        </>}
        aside={<div className="grid grid-cols-2 gap-2">
          <MetricTile compact label={tr({ fi: "Koodi", en: "Code", es: "Código" })} value={checking ? "…" : status.codeReady ? "READY" : "CHECK"} tone={checking ? "blue" : status.codeReady ? "green" : "yellow"} />
          <MetricTile compact label={tr({ fi: "Näyttö", en: "Evidence", es: "Evidencia" })} value={checking ? "…" : status.evidenceReady ? "READY" : "GROWING"} tone={status.evidenceReady ? "green" : "blue"} />
        </div>}
      />

      {overviewError && <div role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{overviewError}</div>}

      <section>
        <SectionHeader
          eyebrow={tr({ fi: "Todellinen aineisto", en: "Real evidence", es: "Evidencia real" })}
          title={tr({ fi: "Mitä Scorecasterilla on nyt todistettavana?", en: "What evidence does Scorecaster have now?", es: "¿Qué evidencia tiene Scorecaster ahora?" })}
          description={tr({ fi: "Tyhjä otos näytetään tyhjänä. Sitä ei korvata simuloidulla tai nollaksi täytetyllä suorituskyvyllä.", en: "An empty sample stays empty. It is never replaced with simulated or zero-filled performance.", es: "Una muestra vacía permanece vacía; nunca se sustituye por rendimiento simulado." })}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricTile label={tr({ fi: "Malliennusteet", en: "Model predictions", es: "Predicciones" })} value={number(status.metrics.modelPredictions)} hint={tr({ fi: "Tallennetut shadow-ennusteet", en: "Stored shadow predictions", es: "Predicciones shadow guardadas" })} tone="blue" />
          <MetricTile label={tr({ fi: "Vahvistetut tulokset", en: "Verified outcomes", es: "Resultados verificados" })} value={number(status.metrics.verifiedFinalOutcomes)} hint={tr({ fi: "Finality verified", en: "Finality verified", es: "Finalidad verificada" })} tone="green" />
          <MetricTile label={tr({ fi: "Learning-esimerkit", en: "Learning examples", es: "Ejemplos learning" })} value={number(status.metrics.learningExamples)} hint={`${status.minimumReviewSample}+ ${tr({ fi: "ennen review-otosta", en: "before review sample", es: "antes de revisión" })}`} tone={(status.metrics.learningExamples ?? 0) >= status.minimumReviewSample ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "Kalibraatiohavainnot", en: "Calibration observations", es: "Observaciones calibración" })} value={number(status.metrics.calibrationObservations)} hint={`${status.minimumReviewSample}+ ${tr({ fi: "ennen review-otosta", en: "before review sample", es: "antes de revisión" })}`} tone={(status.metrics.calibrationObservations ?? 0) >= status.minimumReviewSample ? "green" : "yellow"} />
          <MetricTile label={tr({ fi: "ML-ennusteet", en: "ML predictions", es: "Predicciones ML" })} value={number(status.metrics.mlPredictions)} hint={tr({ fi: "Challenger pysyy shadow-tilassa", en: "Challenger remains shadow-only", es: "Challenger sigue en shadow" })} tone="purple" />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
          <SectionHeader eyebrow="Runtime" title={tr({ fi: "Koodi ja tuotanto", en: "Code and production", es: "Código y producción" })} description={tr({ fi: "Näiden pitää olla kunnossa ennen kuin mallinäytöllä on merkitystä.", en: "These must be healthy before model evidence matters.", es: "Deben estar correctos antes de evaluar el modelo." })} />
          <div className="grid gap-3 sm:grid-cols-2">{status.codeChecks.map((item) => <CheckRow key={item.id} item={item} tr={tr} />)}</div>
        </div>
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
          <SectionHeader eyebrow="Evidence" title={tr({ fi: "Validointigatet", en: "Validation gates", es: "Puertas de validación" })} description={tr({ fi: "Nämä muuttuvat valmiiksi vasta oikean pregame- ja settlement-aineiston perusteella.", en: "These become ready only from real pregame and settlement evidence.", es: "Solo se completan con evidencia real previa y liquidada." })} />
          <div className="grid gap-3">{status.evidenceChecks.map((item) => <CheckRow key={item.id} item={item} tr={tr} />)}</div>
        </div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-model-vs-market-acceptance="true">
        <SectionHeader
          eyebrow="Model vs Market"
          title={tr({ fi: "Päihittääkö riippumaton malli markkinan?", en: "Does the independent model beat the market?", es: "¿Supera el modelo independiente al mercado?" })}
          description={tr({ fi: "Holdout-testi käynnistyy vain painikkeesta, jotta sivun avaaminen ei tee automaattista tulospalvelutyötä. Historiallinen paremmuus ei takaa tulevaa tuottoa.", en: "The holdout test runs only on request so opening this page does not trigger result-provider work. Historical outperformance does not guarantee future returns.", es: "La prueba holdout se ejecuta solo a petición. El rendimiento histórico no garantiza resultados futuros." })}
          action={<button type="button" onClick={() => void loadHoldout()} disabled={holdout.loading} className="sc-button-secondary disabled:opacity-50">{holdout.loading ? "…" : tr({ fi: "Laske nyt", en: "Evaluate now", es: "Evaluar ahora" })}</button>}
        />

        {!holdout.loaded && <div className="rounded-2xl border border-dashed border-[var(--sc-border-strong)] bg-[var(--sc-surface-soft)] p-6 text-sm leading-6 text-[var(--sc-muted)]">{tr({ fi: "Model vs market -tulos ei ole vielä ladattu tässä istunnossa. Tämä ei tarkoita arvoa 0 — paina Laske nyt.", en: "Model-versus-market evidence has not been loaded in this session. This does not mean zero performance — select Evaluate now.", es: "La evidencia modelo-mercado no se ha cargado. No significa rendimiento cero." })}</div>}
        {holdout.error && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{holdout.error}</div>}
        {holdout.loaded && !holdout.error && <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label={tr({ fi: "Settled evaluation", en: "Settled evaluation", es: "Evaluación liquidada" })} value={number(report?.counts?.settledEvaluations)} tone="blue" />
            <MetricTile label={tr({ fi: "Market-paired", en: "Market-paired", es: "Emparejado mercado" })} value={number(report?.counts?.marketComparableEvaluations)} tone="green" />
            <MetricTile label={tr({ fi: "Malleja", en: "Models", es: "Modelos" })} value={number(report?.counts?.models)} tone="purple" />
            <MetricTile label="Brier skill" value={percent(benchmark.brierSkillScore)} tone={(finite(benchmark.brierSkillScore) ?? 0) > 0 ? "green" : "yellow"} />
          </div>
          {leader ? <div className="mt-5 rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--sc-brand)]">{tr({ fi: "Paras saatavilla oleva vertailu", en: "Best available comparison", es: "Mejor comparación disponible" })}</div><h3 className="mt-1 text-xl font-black text-[var(--sc-text)]">{leader.modelId || leader.modelVersion || "Research model"}</h3></div>
              <span className="rounded-full border border-[var(--sc-border)] px-3 py-1 text-xs font-black text-[var(--sc-text-secondary)]">{leader.validationEvidence?.stage || leader.status || "collecting"}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <MetricTile compact label={tr({ fi: "Otos", en: "Sample", es: "Muestra" })} value={number(leader.sampleSize)} />
              <MetricTile compact label="Model Brier" value={decimal(benchmark.pairedModelBrier ?? leader.brierScore)} />
              <MetricTile compact label="Market Brier" value={decimal(benchmark.marketBrier)} />
              <MetricTile compact label="Brier skill" value={percent(benchmark.brierSkillScore)} />
              <MetricTile compact label="Model log loss" value={decimal(benchmark.pairedModelLogLoss ?? leader.logLoss)} />
              <MetricTile compact label="Δ log loss" value={decimal(benchmark.logLossImprovement)} />
            </div>
          </div> : <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-[var(--sc-muted)]">{tr({ fi: "Arvioitavaa shadow-mallin otosta ei vielä ole. Collecting on oikea tila.", en: "There is no evaluable shadow-model sample yet. Collecting is the correct state.", es: "Aún no hay muestra shadow evaluable. El estado correcto es recopilando." })}</div>}
        </>}
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
        <SectionHeader eyebrow="External acceptance" title={tr({ fi: "Mitä ei saa kuitata valmiiksi koodilla", en: "What code cannot mark complete", es: "Lo que el código no puede completar" })} description={tr({ fi: "Fyysinen laite, oikea sähköpostilinkki ja Supabase Auth -asetus tarvitsevat oikean ulkoisen todisteen. Provider-puutteet pysyvät näkyvissä.", en: "A physical device, real email link and Supabase Auth setting require external evidence. Provider gaps remain explicit.", es: "Un dispositivo físico, correo real y configuración Auth requieren evidencia externa." })} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{status.externalChecks.map((item) => <CheckRow key={item.id} item={item} tr={tr} />)}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["/login", tr({ fi: "1. Auth-testi", en: "1. Auth test", es: "1. Prueba Auth" })],
          ["/events", tr({ fi: "2. Avaa ottelu", en: "2. Open event", es: "2. Abrir evento" })],
          ["/tracking", tr({ fi: "3. Paperiveto", en: "3. Paper pick", es: "3. Apuesta simulada" })],
          ["/calibration-center", tr({ fi: "4. Settlement & calibration", en: "4. Settlement & calibration", es: "4. Liquidación y calibración" })],
          ["/release-readiness", tr({ fi: "5. Release review", en: "5. Release review", es: "5. Revisión release" })]
        ].map(([href, label]) => <Link key={href} href={href} className="sc-card-hover rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 font-black text-[var(--sc-text-secondary)] hover:text-[var(--sc-brand)]">{label}</Link>)}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--sc-faint)]">
        <span>{tr({ fi: "Tuotantotila tarkistettu", en: "Production state checked", es: "Estado comprobado" })}: {timestampText}</span>
        <span>{status.version} · PAPER ONLY · NO AUTOMATIC MODEL PROMOTION</span>
      </div>
    </div>
  );
}
