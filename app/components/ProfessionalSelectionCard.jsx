"use client";

import Link from "next/link";
import { useMemo } from "react";
import { evaluateProfessionalSelection } from "../../lib/professional-selection-evidence.mjs";
import { useLanguage } from "./LanguageProvider";
import { useProfessionalPreferences } from "./ProfessionalPreferencesProvider";

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const text = (value, fallback = "–") => {
  const result = String(value ?? "").trim();
  return result || fallback;
};

const percent = (value, digits = 1) => {
  const number = finite(value);
  if (number === null) return "–";
  return `${number >= 0 ? "+" : ""}${(number * 100).toFixed(digits)} %`;
};

const probability = (value) => {
  const number = finite(value);
  return number === null ? "–" : `${(number * 100).toFixed(1)} %`;
};

const decimal = (value) => {
  const number = finite(value);
  return number !== null && number > 0 ? number.toFixed(2) : "–";
};

function strongestRisk(selection = {}) {
  const sources = [
    selection.largestRisk,
    selection.risk,
    selection.riskReason,
    selection.skipReason,
    selection.negativeFactor,
    selection.warnings?.[0],
    selection.riskWarnings?.[0],
    selection.sportsIntelligence?.conflicts?.[0]?.reason,
    selection.sportsIntelligence?.readiness?.missing?.[0],
    selection.unknowns?.[0]?.reason
  ];
  return sources.find((value) => typeof value === "string" && value.trim()) || null;
}

function strongestPositive(selection = {}) {
  const sources = [
    selection.strongestPositiveFactor,
    selection.positiveFactor,
    selection.decisionReason,
    selection.reason,
    selection.qualityNotes?.[0],
    selection.explanation?.summary
  ];
  return sources.find((value) => typeof value === "string" && value.trim()) || null;
}

function uncertaintyText(selection = {}) {
  const lower = finite(selection.uncertaintyLower ?? selection.uncertainty?.lower ?? selection.probabilityInterval?.lower);
  const upper = finite(selection.uncertaintyUpper ?? selection.uncertainty?.upper ?? selection.probabilityInterval?.upper);
  if (lower !== null && upper !== null) return `${probability(lower)}–${probability(upper)}`;
  const confidence = finite(selection.confidence);
  return confidence !== null ? `${probability(confidence)} confidence` : "unknown";
}

export default function ProfessionalSelectionCard({
  selection = {},
  eventId,
  match,
  homeTeam,
  awayTeam,
  league,
  commenceTime,
  href,
  compact = false,
  onSave,
  saveDisabled = false,
  saveLabel,
  className = ""
}) {
  const { tr, locale } = useLanguage();
  const { bookmakerKey, bookmakerLabel, proMode } = useProfessionalPreferences();
  const evidence = useMemo(
    () => evaluateProfessionalSelection(selection, { bookmakerKey, bookmakerLabel }),
    [selection, bookmakerKey, bookmakerLabel]
  );
  const offer = evidence.selectedOffer;
  const { modelProbability, marketProbability, fairOdds, edge, ev, decision } = evidence;
  const risk = strongestRisk(selection);
  const positive = strongestPositive(selection);
  const selectionLabel = text(selection.selection ?? selection.label ?? selection.name);
  const matchLabel = text(match ?? selection.match, [homeTeam ?? selection.homeTeam, awayTeam ?? selection.awayTeam].filter(Boolean).join(" – ") || "Verified event");
  const targetHref = href || (eventId ? `/event/${encodeURIComponent(eventId)}?sport=${encodeURIComponent(selection.sportKey || selection.sport || "")}&selection=${encodeURIComponent(selectionLabel)}` : null);
  const kickoff = commenceTime ?? selection.commenceTime ?? selection.commence_time;
  const providerUnavailable = offer.preferredProviderUnavailable === true;
  const canSave = typeof onSave === "function" && decision !== "SKIP" && !saveDisabled;
  const boundaryId = `paper-boundary-${String(eventId || selectionLabel || "selection").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const decisionTone = decision === "PLAY"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : decision === "SKIP"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : decision === "CAUTION"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-sky-400/25 bg-sky-400/10 text-sky-200";

  return (
    <article className={`rounded-[1.6rem] border border-[var(--sc-border)] bg-[var(--sc-surface)] p-5 shadow-[0_20px_70px_rgba(2,6,23,0.15)] ${className}`.trim()} data-professional-selection-card data-provider-key={bookmakerKey} data-pro-mode={proMode ? "true" : "false"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{text(league ?? selection.league ?? selection.leagueTitle, "Verified market")}</div>
          <h3 className="mt-1 truncate text-xl font-black tracking-[-0.03em] text-[var(--sc-text)] sm:text-2xl">{matchLabel}</h3>
          <div className="mt-1 text-sm font-bold text-[var(--sc-text-secondary)]">{selectionLabel}</div>
          {kickoff && <div className="mt-1 text-xs text-[var(--sc-muted)]">{new Date(kickoff).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
        </div>
        <span aria-label={`Decision ${decision}`} className={`rounded-full border px-3 py-1.5 text-xs font-black ${decisionTone}`}>{decision}</span>
      </div>

      <div className={`mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 ${compact ? "" : "lg:grid-cols-4"}`}>
        <Metric label={tr({ fi: "Tarjottu hinta", en: "Offered price", es: "Cuota ofrecida" })} value={decimal(offer.odds)} hint={providerUnavailable ? tr({ fi: "Valittu tarjoaja ei ole tässä kohteessa saatavilla", en: "Preferred provider is unavailable for this selection", es: "Proveedor preferido no disponible" }) : offer.bookmaker || bookmakerLabel} warning={providerUnavailable} />
        <Metric label={tr({ fi: "Mallin arvio", en: "Model probability", es: "Probabilidad del modelo" })} value={probability(modelProbability)} hint={evidence.marketOnly ? tr({ fi: "Itsenäistä malliarviota ei ole saatavilla", en: "Independent model evidence unavailable", es: "Modelo independiente no disponible" }) : text(selection.modelVersion ?? selection.model_version, "model evidence")} />
        <Metric label={tr({ fi: "Markkinan no-vig", en: "Market no-vig", es: "Mercado no-vig" })} value={probability(marketProbability)} hint={tr({ fi: "Erillinen vertailuarvo", en: "Separate benchmark", es: "Referencia separada" })} />
        <Metric label="EV" value={percent(ev)} hint={`${tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} ${decimal(fairOdds)}`} good={ev !== null && ev > 0} warning={ev !== null && ev <= 0} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <EvidenceLine label={tr({ fi: "Vahvin peruste", en: "Strongest factor", es: "Factor principal" })} value={positive || tr({ fi: "Ei varmennettua itsenäistä lisäperustetta", en: "No verified independent factor available", es: "Sin factor independiente verificado" })} />
        <EvidenceLine label={tr({ fi: "Suurin riski", en: "Largest risk", es: "Mayor riesgo" })} value={risk || tr({ fi: "Riskiä ei ole kuvattu lähdedatassa", en: "Risk is not described in the source evidence", es: "El riesgo no está descrito" })} warning />
      </div>

      {proMode && <details open className="mt-4 rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4" data-pro-details>
        <summary className="cursor-pointer list-none text-sm font-black text-[var(--sc-text)]">Pro Mode · {tr({ fi: "samat laskelmat, syvempi auditointi", en: "same calculations, deeper audit", es: "mismos cálculos, auditoría ampliada" })}</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Edge" value={percent(edge)} />
          <Metric label={tr({ fi: "Epävarmuus", en: "Uncertainty", es: "Incertidumbre" })} value={uncertaintyText(selection)} />
          <Metric label={tr({ fi: "Datan laatu", en: "Data quality", es: "Calidad de datos" })} value={finite(selection.trustScore ?? selection.dataQualityScore ?? selection.qualityScore) !== null ? `${finite(selection.trustScore ?? selection.dataQualityScore ?? selection.qualityScore).toFixed(1)}/100` : "–"} />
          <Metric label={tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })} value={selection.sourceCount ?? selection.sportsIntelligence?.sourceCount ?? "–"} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <AuditFact label={tr({ fi: "EV-kaava", en: "EV formula", es: "Fórmula EV" })} value="p(model) × offered decimal odds − 1" />
          <AuditFact label={tr({ fi: "Hintaraja", en: "Price boundary", es: "Límite de cuota" })} value="Provider choice changes offered price only; model probability remains unchanged." />
          <AuditFact label={tr({ fi: "Aikaleima", en: "Timestamp", es: "Marca temporal" })} value={offer.observedAt ? new Date(offer.observedAt).toISOString() : text(selection.generatedAt ?? selection.capturedAt, "unavailable")} />
          <AuditFact label={tr({ fi: "Auditointiversio", en: "Audit version", es: "Versión de auditoría" })} value={evidence.version} />
        </div>
      </details>}

      <div id={boundaryId} className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs font-bold leading-5 text-amber-100" data-paper-boundary>
        {tr({ fi: "Vain paperiseuranta: tallentaminen ei aseta oikeaa vetoa, siirrä rahaa tai kirjaudu vedonvälittäjälle.", en: "Paper-only: saving does not place a real bet, move money or sign in to a bookmaker.", es: "Solo simulación: guardar no realiza una apuesta real ni mueve dinero." })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {targetHref && <Link href={targetHref} className="sc-button-secondary">{tr({ fi: "Avaa ottelu", en: "Open event", es: "Abrir evento" })}</Link>}
        {typeof onSave === "function" && <button type="button" onClick={() => canSave && onSave({ ...selection, odds: offer.odds, bookmaker: offer.bookmaker, bookmakerKey: offer.bookmakerKey, evaluatedEv: ev, evaluatedEdge: edge })} disabled={!canSave} className="sc-button-primary disabled:cursor-not-allowed disabled:opacity-40" aria-describedby={boundaryId}>
          {saveLabel || tr({ fi: "Tallenna paperisalkkuun", en: "Save to paper portfolio", es: "Guardar en cartera simulada" })}
        </button>}
      </div>
    </article>
  );
}

function Metric({ label, value, hint, good = false, warning = false }) {
  return <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div><div className={`mt-1 text-xl font-black ${good ? "text-emerald-300" : warning ? "text-amber-200" : "text-[var(--sc-text)]"}`}>{value}</div>{hint && <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{hint}</div>}</div>;
}

function EvidenceLine({ label, value, warning = false }) {
  return <div className={`rounded-xl border p-4 ${warning ? "border-amber-400/20 bg-amber-400/10" : "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]"}`}><div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{label}</div><p className={`mt-2 text-sm leading-6 ${warning ? "text-amber-100" : "text-[var(--sc-text-secondary)]"}`}>{value}</p></div>;
}

function AuditFact({ label, value }) {
  return <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-bg)]/45 p-3"><div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 break-words font-mono text-xs leading-5 text-[var(--sc-text-secondary)]">{value}</div></div>;
}
