"use client";

import { SectionHeader } from "../../components/ProductUI";
import { useLanguage } from "../../components/LanguageProvider";

function number(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value) {
  const parsed = number(value);
  return parsed === null ? "–" : `${(parsed * 100).toFixed(1)}%`;
}

function compact(value, fallback = "–") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function badgeClass(ok) {
  return ok
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    : "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

function AuditBadge({ ok, children }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${badgeClass(ok)}`}>{children}</span>;
}

function ModelRow({ model, tr }) {
  const performance = model?.performance || {};
  return (
    <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-black text-[var(--sc-text)]">{compact(model?.modelId)}</div>
          <div className="mt-1 break-all text-xs text-[var(--sc-muted)]">{compact(model?.dependenceGroup, tr({ fi: "ei riippuvuusryhmää", en: "no dependence group", es: "sin grupo de dependencia" }))}</div>
        </div>
        <AuditBadge ok={model?.eligibleForResearch === true}>{model?.eligibleForResearch === true ? tr({ fi: "mukana", en: "eligible", es: "válido" }) : tr({ fi: "estetty", en: "blocked", es: "bloqueado" })}</AuditBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Todennäköisyys", en: "Probability", es: "Probabilidad" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(model?.probability)}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Paino", en: "Weight", es: "Peso" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{number(model?.researchWeight) ?? "–"}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Holdout N", en: "Holdout N", es: "Holdout N" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{number(performance?.sampleSize, 0)}</div></div>
        <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Kalibroitu paino", en: "Calibrated weight", es: "Peso calibrado" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{performance?.calibrationReady === true ? tr({ fi: "kyllä", en: "yes", es: "sí" }) : tr({ fi: "ei", en: "no", es: "no" })}</div></div>
      </div>
      {Array.isArray(model?.rejectionReasons) && model.rejectionReasons.length > 0 ? <div className="mt-3 text-xs leading-5 text-amber-100">{model.rejectionReasons.join(" · ")}</div> : null}
    </div>
  );
}

export default function EventModelAuditPanel({ row }) {
  const { tr } = useLanguage();
  const factory = row?.modelFactory || {};
  const ensemble = row?.ensembleEngine || {};
  const rating = row?.historicalRatingShadow || {};
  const architecture = row?.decisionArchitecture || {};
  const models = Array.isArray(ensemble?.models) ? ensemble.models : [];
  const rejected = Array.isArray(factory?.rejectedModels) ? factory.rejectedModels : [];
  const inventory = Array.isArray(factory?.inventory) ? factory.inventory : [];
  const riskGate = ensemble?.researchRiskGate || {};
  const counts = ensemble?.counts || {};

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Model Factory → Ensemble"
        title={tr({ fi: "Mitä malleja Scorecaster käytti — ja mitä se esti", en: "Which models Scorecaster used — and which it blocked", es: "Qué modelos usó Scorecaster y cuáles bloqueó" })}
        description={tr({
          fi: "Tämä näkymä näyttää mallien todellisen päätösketjun. Markkinatodennäköisyyttä ei lasketa itsenäiseksi malliksi, korreloituneet mallit eivät saa tuplaääntä ja puuttuvaa dataa ei täytetä arvauksilla.",
          en: "This view exposes the actual model decision chain. Market probability is not counted as an independent model, correlated models cannot double-vote, and missing data is never guessed.",
          es: "Esta vista expone la cadena real de modelos. El mercado no cuenta como modelo independiente, los modelos correlacionados no votan dos veces y los datos ausentes no se inventan."
        })}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Mallituotokset", en: "Model outputs", es: "Salidas" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{number(counts?.researchEligible, 0)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "auditoinnin läpäissyttä", en: "research eligible", es: "válidos para investigación" })}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Riippumattomat ryhmät", en: "Dependence groups", es: "Grupos" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{number(counts?.researchGroups, number(factory?.counts?.uniqueDependenceGroups, 0))}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "tuplalaskenta estetty", en: "double counting blocked", es: "sin doble conteo" })}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Kalibrointivalmiit", en: "Calibration ready", es: "Listos para calibración" })}</div><div className="mt-2 text-2xl font-black text-[var(--sc-text)]">{number(counts?.calibrationReadyGroups, 0)}</div><div className="mt-1 text-xs text-[var(--sc-muted)]">{tr({ fi: "ryhmää holdout-näytöllä", en: "groups with holdout evidence", es: "grupos con holdout" })}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{tr({ fi: "Tutkimusvalmius", en: "Research readiness", es: "Preparación de investigación" })}</div><div className="mt-2"><AuditBadge ok={riskGate?.blocked !== true}>{riskGate?.blocked === true ? tr({ fi: "EI VALMIS", en: "NOT READY", es: "NO LISTO" }) : tr({ fi: "TARKISTETTAVA", en: "REVIEW", es: "REVISAR" })}</AuditBadge></div><div className="mt-2 text-xs text-[var(--sc-muted)]">{riskGate?.blocked === true ? tr({ fi: "Mallikerroksen NO_BET on tutkimusraja, ei käyttäjän kohdepäätös.", en: "The model-layer NO_BET is a research gate, not the user-facing pick decision.", es: "El NO_BET del modelo es un límite de investigación, no la decisión del usuario." }) : tr({ fi: "mallikerros valmis tarkasteluun", en: "model layer ready for review", es: "capa lista para revisión" })}</div></div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div>
          <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{tr({ fi: "Mallikohtainen auditointi", en: "Model audit", es: "Auditoría de modelos" })}</div><div className="mt-1 text-sm text-[var(--sc-muted)]">{tr({ fi: "Todennäköisyys, riippuvuusryhmä ja kalibrointinäyttö.", en: "Probability, dependence group and calibration evidence.", es: "Probabilidad, dependencia y evidencia de calibración." })}</div></div><div className="text-xs text-[var(--sc-faint)]">shadow {percent(ensemble?.shadowProbability)}</div></div>
          <div className="space-y-3">{models.length ? models.map((model) => <ModelRow key={`${model?.modelId}-${model?.modelVersion}-${model?.dependenceGroup}`} model={model} tr={tr} />) : <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm text-[var(--sc-muted)]">{tr({ fi: "Tälle kohteelle ei ole vielä hyväksyttyä itsenäistä shadow-mallia.", en: "No audited independent shadow model is available for this event yet.", es: "Aún no hay un modelo shadow independiente auditado para este evento." })}</div>}</div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">Historical Rating / Elo</div>
            <div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Tila", en: "Status", es: "Estado" })}</span><AuditBadge ok={rating?.status === "ready"}>{compact(rating?.status, "unavailable")}</AuditBadge></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Rating P", en: "Rating P", es: "Rating P" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(rating?.shadowProbability)}</div></div>
              <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Liigaottelut", en: "League events", es: "Eventos de liga" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{number(rating?.sample?.leagueEvents, 0)}</div></div>
              <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Koti-rating", en: "Home rating", es: "Rating local" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{number(rating?.ratings?.home) ?? "–"}</div></div>
              <div><div className="text-[var(--sc-faint)]">{tr({ fi: "Vieras-rating", en: "Away rating", es: "Rating visitante" })}</div><div className="mt-1 font-black text-[var(--sc-text)]">{number(rating?.ratings?.away) ?? "–"}</div></div>
            </div>
            <div className="mt-4 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Vain ennen ottelua päättyneet tapahtumat. Elo ja form/rest kuuluvat samaan historical-results-family -ryhmään.", en: "Completed pre-event results only. Elo and form/rest belong to the same historical-results-family dependence group.", es: "Solo resultados terminados antes del evento. Elo y form/rest comparten el grupo historical-results-family." })}</div>
          </div>

          <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--sc-brand)]">{tr({ fi: "Miksi ei PLAY?", en: "Why not PLAY?", es: "¿Por qué no PLAY?" })}</div>
            <div className="mt-3 space-y-2">{Array.isArray(riskGate?.reasons) && riskGate.reasons.length ? riskGate.reasons.slice(0, 8).map((reason) => <div key={reason} className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">{reason}</div>) : <div className="text-sm text-[var(--sc-muted)]">{tr({ fi: "Ei aktiivisia malliriskin estoja.", en: "No active model-risk blockers.", es: "No hay bloqueos activos de riesgo del modelo." })}</div>}</div>
          </div>
        </div>
      </div>

      {(rejected.length > 0 || inventory.length > 0) ? <details className="mt-6 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Estetyt ja ei-äänestävät mallit", en: "Blocked and non-voting models", es: "Modelos bloqueados y sin voto" })} ({rejected.length + inventory.length})</summary><div className="mt-4 space-y-2 text-xs text-[var(--sc-muted)]">{rejected.map((item, index) => <div key={`${item?.modelId}-${index}`} className="rounded-lg border border-[var(--sc-border)] px-3 py-2"><span className="font-black text-[var(--sc-text)]">{compact(item?.modelId, "unknown-model")}</span> · {(item?.reasons || []).join(" · ")}</div>)}{inventory.map((item, index) => <div key={`${item?.adapter}-${index}`} className="rounded-lg border border-[var(--sc-border)] px-3 py-2"><span className="font-black text-[var(--sc-text)]">{compact(item?.modelId, item?.adapter || "adapter")}</span> · {compact(item?.status)} · {compact(item?.reason)}</div>)}</div></details> : null}

      <div className="mt-6 grid gap-2 text-xs text-[var(--sc-muted)] md:grid-cols-3">
        <div className="rounded-lg border border-[var(--sc-border)] px-3 py-2">productionProbabilityChanged = <strong className="text-[var(--sc-text)]">false</strong></div>
        <div className="rounded-lg border border-[var(--sc-border)] px-3 py-2">automaticPromotionAllowed = <strong className="text-[var(--sc-text)]">false</strong></div>
        <div className="rounded-lg border border-[var(--sc-border)] px-3 py-2">paperOnly = <strong className="text-[var(--sc-text)]">{architecture?.paperOnly === false ? "false" : "true"}</strong></div>
      </div>
    </section>
  );
}
