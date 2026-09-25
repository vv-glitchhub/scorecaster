"use client";

import Link from "next/link";
import { useLanguage } from "../../components/LanguageProvider";

export default function EventJourneyOverview({ gamePlanHref, recommendationJourneyHref }) {
  const { tr } = useLanguage();

  return (
    <section className="rounded-[1.55rem] border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-5" data-match-journey-overview="true">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sc-brand)]">
            {tr({ fi: "Ottelun aikajana", en: "Match timeline", es: "Cronología del partido" })}
          </div>
          <div className="mt-1 text-xl font-black text-[var(--sc-text)]">
            {tr({ fi: "Näe, miten analyysi ja seuranta kehittyvät", en: "See how the analysis and tracking evolve", es: "Mira cómo evolucionan el análisis y el seguimiento" })}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--sc-muted)]">
            {tr({
              fi: "Ennen ottelua näet nykyisen kontekstin ja markkinan. Seurannan aikana tallennetut hintamuutokset säilyvät aikajanalla, ja ottelun jälkeen paperiseuranta kokoaa lopputuloksen ja opit yhteen.",
              en: "Before kickoff you see the current context and market. While watching, stored price changes form a timeline, and after settlement paper tracking brings the outcome and review together.",
              es: "Antes del inicio ves el contexto y el mercado. Durante el seguimiento, los cambios de cuota guardados forman una cronología y, después, el seguimiento simulado reúne el resultado y la revisión."
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={gamePlanHref} className="sc-button-primary" data-match-intelligence-entry="true">
            {tr({ fi: "Avaa ottelun aikajana", en: "Open match timeline", es: "Abrir cronología" })}
          </Link>
          <Link href={recommendationJourneyHref} className="sc-button-secondary">
            {tr({ fi: "Suosituksen historia", en: "Recommendation history", es: "Historial de recomendación" })}
          </Link>
          <Link href="/tracking" className="sc-button-secondary">
            {tr({ fi: "Oma paperiseuranta", en: "My paper tracking", es: "Mi seguimiento simulado" })}
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">
          <div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{tr({ fi: "Nyt", en: "Now", es: "Ahora" })}</div>
          <div className="mt-1 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Konteksti, kerroin ja päätös", en: "Context, price and decision", es: "Contexto, cuota y decisión" })}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">
          <div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{tr({ fi: "Seurannassa", en: "While watching", es: "En seguimiento" })}</div>
          <div className="mt-1 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Tallennetut hintamuutokset", en: "Stored price changes", es: "Cambios de cuota guardados" })}</div>
        </div>
        <div className="rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] p-3">
          <div className="text-[10px] font-black uppercase text-[var(--sc-faint)]">{tr({ fi: "Jälkeen", en: "After", es: "Después" })}</div>
          <div className="mt-1 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Lopputulos ja paperiseurannan yhteenveto", en: "Outcome and paper-tracking review", es: "Resultado y revisión simulada" })}</div>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold text-[var(--sc-muted)]">
        {tr({
          fi: "Aikajana näyttää vain tallennetut ja varmennetut havainnot. Puuttuvaa historiaa ei rakenneta jälkikäteen.",
          en: "The timeline shows only stored and verified observations. Missing history is never reconstructed afterward.",
          es: "La cronología muestra solo observaciones guardadas y verificadas. El historial faltante no se reconstruye después."
        })}
      </p>
    </section>
  );
}
