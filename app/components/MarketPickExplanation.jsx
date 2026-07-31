"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

const number = (value, digits = 4) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
const percent = (value, digits = 1) => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)} %` : "–";

export default function MarketPickExplanation({ pick }) {
  const { tr } = useLanguage();
  if (!pick) return null;

  const odds = Number(pick.odds || pick.bestOdds || 0);
  const marketProbability = Number.isFinite(Number(pick.marketProbability))
    ? Number(pick.marketProbability)
    : odds > 1
      ? 1 / odds
      : null;
  const modelProbability = Number.isFinite(Number(pick.consensusProbability))
    ? Number(pick.consensusProbability)
    : Number.isFinite(Number(pick.modelProbability))
      ? Number(pick.modelProbability)
      : null;
  const edge = Number.isFinite(Number(pick.edge))
    ? Number(pick.edge)
    : modelProbability !== null && marketProbability !== null
      ? modelProbability - marketProbability
      : null;
  const ev = Number.isFinite(Number(pick.ev))
    ? Number(pick.ev)
    : modelProbability !== null && odds > 1
      ? modelProbability * odds - 1
      : null;
  const fairOdds = Number.isFinite(Number(pick.fairOdds))
    ? Number(pick.fairOdds)
    : modelProbability && modelProbability > 0
      ? 1 / modelProbability
      : null;
  const reasons = Array.isArray(pick.qualityNotes) ? pick.qualityNotes.slice(0, 5) : [];

  return (
    <details className="rounded-2xl border border-[var(--sc-border)] bg-[var(--sc-surface)] p-4">
      <summary className="cursor-pointer text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Miksi AI päätyi tähän?", en: "Why did AI reach this decision?", es: "¿Por qué llegó la IA a esta decisión?" })}</summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-[var(--sc-text-secondary)]">{pick.decisionReason || tr({ fi: "Päätös perustuu parhaaseen saatavilla olevaan hintaan, markkinakonsensukseen ja datan laatuportteihin.", en: "The decision is based on the best available price, market consensus and data-quality gates.", es: "La decisión se basa en la mejor cuota disponible, el consenso del mercado y los filtros de calidad." })}</p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Value label={tr({ fi: "Markkinatodennäköisyys", en: "Market probability", es: "Probabilidad de mercado" })} value={percent(marketProbability)} />
          <Value label={tr({ fi: "Konsensus", en: "Consensus", es: "Consenso" })} value={percent(modelProbability)} />
          <Value label="Edge" value={percent(edge)} />
          <Value label="EV" value={percent(ev)} />
          <Value label={tr({ fi: "Reilu kerroin", en: "Fair odds", es: "Cuota justa" })} value={number(fairOdds, 2)} />
          <Value label={tr({ fi: "Lähteitä", en: "Sources", es: "Fuentes" })} value={pick.bookmakerCount || 0} />
        </div>

        {reasons.length > 0 && <ul className="space-y-2 text-xs leading-5 text-[var(--sc-muted)]">{reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}

        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3 font-mono text-[11px] leading-5 text-[var(--sc-muted)]">
          p_market = 1 / odds<br />
          edge = p_consensus − p_market<br />
          EV = p_consensus × odds − 1<br />
          fair_odds = 1 / p_consensus
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className="rounded-full border border-[var(--sc-border)] px-3 py-2 text-[var(--sc-muted)]">{pick.bookmaker || tr({ fi: "Live-kertoimien tarjoajat", en: "Live odds providers", es: "Proveedores de cuotas" })}</span>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-amber-100">paper only</span>
          <Link href="/transparency" className="rounded-full border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] px-3 py-2 text-[var(--sc-text)]">{tr({ fi: "Kaikki kaavat ja lähteet", en: "All formulas and sources", es: "Todas las fórmulas y fuentes" })}</Link>
        </div>
      </div>
    </details>
  );
}

function Value({ label, value }) {
  return <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3"><div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--sc-faint)]">{label}</div><div className="mt-1 text-base font-black text-[var(--sc-text)]">{value}</div></div>;
}
