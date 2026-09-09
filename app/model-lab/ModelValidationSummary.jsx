"use client";

import { useLanguage } from "../components/LanguageProvider";
import { formatValidationMetric as metric, VALIDATION_REVIEW_POLICY as policy } from "../../lib/validation-lab-v1.mjs";

const labels = {
  "paired-sample": { fi: "Vähintään 100 vertailukelpoista ottelua", en: "At least 100 comparable events", es: "Al menos 100 eventos comparables" },
  "paired-coverage": { fi: "Markkinavertailu jokaiselle arvioidulle ottelulle", en: "Market benchmark for every evaluated event", es: "Referencia de mercado para cada evento evaluado" },
  "brier-improvement": { fi: "Mallin Brier-virhe pienempi kuin markkinan", en: "Lower Brier error than the market", es: "Menor error Brier que el mercado" },
  "log-loss-improvement": { fi: "Mallin log loss pienempi kuin markkinan", en: "Lower log loss than the market", es: "Menor log loss que el mercado" },
  "repeatability": { fi: "Parannus toistuu vähintään kolmessa kuukausijaksossa", en: "Improvement repeats across at least three monthly periods", es: "Mejora repetida en al menos tres periodos mensuales" }
};

export default function ModelValidationSummary({ evidence }) {
  const { tr } = useLanguage();
  if (!evidence) return null;
  const passed = evidence.checks.filter((check) => check.passed).length;
  return (
    <div className="mt-4 border-t border-[var(--sc-border)] pt-4" data-validation-summary="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Mallin testinäyttö", en: "Model validation evidence", es: "Evidencia de validación" })}</h3>
        <span className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-bold text-amber-200">
          {evidence.stage === "research-review" ? tr({ fi: "Tutkimusarvioon", en: "Research review", es: "Revisión de investigación" }) : tr({ fi: "Varhainen vaihe", en: "Early stage", es: "Etapa inicial" })} · {passed}/{evidence.checks.length}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--sc-muted)]">
        {evidence.checks.map((check) => <li key={check.id} className="flex gap-2">
          <span className={check.passed ? "text-emerald-300" : "text-amber-200"}>
            {check.passed ? tr({ fi: "Täyttyy", en: "Met", es: "Cumplido" }) : tr({ fi: "Puuttuu", en: "Unmet", es: "Pendiente" })}
          </span>
          <span>{tr(labels[check.id])}{check.id === "paired-sample" ? ` (${check.current}/${check.target})` : check.id === "paired-coverage" ? ` (${metric(check.current, { percent: true, digits: 0 })})` : ""}</span>
        </li>)}
      </ul>
      {evidence.periods.length > 0 && <details className="mt-3">
        <summary className="cursor-pointer text-xs font-bold text-[var(--sc-brand)]">{tr({ fi: "Näytä kuukausivertailu", en: "Show monthly comparison", es: "Ver comparación mensual" })}</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="mb-2 text-left leading-5 text-[var(--sc-muted)]">{tr({ fi: "Positiivinen erotus tarkoittaa markkinaa pienempää virhettä. Kesken olevaa kuukautta ei hyväksytä toistettavuusnäytöksi.", en: "A positive difference means lower error than the market. The current month does not count toward repeatability.", es: "Una diferencia positiva indica menor error que el mercado. El mes actual no cuenta para la repetibilidad." })}</caption>
            <thead><tr className="text-[var(--sc-faint)]">
              <th scope="col" className="py-2 pr-2">{tr({ fi: "Kuukausi", en: "Month", es: "Mes" })}</th>
              <th scope="col" className="pr-2">N</th><th scope="col" className="pr-2">Δ Brier</th><th scope="col">Δ Log loss</th>
            </tr></thead>
            <tbody>{evidence.periods.map((period) => <tr key={period.month} className="border-t border-[var(--sc-border)] text-[var(--sc-text)]">
              <th scope="row" className="py-2 pr-2 font-normal">{period.month}{!period.complete ? " *" : ""}</th>
              <td className="pr-2">{period.sampleSize}</td><td className="pr-2">{metric(period.brierImprovement)}</td><td>{metric(period.logLossImprovement)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>}
      <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({
        fi: `Tutkimuskriteerit: ${policy.minimumCompleteMonths} päättynyttä kuukautta, vähintään ${policy.minimumEventsPerMonth} vertailua kuukaudessa ja parannus jokaisessa riittävän suuressa jaksossa. Tuotantovalidointi edellyttää lisäksi ennakkoon lukittua testisuunnitelmaa ja varmennettua koulutushistoriaa.`,
        en: `Research criteria: ${policy.minimumCompleteMonths} completed months, at least ${policy.minimumEventsPerMonth} comparisons per month, and improvement in every sufficiently sized period. Production validation also needs a preregistered test protocol and verified training history.`,
        es: `Criterios de investigación: ${policy.minimumCompleteMonths} meses completos, al menos ${policy.minimumEventsPerMonth} comparaciones por mes y mejora en cada periodo suficiente. La validación de producción también necesita un protocolo preregistrado e historial de entrenamiento verificado.`
      })}</p>
    </div>
  );
}
