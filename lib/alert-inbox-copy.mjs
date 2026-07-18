function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function odds(value) {
  const number = finite(value);
  return number === null ? "–" : number.toFixed(2);
}

function movement(value) {
  const number = finite(value);
  return number === null ? "–" : `${(number * 100).toFixed(1)} %`;
}

export function localizedAlertCopy(item = {}, tr) {
  const details = item.details || {};
  const type = item.alert_type || item.type;

  if (type === "kickoff_soon") {
    return {
      title: tr({ fi: "Ottelu alkaa pian", en: "Kickoff is approaching", es: "El partido comienza pronto" }),
      message: tr({
        fi: `Seurattu ottelu alkaa noin ${details.minutesToKickoff ?? "–"} minuutin kuluttua.`,
        en: `The watched fixture starts in about ${details.minutesToKickoff ?? "–"} minutes.`,
        es: `El partido seguido comienza en unos ${details.minutesToKickoff ?? "–"} minutos.`
      })
    };
  }
  if (type === "decision_changed") {
    return {
      title: tr({ fi: "Scorecaster-päätös muuttui", en: "Scorecaster decision changed", es: "Cambió la decisión de Scorecaster" }),
      message: tr({
        fi: `Päätös muuttui ${details.addedDecision || "–"} → ${details.currentDecision || "–"}.`,
        en: `The decision changed from ${details.addedDecision || "–"} to ${details.currentDecision || "–"}.`,
        es: `La decisión cambió de ${details.addedDecision || "–"} a ${details.currentDecision || "–"}.`
      })
    };
  }
  if (type === "price_moved") {
    return {
      title: tr({ fi: "Seurattu kerroin muuttui", en: "Tracked price moved", es: "Cambió la cuota seguida" }),
      message: tr({
        fi: `Kerroin muuttui ${odds(details.addedOdds)} → ${odds(details.currentOdds)} (${movement(details.oddsMove)}).`,
        en: `The price moved from ${odds(details.addedOdds)} to ${odds(details.currentOdds)} (${movement(details.oddsMove)}).`,
        es: `La cuota cambió de ${odds(details.addedOdds)} a ${odds(details.currentOdds)} (${movement(details.oddsMove)}).`
      })
    };
  }
  if (type === "below_play_price") {
    return {
      title: tr({ fi: "Hinta ei enää täytä PLAY-rajaa", en: "Price no longer meets the PLAY floor", es: "La cuota ya no supera el límite PLAY" }),
      message: tr({
        fi: `Nykykerroin ${odds(details.currentOdds)} alittaa lasketun rajan ${odds(details.minimumPlayOdds)}.`,
        en: `Current odds ${odds(details.currentOdds)} are below the calculated floor ${odds(details.minimumPlayOdds)}.`,
        es: `La cuota actual ${odds(details.currentOdds)} está por debajo del límite calculado ${odds(details.minimumPlayOdds)}.`
      })
    };
  }
  if (type === "market_unavailable") {
    return {
      title: tr({ fi: "Nykyinen markkina ei ole saatavilla", en: "Current market is unavailable", es: "El mercado actual no está disponible" }),
      message: tr({
        fi: "Live-palvelu ei palauttanut vastaavaa markkinaa. Korvaavaa tietoa ei keksitty.",
        en: "The live provider did not return a matching market. No replacement data was invented.",
        es: "El proveedor en vivo no devolvió un mercado equivalente. No se inventaron datos de reemplazo."
      })
    };
  }
  if (type === "fixture_passed") {
    return {
      title: tr({ fi: "Ottelun seuranta-aika päättyi", en: "Fixture passed the watch window", es: "El partido salió de la ventana de seguimiento" }),
      message: tr({
        fi: "Suunniteltu alkamisaika on ohitettu. Tulosseuranta pysyy erillisenä.",
        en: "The scheduled start time has passed. Result tracking remains separate.",
        es: "La hora prevista ya pasó. El seguimiento de resultados permanece separado."
      })
    };
  }

  return {
    title: item.title || tr({ fi: "Scorecaster-hälytys", en: "Scorecaster alert", es: "Alerta de Scorecaster" }),
    message: item.message || tr({ fi: "Seuratun kohteen tila muuttui.", en: "A watched selection changed.", es: "Cambió una selección seguida." })
  };
}
