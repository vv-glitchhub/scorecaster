"use client";

import { useId } from "react";
import { useLanguage } from "./LanguageProvider";
import { useProfessionalPreferences } from "./ProfessionalPreferencesProvider";

const DEFAULT_BOOKMAKERS = Object.freeze([
  { key: "all", label: { fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" } },
  { key: "pinnacle", label: { fi: "Pinnacle", en: "Pinnacle", es: "Pinnacle" } },
  { key: "betfair_ex_eu", label: { fi: "Betfair Exchange", en: "Betfair Exchange", es: "Betfair Exchange" } },
  { key: "unibet_eu", label: { fi: "Unibet", en: "Unibet", es: "Unibet" } },
  { key: "williamhill", label: { fi: "William Hill", en: "William Hill", es: "William Hill" } }
]);

export default function ProfessionalPreferenceControls({ compact = false, bookmakers = DEFAULT_BOOKMAKERS, className = "" }) {
  const { tr } = useLanguage();
  const { bookmakerKey, bookmakerLabel, proMode, setBookmaker, setProMode } = useProfessionalPreferences();
  const selectId = useId();
  const toggleId = useId();
  const options = Array.isArray(bookmakers) && bookmakers.length ? bookmakers : DEFAULT_BOOKMAKERS;
  const containsCurrent = options.some((item) => item.key === bookmakerKey);
  const mergedOptions = containsCurrent ? options : [{ key: bookmakerKey, label: { fi: bookmakerLabel, en: bookmakerLabel, es: bookmakerLabel } }, ...options];

  return (
    <div className={`rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] ${compact ? "p-3" : "p-4"} ${className}`.trim()} data-professional-preferences>
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" : "md:grid-cols-[minmax(0,1fr)_auto] md:items-end"}`}>
        <label htmlFor={selectId} className="block min-w-0 text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">
          {tr({ fi: "Hintalähde", en: "Price provider", es: "Proveedor de cuota" })}
          <select
            id={selectId}
            value={bookmakerKey}
            onChange={(event) => {
              const option = mergedOptions.find((item) => item.key === event.target.value);
              setBookmaker(event.target.value, option ? tr(option.label) : event.target.value);
            }}
            className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-3 py-2 text-sm font-bold normal-case tracking-normal text-[var(--sc-text)] outline-none focus:border-[var(--sc-brand)] focus:ring-2 focus:ring-[var(--sc-brand-soft)]"
          >
            {mergedOptions.map((item) => <option key={item.key} value={item.key}>{tr(item.label)}</option>)}
          </select>
        </label>

        <div>
          <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">{tr({ fi: "Näyttötaso", en: "Display level", es: "Nivel de detalle" })}</div>
          <label htmlFor={toggleId} className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-4 py-2 text-sm font-black text-[var(--sc-text-secondary)] focus-within:border-[var(--sc-brand)] focus-within:ring-2 focus-within:ring-[var(--sc-brand-soft)]">
            <span>{proMode ? "Pro Mode" : tr({ fi: "Selkeä tila", en: "Simple mode", es: "Modo simple" })}</span>
            <input id={toggleId} type="checkbox" checked={proMode} onChange={(event) => setProMode(event.target.checked)} className="h-5 w-5 accent-[var(--sc-brand)]" aria-describedby={`${toggleId}-help`} />
          </label>
          <div id={`${toggleId}-help`} className="sr-only">{tr({ fi: "Pro Mode näyttää kaavat, epävarmuuden ja auditointitiedot samoista laskelmista.", en: "Pro Mode reveals formulas, uncertainty and audit details from the same calculations.", es: "Pro Mode muestra fórmulas y auditoría de los mismos cálculos." })}</div>
        </div>
      </div>
      {!compact && <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Vedonvälittäjä muuttaa vain arvioitavaa tarjottua hintaa. Mallin todennäköisyys ja markkinan no-vig-vertailu pysyvät erillisinä.", en: "The provider changes only the evaluated offered price. Model probability and the no-vig market benchmark remain separate.", es: "El proveedor solo cambia la cuota evaluada; el modelo y el consenso no-vig permanecen separados." })}</p>}
    </div>
  );
}

export { DEFAULT_BOOKMAKERS };
