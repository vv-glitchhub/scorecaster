"use client";

import { useLanguage } from "./LanguageProvider";
import { MetricTile, SectionHeader } from "./ProductUI";

function percent(value, digits = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)} %` : "–";
}

function impact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return `${number >= 0 ? "+" : ""}${(number * 100).toFixed(2)} pp`;
}

function tone(item) {
  if (item.direction === "positive") return "border-emerald-400/25 bg-emerald-400/10";
  if (["negative", "risk"].includes(item.direction)) return "border-rose-400/25 bg-rose-400/10";
  return "border-[var(--sc-border)] bg-[var(--sc-surface-soft)]";
}

export default function UnifiedDataLedger({ ledger, compact = false }) {
  const { tr } = useLanguage();
  if (!ledger) return null;
  const factors = Array.isArray(ledger.factors) ? ledger.factors : [];
  const used = factors.filter((item) => item.usedByAi);
  const missing = Array.isArray(ledger.missingData) ? ledger.missingData : [];

  return (
    <section id="unified-data-ledger" className="space-y-5">
      <SectionHeader
        eyebrow="Unified Sports Data V1"
        title={tr({ fi: "Mitä dataa AI käytti ja miksi", en: "What data AI used and why", es: "Qué datos utilizó la IA y por qué" })}
        description={tr({
          fi: "Jokaisella signaalilla näkyvät lähde, tuoreus, luottamus, vaikutus ja käyttötapa. Kontekstidata ei muuta markkinatodennäköisyyttä eikä voi nostaa kohdetta PLAYksi.",
          en: "Every signal shows its source, freshness, trust, impact and use mode. Context data does not change the market probability and can never upgrade a pick to PLAY.",
          es: "Cada señal muestra fuente, actualidad, confianza, impacto y uso. Los datos contextuales no pueden elevar una selección a PLAY."
        })}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label={tr({ fi: "Dataperheitä", en: "Data families", es: "Familias" })} value={`${ledger.coverage?.configuredFamilies || 0}/${ledger.coverage?.totalFamilies || 0}`} />
        <MetricTile label={tr({ fi: "AI käytti", en: "AI used", es: "IA utilizó" })} value={ledger.coverage?.usedFamilies || 0} tone="purple" />
        <MetricTile label={tr({ fi: "Varmennettu kattavuus", en: "Verified coverage", es: "Cobertura verificada" })} value={percent(ledger.coverage?.verifiedCoverageRate)} tone="blue" />
        <MetricTile label={tr({ fi: "Riippumattomia odds-providereita", en: "Independent odds providers", es: "Proveedores independientes" })} value={ledger.coverage?.independentOddsProviders || 1} tone={Number(ledger.coverage?.independentOddsProviders || 1) >= 2 ? "green" : "yellow"} />
        <MetricTile label={tr({ fi: "Rajattu kontekstivaikutus", en: "Bounded context impact", es: "Impacto contextual" })} value={impact(ledger.totalBoundedContextImpact)} tone={ledger.totalBoundedContextImpact < 0 ? "red" : ledger.totalBoundedContextImpact > 0 ? "green" : "default"} />
      </div>

      <div className={`rounded-[1.35rem] border p-5 ${ledger.safetyRecommendation?.action === "DOWNGRADE_TO_CAUTION" ? "border-rose-400/30 bg-rose-400/10" : "border-sky-400/25 bg-sky-400/10"}`}>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-faint)]">AI DATA PROVENANCE</div>
        <h3 className="mt-2 text-xl font-black text-[var(--sc-text)]">{ledger.aiExplanation?.headline}</h3>
        <div className="mt-3 space-y-1 text-sm leading-6 text-[var(--sc-muted)]">
          {(ledger.aiExplanation?.explanation || []).map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>

      <div className={compact ? "space-y-3" : "grid gap-4 lg:grid-cols-2"}>
        {factors.map((item) => (
          <article key={item.key} className={`rounded-[1.3rem] border p-5 ${tone(item)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sc-faint)]">{item.useMode}</div>
                <h3 className="mt-1 text-lg font-black text-[var(--sc-text)]">{item.title}</h3>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.usedByAi ? "bg-purple-300 text-slate-950" : "border border-[var(--sc-border)] text-[var(--sc-muted)]"}`}>
                {item.usedByAi ? tr({ fi: "AI käytti", en: "AI used", es: "IA usó" }) : tr({ fi: "Ei käytetty", en: "Not used", es: "No usado" })}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--sc-muted)]">{item.reason}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-black/10 p-3"><div className="text-[var(--sc-faint)]">Impact</div><strong className="text-[var(--sc-text)]">{impact(item.impact)}</strong></div>
              <div className="rounded-xl bg-black/10 p-3"><div className="text-[var(--sc-faint)]">Confidence</div><strong className="text-[var(--sc-text)]">{percent(item.confidence)}</strong></div>
              <div className="rounded-xl bg-black/10 p-3"><div className="text-[var(--sc-faint)]">Trust</div><strong className="text-[var(--sc-text)]">{percent(item.trust)}</strong></div>
            </div>
            {item.sources?.length > 0 && <details className="mt-4 rounded-xl border border-current/10 bg-black/5 p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em]">{tr({ fi: "Lähteet ja evidenssi", en: "Sources and evidence", es: "Fuentes y evidencia" })}</summary><div className="mt-3 space-y-2 text-xs text-[var(--sc-muted)]">{item.sources.map((source) => <div key={source.id}><strong>{source.name}</strong> · trust {percent(source.trust)} · {source.mode}{source.observedAt ? ` · ${new Date(source.observedAt).toLocaleString()}` : ""}</div>)}</div></details>}
          </article>
        ))}
      </div>

      {missing.length > 0 && <details className="rounded-[1.25rem] border border-amber-400/25 bg-amber-400/10 p-5"><summary className="cursor-pointer font-black text-amber-200">{tr({ fi: `Puuttuva data (${missing.length})`, en: `Missing data (${missing.length})`, es: `Datos faltantes (${missing.length})` })}</summary><div className="mt-3 space-y-2 text-sm text-amber-100/80">{missing.map((item, index) => <div key={`${item.factor}-${index}`}><strong>{item.factor}</strong>: {item.missing}</div>)}</div></details>}

      <div className="rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-4 text-sm leading-6 text-[var(--sc-muted)]">
        {tr({
          fi: `Todennäköisyyslähde: ${ledger.policy?.probabilitySource}. Context cap ${percent(ledger.policy?.contextImpactCap)}. Päätöksen automaattinen korotus on estetty ja closing odds on rajattu vain jälkikäteiseen kalibrointiin.`,
          en: `Probability source: ${ledger.policy?.probabilitySource}. Context cap ${percent(ledger.policy?.contextImpactCap)}. Automatic upgrades are disabled and closing odds are restricted to post-event calibration.`,
          es: `Fuente de probabilidad: ${ledger.policy?.probabilitySource}. Las mejoras automáticas están desactivadas y las cuotas de cierre solo se usan después del evento.`
        })}
      </div>
    </section>
  );
}
