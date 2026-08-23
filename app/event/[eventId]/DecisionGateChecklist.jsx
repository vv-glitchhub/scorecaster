function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowTone(state) {
  if (state === "pass") return "border-emerald-300/25 bg-emerald-300/8 text-emerald-200";
  if (state === "block") return "border-rose-300/25 bg-rose-300/8 text-rose-200";
  return "border-amber-300/25 bg-amber-300/8 text-amber-100";
}

export default function DecisionGateChecklist({ selected, fixtureVerified, tr }) {
  const bookmakerCount = finite(selected?.dataGate?.bookmakerCount ?? selected?.bookmakerCount);
  const confidence = finite(selected?.dataGate?.confidence ?? selected?.confidence);
  const odds = finite(selected?.odds);
  const minimumPlayOdds = finite(selected?.priceGuard?.minimumPlayOdds);
  const stale = selected?.dataGate?.stale === true || selected?.freshness === "stale";
  const rows = [
    {
      key: "fixture",
      label: tr({ fi: "Ottelu varmennettu", en: "Fixture verified", es: "Evento verificado" }),
      value: fixtureVerified ? tr({ fi: "Provider vahvisti tapahtuman", en: "Provider confirmed the fixture", es: "El proveedor confirmó el evento" }) : tr({ fi: "Varmennus puuttuu", en: "Verification missing", es: "Falta verificación" }),
      state: fixtureVerified ? "pass" : "block"
    },
    {
      key: "sources",
      label: tr({ fi: "Hintalähteiden peitto", en: "Price-source coverage", es: "Cobertura de precios" }),
      value: bookmakerCount === null ? tr({ fi: "Lähdemäärä puuttuu", en: "Source count unavailable", es: "Falta el número de fuentes" }) : `${bookmakerCount} ${tr({ fi: "vedonvälittäjää", en: "bookmakers", es: "casas" })}`,
      state: bookmakerCount === null || bookmakerCount < 2 ? "block" : bookmakerCount >= 4 ? "pass" : "caution"
    },
    {
      key: "freshness",
      label: tr({ fi: "Hinnan tuoreus", en: "Price freshness", es: "Actualidad de la cuota" }),
      value: selected?.freshness || tr({ fi: "ei tiedossa", en: "unknown", es: "desconocida" }),
      state: stale ? "block" : selected?.freshness && selected.freshness !== "unknown" ? "pass" : "caution"
    },
    {
      key: "confidence",
      label: tr({ fi: "Markkinadatan luottamus", en: "Market-data confidence", es: "Confianza de mercado" }),
      value: confidence === null ? "—" : `${(confidence * 100).toFixed(0)} %`,
      state: confidence === null || confidence < 0.35 ? "block" : confidence >= 0.55 ? "pass" : "caution"
    },
    {
      key: "price",
      label: tr({ fi: "PLAY-hintaraja", en: "PLAY price floor", es: "Límite de cuota PLAY" }),
      value: odds === null || minimumPlayOdds === null ? tr({ fi: "Hintarajaa ei voida verrata", en: "Price floor cannot be compared", es: "No se puede comparar el límite" }) : `${odds.toFixed(2)} / ${minimumPlayOdds.toFixed(2)}`,
      state: odds === null || minimumPlayOdds === null ? "caution" : odds >= minimumPlayOdds ? "pass" : "caution"
    }
  ];

  return (
    <div className="mt-5" data-decision-gate-checklist="true">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--sc-brand)]">{tr({ fi: "Päätösportit", en: "Decision gates", es: "Filtros de decisión" })}</div>
          <div className="mt-1 text-sm font-black text-[var(--sc-text)]">{tr({ fi: "Mikä tukee päätöstä juuri nyt", en: "What supports the decision right now", es: "Qué respalda la decisión ahora" })}</div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--sc-faint)]">server authoritative</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className={`rounded-xl border p-3 ${rowTone(row.state)}`} data-gate-state={row.state}>
            <div className="flex items-center gap-2 text-xs font-black"><span aria-hidden="true">{row.state === "pass" ? "✓" : row.state === "block" ? "×" : "!"}</span>{row.label}</div>
            <div className="mt-1 text-xs leading-5 text-[var(--sc-muted)]">{row.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--sc-faint)]">{tr({ fi: "Lista selittää palvelimen julkaisemaa päätöstä. Se ei laske uutta päätöstä selaimessa eikä täytä puuttuvia arvoja.", en: "The checklist explains the server-published decision. It does not calculate a new browser-side decision or fill missing values.", es: "La lista explica la decisión del servidor. No calcula otra decisión ni rellena datos ausentes." })}</p>
    </div>
  );
}
