"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value, digits = 1) {
  const parsed = finite(value);
  return parsed === null ? "—" : `${(parsed * 100).toFixed(digits)}%`;
}

function fixed(value, digits = 2) {
  const parsed = finite(value);
  return parsed === null ? "—" : parsed.toFixed(digits);
}

function booleanLabel(value, tr) {
  if (value === true) return tr({ fi: "kyllä", en: "yes", es: "sí" });
  if (value === false) return tr({ fi: "ei", en: "no", es: "no" });
  return "—";
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div>
      <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{value ?? "—"}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{detail}</div> : null}
    </div>
  );
}

function DecisionInput({ title, input, children }) {
  return (
    <article className="rounded-[1.35rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-black text-[var(--sc-text)]">{title}</h3>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">
          {input?.usedForDecision === true ? "USED" : "—"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-[var(--sc-muted)]">{children}</div>
    </article>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-2.5">
      <span>{label}</span>
      <strong className="text-right text-[var(--sc-text)]">{value ?? "—"}</strong>
    </div>
  );
}

export default function DecisionEvidenceClient({ eventId, sport, selection }) {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, error: "", detail: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId, sport });
        if (selection) query.set("selection", selection);
        const response = await fetch(`/api/event-detail?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Decision evidence unavailable");
        if (!cancelled) setState({ loading: false, error: "", detail: payload.detail || null });
      } catch (error) {
        if (!cancelled) setState({ loading: false, error: error instanceof Error ? error.message : "Decision evidence unavailable", detail: null });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [eventId, sport, selection]);

  const evidence = state.detail?.decisionEvidence || null;
  const selected = useMemo(() => {
    if (!state.detail) return null;
    return state.detail.selections?.find((item) => item.selection === (selection || state.detail.selectedSelection)) || state.detail.selections?.[0] || null;
  }, [state.detail, selection]);

  if (state.loading) {
    return <section className="sc-surface rounded-[1.65rem] p-6 text-[var(--sc-muted)]">{tr({ fi: "Rakennetaan päätösevidenssiä…", en: "Building decision evidence…", es: "Construyendo evidencia de decisión…" })}</section>;
  }

  if (!state.detail || !evidence) {
    return (
      <section className="sc-surface rounded-[1.65rem] p-6">
        <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Decision Evidence ei ole saatavilla", en: "Decision Evidence unavailable", es: "Decision Evidence no disponible" })}</div>
        <div className="mt-2 text-sm text-[var(--sc-muted)]">{state.error || tr({ fi: "Päätöscontractia ei löytynyt.", en: "No decision contract was found.", es: "No se encontró contrato de decisión." })}</div>
        <Link href="/events" className="sc-button-secondary mt-4 inline-flex">{tr({ fi: "Takaisin otteluihin", en: "Back to events", es: "Volver a eventos" })}</Link>
      </section>
    );
  }

  const decision = evidence.decision || {};
  const market = evidence.known?.market || {};
  const fixture = evidence.known?.fixture || {};
  const independent = evidence.known?.independentEvidence || {};
  const inputs = evidence.decisionInputs || {};
  const research = evidence.researchOnly || {};
  const missing = Array.isArray(evidence.missing) ? evidence.missing : [];
  const models = Array.isArray(research.ensemble?.models) ? research.ensemble.models : [];
  const fingerprint = String(evidence.fingerprint || "");

  return (
    <div className="space-y-6" data-decision-evidence-v1="true">
      <section className="sc-surface relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--sc-brand-soft)] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Decision Evidence Contract V1</div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[var(--sc-text)] sm:text-5xl">{state.detail.match}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--sc-muted)]">
              {tr({ fi: "Auditoitava erottelu siitä, mikä oikeasti vaikutti tuotepäätökseen ja mikä oli vain research-evidenssiä. Puuttuvia arvoja ei täytetä nollilla.", en: "An auditable split between what actually influenced the product decision and what was research-only evidence. Missing values are not filled with zeros.", es: "Separación auditable entre lo que influyó en la decisión y lo que fue solo evidencia de investigación. Los valores ausentes no se rellenan con ceros." })}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{selected?.selection || evidence.selection || "—"}</div>
            <div className="mt-2 text-3xl font-black text-[var(--sc-text)]">{decision.productDecision || "CAUTION"}</div>
            <div className="mt-1 font-mono text-[10px] text-[var(--sc-faint)]">{fingerprint ? fingerprint.slice(0, 16) : "—"}</div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={tr({ fi: "Kerroin", en: "Odds", es: "Cuota" })} value={fixed(market.odds)} detail={market.bookmaker || "—"} />
          <Metric label="Edge" value={pct(market.edge)} detail={tr({ fi: "vs no-vig konsensus", en: "vs no-vig consensus", es: "vs consenso sin margen" })} />
          <Metric label="EV" value={pct(market.ev)} detail={tr({ fi: "tuotepäätöksen hintainput", en: "price input to product decision", es: "input de precio" })} />
          <Metric label={tr({ fi: "Evidenssin valmius", en: "Evidence readiness", es: "Preparación" })} value={independent.readiness || "unavailable"} detail={`${independent.verifiedCount ?? "—"}/${independent.totalChecks ?? "—"}`} />
        </div>
      </section>

      <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6" data-production-decision-inputs="true">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Tuotantopäätöksen inputit", en: "Production decision inputs", es: "Inputs de decisión" })}</div>
        <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Mikä oikeasti vaikutti päätökseen", en: "What actually influenced the decision", es: "Qué influyó realmente" })}</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <DecisionInput title={tr({ fi: "Markkinadatan laatu", en: "Market data quality", es: "Calidad de mercado" })} input={inputs.marketQuality}>
            <Row label={tr({ fi: "Vedonvälittäjiä", en: "Bookmakers", es: "Casas" })} value={inputs.marketQuality?.bookmakerCount ?? "—"} />
            <Row label={tr({ fi: "Confidence", en: "Confidence", es: "Confianza" })} value={pct(inputs.marketQuality?.confidence)} />
            <Row label={tr({ fi: "Tuoreus", en: "Freshness", es: "Frescura" })} value={inputs.marketQuality?.freshness || "—"} />
            <Row label={tr({ fi: "Playable gate", en: "Playable gate", es: "Gate PLAY" })} value={booleanLabel(inputs.marketQuality?.playable, tr)} />
          </DecisionInput>

          <DecisionInput title={tr({ fi: "Hinta ja arvo", en: "Price and value", es: "Precio y valor" })} input={inputs.priceValue}>
            <Row label="Edge" value={pct(inputs.priceValue?.edge)} />
            <Row label="EV" value={pct(inputs.priceValue?.ev)} />
            <Row label={tr({ fi: "Laatuluokka", en: "Quality grade", es: "Grado" })} value={inputs.priceValue?.qualityGrade || "—"} />
          </DecisionInput>

          <DecisionInput title={tr({ fi: "Independent safety gate", en: "Independent safety gate", es: "Gate independiente" })} input={inputs.independentSafetyGate}>
            <Row label={tr({ fi: "Valmius", en: "Readiness", es: "Preparación" })} value={inputs.independentSafetyGate?.readiness || "—"} />
            <Row label={tr({ fi: "Ristiriitoja", en: "Conflicts", es: "Conflictos" })} value={inputs.independentSafetyGate?.conflictCount ?? "—"} />
            <Row label={tr({ fi: "Voi nostaa päätöstä", en: "May upgrade", es: "Puede mejorar" })} value={booleanLabel(inputs.independentSafetyGate?.mayUpgradeMarketDecision, tr)} />
            <Row label={tr({ fi: "Voi laskea päätöstä", en: "May downgrade", es: "Puede reducir" })} value={booleanLabel(inputs.independentSafetyGate?.mayDowngradeMarketDecision, tr)} />
          </DecisionInput>
        </div>
        {decision.reason ? <div className="mt-4 rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]"><strong className="text-[var(--sc-text)]">{tr({ fi: "Päätössyy", en: "Decision reason", es: "Motivo" })}:</strong> {decision.reason}</div> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Research only</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--sc-text)]">{tr({ fi: "Näkyvissä, mutta ei tuotantopäätöksessä", en: "Visible, but not used in the production decision", es: "Visible, pero no usado en producción" })}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Feature Engine" value={`${research.featureEngine?.eligible ?? "—"}/${research.featureEngine?.total ?? "—"}`} detail={research.featureEngine?.snapshotHash ? `hash ${String(research.featureEngine.snapshotHash).slice(0, 12)}` : tr({ fi: "Ei snapshot-hashia", en: "No snapshot hash", es: "Sin hash" })} />
            <Metric label="Shadow ensemble" value={pct(research.ensemble?.shadowProbability)} detail={`${research.ensemble?.researchEligible ?? "—"} research · ${research.ensemble?.calibrationReady ?? "—"} calibration-ready`} />
            <Metric label={tr({ fi: "Uncertainty index", en: "Uncertainty index", es: "Índice uncertainty" })} value={finite(research.uncertainty?.index) ?? "—"} detail={tr({ fi: "Ei probability CI", en: "Not a probability CI", es: "No es intervalo de probabilidad" })} />
            <Metric label="Form / Rest" value={research.formRest?.status || "unavailable"} detail={research.formRest?.probabilityDelta === null || research.formRest?.probabilityDelta === undefined ? "Δ —" : `Δ ${pct(research.formRest.probabilityDelta)}`} />
          </div>

          <div className="mt-5 space-y-3">
            {models.map((model) => (
              <div key={`${model.modelId}-${model.modelVersion}`} className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="font-black text-[var(--sc-text)]">{model.modelId || "unknown model"}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{model.modelVersion || "—"}</div></div>
                  <span className="rounded-full border border-[var(--sc-border)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--sc-muted)]">NOT USED</span>
                </div>
                <div className="mt-3 text-xs text-[var(--sc-muted)]">{tr({ fi: "Probability", en: "Probability", es: "Probabilidad" })} {pct(model.probability)} · N {model.sampleSize ?? "—"} · calibration {booleanLabel(model.calibrationReady, tr)}</div>
              </div>
            ))}
            {!models.length ? <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Research-mallirivejä ei ole saatavilla.", en: "No research-model rows are available.", es: "No hay modelos research disponibles." })}</div> : null}
          </div>
        </div>

        <div className="space-y-6">
          <section className="sc-surface rounded-[1.65rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">{tr({ fi: "Puuttuva evidenssi", en: "Missing evidence", es: "Evidencia ausente" })}</div>
            <div className="mt-4 space-y-2">
              {missing.map((item) => <div key={item} className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-sm text-[var(--sc-muted)]">{item}</div>)}
              {!missing.length ? <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3 text-sm text-[var(--sc-muted)]">{tr({ fi: "Contract ei raportoi puuttuvaa evidenssiä.", en: "The contract reports no missing evidence.", es: "El contrato no reporta evidencia ausente." })}</div> : null}
            </div>
          </section>

          <section className="sc-surface rounded-[1.65rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Contract invariants</div>
            <div className="mt-4 space-y-2 text-sm text-[var(--sc-muted)]">
              <Row label={tr({ fi: "Puuttuva data imputoitu", en: "Missing data imputed", es: "Datos imputados" })} value={booleanLabel(evidence.invariants?.missingDataImputed, tr)} />
              <Row label={tr({ fi: "Research voi esiintyä päätösinputtina", en: "Research may masquerade as decision input", es: "Research puede aparentar input" })} value={booleanLabel(evidence.invariants?.researchMayMasqueradeAsDecisionInput, tr)} />
              <Row label={tr({ fi: "Context voi nostaa päätöstä", en: "Context can upgrade", es: "Contexto puede mejorar" })} value={booleanLabel(evidence.invariants?.contextCanUpgrade, tr)} />
              <Row label={tr({ fi: "Oikean rahan toiminto", en: "Real-money action", es: "Acción con dinero real" })} value={booleanLabel(evidence.invariants?.realMoneyActionAvailable, tr)} />
            </div>
          </section>

          <section className="sc-surface rounded-[1.65rem] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">Trace</div>
            <div className="mt-3 break-all font-mono text-xs leading-5 text-[var(--sc-muted)]">{fingerprint || "—"}</div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/match-intelligence?eventId=${encodeURIComponent(eventId)}&sport=${encodeURIComponent(sport)}`} className="sc-button-secondary inline-flex">Match Intelligence</Link>
              <Link href={`/event/${encodeURIComponent(eventId)}?sport=${encodeURIComponent(sport)}${selected?.selection ? `&selection=${encodeURIComponent(selected.selection)}` : ""}`} className="sc-button-secondary inline-flex">Event Audit</Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
