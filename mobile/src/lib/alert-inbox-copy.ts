type Translate = (copy: { fi: string; en: string; es: string }) => string;

export type AlertDetails = {
  minutesToKickoff?: number | null;
  addedDecision?: string | null;
  currentDecision?: string | null;
  addedOdds?: number | null;
  currentOdds?: number | null;
  oddsMove?: number | null;
  minimumPlayOdds?: number | null;
};

export type StructuredAlert = {
  alert_type?: string;
  type?: string;
  title?: string;
  message?: string;
  details?: AlertDetails;
};

function odds(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "–";
}

function movement(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)} %` : "–";
}

export function localizedAlertCopy(item: StructuredAlert, tr: Translate) {
  const details = item.details || {};
  const type = item.alert_type || item.type;

  if (type === "kickoff_soon") return {
    title: tr({ fi: "Ottelu alkaa pian", en: "Kickoff is approaching", es: "El partido comienza pronto" }),
    message: tr({ fi: `Ottelu alkaa noin ${details.minutesToKickoff ?? "–"} minuutin kuluttua.`, en: `The fixture starts in about ${details.minutesToKickoff ?? "–"} minutes.`, es: `El partido comienza en unos ${details.minutesToKickoff ?? "–"} minutos.` })
  };
  if (type === "decision_changed") return {
    title: tr({ fi: "Päätös muuttui", en: "Decision changed", es: "Cambió la decisión" }),
    message: `${details.addedDecision || "–"} → ${details.currentDecision || "–"}`
  };
  if (type === "price_moved") return {
    title: tr({ fi: "Kerroin muuttui", en: "Price moved", es: "Cambió la cuota" }),
    message: `${odds(details.addedOdds)} → ${odds(details.currentOdds)} · ${movement(details.oddsMove)}`
  };
  if (type === "below_play_price") return {
    title: tr({ fi: "Hinta alittaa PLAY-rajan", en: "Price is below the PLAY floor", es: "La cuota está bajo el límite PLAY" }),
    message: `${odds(details.currentOdds)} < ${odds(details.minimumPlayOdds)}`
  };
  if (type === "market_unavailable") return {
    title: tr({ fi: "Markkina ei ole saatavilla", en: "Market unavailable", es: "Mercado no disponible" }),
    message: tr({ fi: "Vastaavaa live-markkinaa ei löytynyt. Korvaavaa tietoa ei keksitty.", en: "No matching live market was found. No replacement data was invented.", es: "No se encontró un mercado en vivo equivalente. No se inventaron datos." })
  };
  if (type === "fixture_passed") return {
    title: tr({ fi: "Seuranta-aika päättyi", en: "Watch window ended", es: "Terminó la ventana de seguimiento" }),
    message: tr({ fi: "Alkamisaika on ohitettu. Tulosseuranta on erillinen.", en: "Kickoff has passed. Result tracking is separate.", es: "La hora de inicio pasó. El seguimiento de resultados es independiente." })
  };
  return {
    title: item.title || tr({ fi: "Scorecaster-hälytys", en: "Scorecaster alert", es: "Alerta de Scorecaster" }),
    message: item.message || tr({ fi: "Seuratun kohteen tila muuttui.", en: "A watched selection changed.", es: "Cambió una selección seguida." })
  };
}
