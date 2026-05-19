export function getMatchDataStatus(match) {
  if (match?.event_type === "outright") {
    if (match?.outrights?.length) {
      return {
        level: "bettable",
        label: "Outright betattava",
        color: "#86efac",
        message: "Outright-kertoimet löytyvät. Sopii turnaus-/voittajavedoille.",
      };
    }

    return {
      level: "fixture_only",
      label: "Ei outright-kertoimia",
      color: "#facc15",
      message: "Tapahtuma löytyy, mutta voittajamarkkinaa ei ole saatavilla.",
    };
  }

  const hasHomeAwayOdds = Boolean(match?.bestOdds?.home && match?.bestOdds?.away);
  const hasAnyOdds = Boolean(
    match?.bestOdds?.home ||
      match?.bestOdds?.draw ||
      match?.bestOdds?.away ||
      match?.bestOdds?.over ||
      match?.bestOdds?.under ||
      match?.bestOdds?.spreadHome ||
      match?.bestOdds?.spreadAway
  );

  if (hasHomeAwayOdds) {
    return {
      level: "bettable",
      label: "Betattava",
      color: "#86efac",
      message: "Kertoimet löytyvät. Appi voi tehdä analyysin.",
    };
  }

  if (hasAnyOdds) {
    return {
      level: "partial",
      label: "Osittainen data",
      color: "#fde68a",
      message: "Osa kertoimista löytyy, mutta analyysi on rajallinen.",
    };
  }

  return {
    level: "fixture_only",
    label: "Vain ottelulista",
    color: "#facc15",
    message: "Ottelu löytyy, mutta kertoimia ei ole saatavilla.",
  };
}

export function isBettableMatch(match) {
  return getMatchDataStatus(match).level === "bettable";
}
