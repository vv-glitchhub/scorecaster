export function getCurrentOddsForPick(pick, matches = []) {
  const match = matches.find((m) => m.id === pick.match?.id || m.id === pick.matchId);
  if (!match?.bestOdds) return null;

  const key = pick.key;
  const map = {
    home: "home",
    draw: "draw",
    away: "away",
    over: "over",
    under: "under",
    "spread-home": "spreadHome",
    "spread-away": "spreadAway",
  };

  return Number(match.bestOdds[map[key]]);
}

export function calculateCLV(pick, matches = []) {
  const takenOdds = Number(pick.addedOdds || pick.odds);
  const currentOdds = getCurrentOddsForPick(pick, matches);

  if (!takenOdds || !currentOdds) {
    return {
      status: "unknown",
      label: "CLV ei vielä saatavilla",
      takenOdds,
      currentOdds: null,
      difference: null,
      percentage: null,
      message: "Hae pelit myöhemmin uudestaan, niin appi voi verrata kerrointa.",
    };
  }

  const difference = takenOdds - currentOdds;
  const percentage = difference / currentOdds;

  if (difference > 0) {
    return {
      status: "positive",
      label: "+CLV",
      takenOdds,
      currentOdds,
      difference,
      percentage,
      message: "Hyvä merkki: sait paremman kertoimen kuin markkina nyt.",
    };
  }

  if (difference < 0) {
    return {
      status: "negative",
      label: "-CLV",
      takenOdds,
      currentOdds,
      difference,
      percentage,
      message: "Markkina tarjoaa nyt paremman kertoimen kuin lisäyshetkellä.",
    };
  }

  return {
    status: "neutral",
    label: "CLV 0",
    takenOdds,
    currentOdds,
    difference,
    percentage,
    message: "Kerroin ei ole muuttunut.",
  };
}
