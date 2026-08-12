"use client";

import { SectionHeader } from "../../components/ProductUI";
import { useLanguage } from "../../components/LanguageProvider";

function number(value, digits = 1) {
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

export default function EventBasketballEfficiencyPanel({ row }) {
  const { tr } = useLanguage();
  const model = row?.basketballEfficiencyShadow;
  const inputStatus = row?.basketballAdvancedShadowInputStatus || row?.advancedShadowInputStatus || {};
  if (!model || model?.reasons?.includes("unsupported-sport")) return null;
  const ready = model.status === "ready";
  const reasons = Array.isArray(model.reasons) ? model.reasons : [];
  const provenance = model.provenance || {};

  return (
    <section className="sc-surface rounded-[1.65rem] p-5 sm:p-6">
      <SectionHeader
        eyebrow="Basketball Efficiency Shadow V1"
        title={tr({ fi: "NBA/WNBA pace + efficiency challenger", en: "NBA/WNBA pace + efficiency challenger", es: "Challenger NBA/WNBA de ritmo + eficiencia" })}
        description={tr({
          fi: "Malli käyttää auditoituja pregame pace-, offensive rating- ja defensive rating -signaaleja. Lineup-impact on vapaaehtoinen ja rajattu. Markkinahinnat tai Scorecaster-mirrorit eivät saa olla mallisyötteitä.",
          en: "The model uses audited pregame pace, offensive rating and defensive rating signals. Lineup impact is optional and bounded. Market prices and Scorecaster mirrors cannot be model inputs.",
          es: "El modelo usa señales prepartido auditadas de ritmo, rating ofensivo y defensivo. El impacto de alineación es opcional y limitado. Las cuotas y mirrors de Scorecaster no pueden ser entradas."
        })}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Status</div>
          <div className="mt-2"><StatusBadge ready={ready}>{model.status || "unavailable"}</StatusBadge></div>
          <div className="mt-1 text-xs text-[var(--sc-muted)]">{model.league || "NBA/WNBA"}</div>
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
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Projected points</div>
          <div className="mt-2 text-lg font-black text-[var(--sc-text)]">{number(model?.projected?.homePoints)} – {number(model?.projected?.awayPoints)}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">Pace</div>
          <div className="mt-2 text-xl font-black text-[var(--sc-text)]">{number(model?.projected?.possessions)}</div>
          <div className="mt-1 text-xs text-[var(--sc-muted)]">possessions</div>
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
            <div className="font-black text-[var(--sc-text)]">{tr({ fi: "Tutkimusraja", en: "Research boundary", es: "Límite de investigación" })}</div>
            <div className="mt-2">input mode = <strong className="text-[var(--sc-text)]">{inputStatus.mode || "stored-pregame-advanced"}</strong></div>
            <div>home advantage = <strong className="text-[var(--sc-text)]">{number(model?.formula?.homeAdvantagePoints)} pts</strong></div>
            <div>performanceWeightAvailable = <strong className="text-[var(--sc-text)]">false</strong></div>
            <div>productionProbabilityChanged = <strong className="text-[var(--sc-text)]">false</strong></div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="text-sm font-black text-amber-100">{tr({ fi: "Miksi efficiency-malli ei vielä laske probabilitya", en: "Why the efficiency model is not producing a probability yet", es: "Por qué el modelo de eficiencia aún no produce probabilidad" })}</div>
          <div className="mt-3 flex flex-wrap gap-2">{reasons.length ? reasons.map((reason) => <span key={reason} className="rounded-full border border-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100">{reason}</span>) : <span className="text-xs text-[var(--sc-muted)]">no advanced inputs</span>}</div>
        </div>
      )}
    </section>
  );
}
