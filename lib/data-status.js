export function getMatchDataStatus(match) {
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
      message: "Kertoimet löytyvät. Appi voi tehdä vedonlyöntianalyysin.",
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
    message: "Ottelu löytyy, mutta kertoimia ei ole saatavilla tästä lähteestä.",
  };
}

export function isBettableMatch(match) {
  return getMatchDataStatus(match).level === "bettable";
}
