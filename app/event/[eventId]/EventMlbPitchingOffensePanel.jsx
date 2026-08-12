"use client";

import { SectionHeader } from "../../components/ProductUI";
import { useLanguage } from "../../components/LanguageProvider";

function number(value, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "–";
}

function percent(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(1)}%` : "–";
}

function StatusBadge({ ready, children }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ready ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-100"}`}>{children}</span>;
}

export default function EventMlbPitchingOffensePanel({ row }) {
  const { tr } = useLanguage();
  const model = row?.mlbPitchingOffenseShadow;
  const inputStatus = row?.mlbAdvancedShadowInputStatus || row?.advancedShadowInputStatus || {};
  if (!model || model?.reasons?.includes("unsupported-sport")) return null;
  const ready = model.status === "ready";
  const reasons = Array.isArray(model.reasons) ? model.reasons : [];
  const provenance = model.provenance || {};

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="MLB Pitching + Offense Shadow V1"
        title={tr({ fi: "Aloittava syöttäjä + lineup + bullpen", en: "Starting pitcher + lineup + bullpen", es: "Pitcher abridor + lineup + bullpen" })}
        description={tr({
          fi: "Malli käyttää vain auditoituja pregame-signaaleja: standardoitu lineup-strength, bullpen-depth ja vahvistetun aloittavan syöttäjän xwOBA allowed. Park-tieto näkyy auditissa, mutta ei vaikuta V1 H2H-probabilityyn.",
          en: "The model uses only audited pregame signals: standardized lineup strength, bullpen depth and confirmed starting-pitcher xwOBA allowed. Park context is audited but does not affect V1 H2H probability.",
          es: "El modelo usa solo señales prepartido auditadas: fuerza de lineup y bullpen estandarizadas y xwOBA permitido del pitcher abridor confirmado. El contexto del parque se audita pero no cambia la probabilidad H2H V1."
        })}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Status</div>
          <div className="mt-2"><StatusBadge ready={ready}>{model.status || "unavailable"}</StatusBadge></div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Home</div>
          <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{percent(model?.probabilities?.home)}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Away</div>
          <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{percent(model?.probabilities?.away)}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Starter vuln. Z</div>
          <div className="mt-2 text-lg font-black text-[var(--sc-text)]">{number(model?.matchup?.homeStarterVulnerabilityZ)} / {number(model?.matchup?.awayStarterVulnerabilityZ)}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Input mode</div>
          <div className="mt-2 text-sm font-black text-[var(--sc-text)]">{inputStatus.mode || "unavailable"}</div>
          <div className="mt-1 text-xs text-[var(--sc-muted)]">providers {inputStatus.providerCount || 0}</div>
        </div>
      </div>

      {ready ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">
            <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Datalinja", en: "Data lineage", es: "Linaje de datos" })}</div>
            <div className="mt-2 text-xs text-[var(--sc-muted)]">{(provenance.providers || []).join(" · ") || "–"}</div>
            <div className="mt-2 break-words text-xs text-[var(--sc-faint)]">{(provenance.metrics || []).join(" · ") || "–"}</div>
          </div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-text-secondary)]">
            <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Turvaraja", en: "Safety boundary", es: "Límite de seguridad" })}</div>
            <div className="mt-2">confirmed starters = <strong className="text-[var(--sc-text)]">required</strong></div>
            <div>parkContextUsedInProbability = <strong className="text-[var(--sc-text)]">false</strong></div>
            <div>performanceWeightAvailable = <strong className="text-[var(--sc-text)]">false</strong></div>
            <div>productionProbabilityChanged = <strong className="text-[var(--sc-text)]">false</strong></div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="text-sm font-black text-amber-100">{tr({ fi: "Miksi MLB-malli ei vielä laske probabilitya", en: "Why the MLB model is not producing a probability yet", es: "Por qué el modelo MLB aún no produce probabilidad" })}</div>
          <div className="mt-3 flex flex-wrap gap-2">{reasons.length ? reasons.map((reason) => <span key={reason} className="rounded-full border border-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100">{reason}</span>) : <span className="text-xs text-[var(--sc-muted)]">no advanced inputs</span>}</div>
        </div>
      )}
    </section>
  );
}
