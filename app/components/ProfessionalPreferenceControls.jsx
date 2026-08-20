"use client";

import { useId } from "react";
import { useLanguage } from "./LanguageProvider";
import { useProfessionalPreferences } from "./ProfessionalPreferencesProvider";

const DEFAULT_BOOKMAKERS = Object.freeze([
  { key: "all", label: { fi: "Paras saatavilla oleva hinta", en: "Best available price", es: "Mejor cuota disponible" } },
  { key: "veikkaus", label: { fi: "Veikkaus", en: "Veikkaus", es: "Veikkaus" } },
  { key: "pinnacle", label: { fi: "Pinnacle", en: "Pinnacle", es: "Pinnacle" } },
  { key: "betfair_ex_eu", label: { fi: "Betfair Exchange", en: "Betfair Exchange", es: "Betfair Exchange" } },
  { key: "unibet_eu", label: { fi: "Unibet", en: "Unibet", es: "Unibet" } },
  { key: "williamhill", label: { fi: "William Hill", en: "William Hill", es: "William Hill" } }
]);

const PROFESSIONAL_PROFILES = Object.freeze([
  {
    key: "standard",
    label: { fi: "Ammattilainen · Standard", en: "Professional · Standard", es: "Profesional · Estándar" },
    description: { fi: "Vähintään 4 bookmakeria, ≥2,0 % edge, ≥3,0 % EV ja positiivinen stressattu EV.", en: "At least 4 bookmakers, ≥2.0% edge, ≥3.0% EV and positive stressed EV.", es: "Al menos 4 casas, ≥2,0 % de edge, ≥3,0 % de EV y EV estresado positivo." }
  },
  {
    key: "selective",
    label: { fi: "Ammattilainen · Valikoiva", en: "Professional · Selective", es: "Profesional · Selectivo" },
    description: { fi: "Tiukempi seula: 5 bookmakeria, ≥3,0 % edge, ≥4,5 % EV ja tuoreempi markkina.", en: "Stricter gate: 5 bookmakers, ≥3.0% edge, ≥4.5% EV and fresher market data.", es: "Filtro más estricto: 5 casas, ≥3,0 % de edge, ≥4,5 % de EV y mercado más reciente." }
  },
  {
    key: "volume",
    label: { fi: "Ammattilainen · Volyymi", en: "Professional · Volume", es: "Profesional · Volumen" },
    description: { fi: "Enemmän tarkastettavia kohteita, mutta stressatun alarajan EV:n on silti oltava positiivinen.", en: "More candidates for review, while stressed lower-bound EV must still stay positive.", es: "Más candidatos para revisar, manteniendo EV estresado positivo." }
  }
]);

export default function ProfessionalPreferenceControls({ compact = false, bookmakers = DEFAULT_BOOKMAKERS, className = "" }) {
  const { tr } = useLanguage();
  const {
    bookmakerKey,
    bookmakerLabel,
    proMode,
    proProfile,
    setBookmaker,
    setProMode,
    setProProfile
  } = useProfessionalPreferences();
  const selectId = useId();
  const toggleId = useId();
  const profileId = useId();
  const options = Array.isArray(bookmakers) && bookmakers.length ? bookmakers : DEFAULT_BOOKMAKERS;
  const containsCurrent = options.some((item) => item.key === bookmakerKey);
  const mergedOptions = containsCurrent ? options : [{ key: bookmakerKey, label: { fi: bookmakerLabel, en: bookmakerLabel, es: bookmakerLabel } }, ...options];
  const selectedProfile = PROFESSIONAL_PROFILES.find((item) => item.key === proProfile) || PROFESSIONAL_PROFILES[0];

  return (
    <div className={`rounded-[1.2rem] border border-[var(--sc-border)] bg-[var(--sc-surface-soft)] ${compact ? "p-3" : "p-4"} ${className}`.trim()} data-professional-preferences data-pro-mode={proMode ? "on" : "off"}>
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
          <div className="text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">{tr({ fi: "Näyttö ja laatuseula", en: "Display & quality gate", es: "Vista y filtro de calidad" })}</div>
          <label htmlFor={toggleId} className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-[var(--sc-border)] bg-[var(--sc-surface)] px-4 py-2 text-sm font-black text-[var(--sc-text-secondary)] focus-within:border-[var(--sc-brand)] focus-within:ring-2 focus-within:ring-[var(--sc-brand-soft)]">
            <span>{proMode ? "Pro Bettor Mode" : tr({ fi: "Selkeä tila", en: "Simple mode", es: "Modo simple" })}</span>
            <input id={toggleId} type="checkbox" checked={proMode} onChange={(event) => setProMode(event.target.checked)} className="h-5 w-5 accent-[var(--sc-brand)]" aria-describedby={`${toggleId}-help`} />
          </label>
          <div id={`${toggleId}-help`} className="sr-only">{tr({ fi: "Pro Bettor Mode näyttää auditoinnin ja lisää ammattimaisen quality-gaten ilman että se muuttaa todennäköisyyttä, edgeä tai EV:tä.", en: "Pro Bettor Mode reveals audit detail and adds a professional quality gate without changing probability, edge or EV.", es: "El modo profesional añade auditoría y un filtro de calidad sin cambiar probabilidad, edge ni EV." })}</div>
        </div>
      </div>

      {proMode && (
        <label htmlFor={profileId} className="mt-3 block text-xs font-black uppercase tracking-[0.13em] text-[var(--sc-faint)]">
          {tr({ fi: "Ammattiprofiili", en: "Professional profile", es: "Perfil profesional" })}
          <select
            id={profileId}
            value={proProfile}
            onChange={(event) => setProProfile(event.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-[var(--sc-brand-border)] bg-[var(--sc-surface)] px-3 py-2 text-sm font-bold normal-case tracking-normal text-[var(--sc-text)] outline-none focus:border-[var(--sc-brand)] focus:ring-2 focus:ring-[var(--sc-brand-soft)]"
          >
            {PROFESSIONAL_PROFILES.map((item) => <option key={item.key} value={item.key}>{tr(item.label)}</option>)}
          </select>
          <span className="mt-2 block text-xs font-medium normal-case leading-5 tracking-normal text-[var(--sc-muted)]">{tr(selectedProfile.description)}</span>
        </label>
      )}

      {!compact && <p className="mt-3 text-xs leading-5 text-[var(--sc-muted)]">{tr({ fi: "Hintalähde muuttaa vain arvioitavaa tarjottua hintaa. Pro-laatuseula voi vain merkitä PLAY-kohteen tarkistettavaksi; se ei voi nostaa WATCH-kohdetta PLAYksi eikä muuta mallin todennäköisyyttä, edgeä tai EV:tä.", en: "The price provider changes only the offered price. The professional quality gate can only downgrade a PLAY to review; it cannot promote WATCH to PLAY or alter probability, edge or EV.", es: "El proveedor solo cambia la cuota ofrecida. El filtro profesional solo puede degradar PLAY a revisión; no puede promover WATCH ni cambiar probabilidad, edge o EV." })}</p>}
    </div>
  );
}

export { DEFAULT_BOOKMAKERS, PROFESSIONAL_PROFILES };
