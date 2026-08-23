"use client";

import { useLanguage } from "../../components/LanguageProvider";

function pct(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : "—";
}

function label(value) {
  return String(value || "—").replaceAll("-", " ");
}

export default function EventUncertaintyPanel({ row }) {
  const { tr } = useLanguage();
  const uncertainty = row?.uncertaintyEngine;
  const provider = row?.advancedProviderQualification;
  if (!uncertainty && !provider) return null;

  const trust = uncertainty?.components?.find?.((component) => component.id === "data-quality")?.evidence?.trust;
  const coverage = uncertainty?.components?.find?.((component) => component.id === "data-quality")?.evidence?.coverage;
  const reasons = Array.isArray(uncertainty?.reasons) ? uncertainty.reasons : [];
  const providerReasons = Array.isArray(provider?.reasons) ? provider.reasons : [];

  return (
    <section className="sc-surface rounded-[1.6rem] p-5 sm:p-6" data-event-uncertainty-v1="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sc-brand)]">Uncertainty Engine V1</div>
          <h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">
            {tr({ fi: "Epävarmuus ja provider-kelpoisuus", en: "Uncertainty and provider qualification", es: "Incertidumbre y cualificación del proveedor" })}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Indeksi mittaa evidenssiriskin määrää, ei voiton todennäköisyyden luottamusväliä. Puuttuva trust tai coverage estää research-PLAYn fail-closed.",
              en: "The index measures evidence risk, not a probability confidence interval. Missing trust or coverage fails closed and blocks research PLAY.",
              es: "El índice mide riesgo de evidencia, no un intervalo de confianza de probabilidad. La falta de confianza o cobertura bloquea PLAY en modo fail-closed."
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-4 py-3 text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Evidence risk</div>
          <div className="mt-1 text-3xl font-black text-[var(--sc-text)]">{uncertainty?.uncertaintyIndex ?? "—"}/100</div>
          <div className="mt-1 text-xs font-black uppercase text-[var(--sc-muted)]">{label(uncertainty?.band)} · {uncertainty?.blocked ? tr({ fi: "tutkimus ei valmis", en: "research not ready", es: "investigación no lista" }) : tr({ fi: "tarkistettava", en: "review", es: "revisar" })}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Data trust</div><div className="mt-1 font-black text-[var(--sc-text)]">{pct(trust)}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Verified coverage</div><div className="mt-1 font-black text-[var(--sc-text)]">{pct(coverage)}</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Evidence readiness</div><div className="mt-1 font-black text-[var(--sc-text)]">{uncertainty?.evidenceReadiness ?? "—"}/100</div></div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">Advanced provider</div><div className="mt-1 font-black text-[var(--sc-text)]">{label(provider?.stage)}</div></div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--sc-border)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">Uncertainty reasons</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {reasons.length ? reasons.map((reason) => <span key={reason} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--sc-muted)]">{label(reason)}</span>) : <span className="text-sm text-[var(--sc-muted)]">—</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--sc-border)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">Provider qualification</div>
          <div className="mt-2 text-sm font-bold text-[var(--sc-text-secondary)]">{provider?.shadowQualified === true ? "QUALIFIED FOR SHADOW HOLDOUT" : "NOT QUALIFIED"}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {providerReasons.length ? providerReasons.map((reason) => <span key={reason} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] px-2.5 py-1 text-xs font-bold text-[var(--sc-muted)]">{label(reason)}</span>) : <span className="text-sm text-[var(--sc-muted)]">—</span>}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-5 text-[var(--sc-muted)]">
        Production probability changed: false · Production decision changed: false · Automatic promotion: false · Paper-only: true
      </div>
    </section>
  );
}
