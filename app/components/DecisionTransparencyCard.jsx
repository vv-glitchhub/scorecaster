"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

const number = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const percent = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

export default function DecisionTransparencyCard({ explanation, compact = false }) {
  const { tr } = useLanguage();
  if (!explanation) return null;

  const calculations = explanation.calculations || {};
  const factors = explanation.factors || [];
  const sources = explanation.sources || [];
  const failedGates = (explanation.gateResults || []).filter((gate) => !gate.passed);

  return (
    <details className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4">
      <summary className="cursor-pointer list-none text-sm font-black text-[var(--sc-text)]">
        <span className="inline-flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--sc-brand-soft)] text-xs text-[var(--sc-brand)]">AI</span>
          {tr({ fi: "Miksi AI päätyi tähän?", en: "Why did AI reach this decision?", es: "¿Por qué llegó la IA a esta decisión?" })}
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        <p className="text-sm leading-7 text-[var(--sc-text-secondary)]">{explanation.summary}</p>

        <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Model</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(calculations.modelProbability)}</div></div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Market</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(calculations.marketProbability)}</div></div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">EV / unit</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(calculations.expectedValuePerUnit)}</div></div>
          <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-3"><div className="text-[10px] font-bold uppercase text-[var(--sc-faint)]">Quality</div><div className="mt-1 font-black text-[var(--sc-text)]">{percent(calculations.quality)}</div></div>
        </div>

        <div className="space-y-2">
          {factors.slice(0, compact ? 4 : 6).map((factor) => (
            <div key={factor.id} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--sc-surface)] px-3 py-2 text-xs">
              <span className="font-bold text-[var(--sc-text-secondary)]">{factor.label}</span>
              <span className="font-black text-[var(--sc-text)]">{Number.isFinite(Number(factor.value)) ? number(factor.value) : factor.direction}</span>
            </div>
          ))}
        </div>

        {!!failedGates.length && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
            <div className="text-xs font-black text-amber-100">{tr({ fi: "Portit, jotka eivät läpäisseet", en: "Gates that did not pass", es: "Umbrales no superados" })}</div>
            <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">{failedGates.map((gate) => <div key={gate.id}>• {gate.requirement}</div>)}</div>
          </div>
        )}

        <div>
          <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">{tr({ fi: "Lähteet", en: "Sources", es: "Fuentes" })}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sources.length ? sources.map((source) => <span key={source.id} className="rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-1 text-xs text-[var(--sc-text-secondary)]">{source.name} · {source.observations}</span>) : <span className="text-xs text-[var(--sc-muted)]">{tr({ fi: "Ei lähdetietoja", en: "No source metadata", es: "Sin metadatos de fuente" })}</span>}
          </div>
        </div>

        {!!explanation.missingInputs?.length && <div className="text-xs leading-6 text-[var(--sc-muted)]"><strong className="text-[var(--sc-text)]">{tr({ fi: "Puuttuu:", en: "Missing:", es: "Falta:" })}</strong> {explanation.missingInputs.join(", ")}</div>}

        <div className="flex flex-wrap gap-2">
          <Link href={`/transparency${explanation.eventId ? `?eventId=${encodeURIComponent(explanation.eventId)}` : ""}`} className="rounded-xl bg-[var(--sc-brand)] px-4 py-2 text-xs font-black text-[var(--sc-brand-ink)]">{tr({ fi: "Kaikki laskut ja syötteet", en: "All calculations and inputs", es: "Todos los cálculos y datos" })}</Link>
          {explanation.eventId && <a href={`/api/transparency?eventId=${encodeURIComponent(explanation.eventId)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--sc-border)] px-4 py-2 text-xs font-black text-[var(--sc-text-secondary)]">JSON API</a>}
        </div>
      </div>
    </details>
  );
}
