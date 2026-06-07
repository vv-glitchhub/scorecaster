export function calculateMatchContext(pick = {}) {
  const homeAdvantage = calculateHomeAdvantage(pick);
  const restDays = calculateRestDays(pick);
  const travel = calculateTravelFatigue(pick);
  const injuries = calculateInjuryImpact(pick);
  const form = calculateFormImpact(pick);
  const lineMovement = calculateLineMovementImpact(pick);

  const totalScore = clamp(
    homeAdvantage.score +
      restDays.score +
      travel.score +
      injuries.score +
      form.score +
      lineMovement.score,
    -0.12,
    0.12
  );

  return {
    totalScore,
    grade: gradeContext(totalScore),
    factors: {
      homeAdvantage,
      restDays,
      travel,
      injuries,
      form,
      lineMovement
    },
    notes: [
      homeAdvantage.note,
      restDays.note,
      travel.note,
      injuries.note,
      form.note,
      lineMovement.note
    ].filter(Boolean)
  };
}

function calculateHomeAdvantage(pick) {
  const selection = normalize(pick.selection);
  const homeTeam = normalize(pick.homeTeam);

  if (selection && homeTeam && selection === homeTeam) {
    return { score: 0.018, note: "Home advantage supports the selection." };
  }

  return { score: 0, note: "No home advantage boost detected." };
}

function calculateRestDays(pick) {
  const selectedRest = Number(pick.selectedRestDays ?? pick.restDays);
  const opponentRest = Number(pick.opponentRestDays);

  if (!Number.isFinite(selectedRest) || !Number.isFinite(opponentRest)) {
    return { score: 0, note: "Rest-day data missing." };
  }

  const diff = selectedRest - opponentRest;
  if (diff >= 2) return { score: 0.018, note: "Rest advantage supports the selection." };
  if (diff <= -2) return { score: -0.02, note: "Rest disadvantage hurts the selection." };
  return { score: 0, note: "Rest situation is neutral." };
}

function calculateTravelFatigue(pick) {
  const travelKm = Number(pick.travelKm7d ?? pick.travelKm ?? 0);
  const opponentTravelKm = Number(pick.opponentTravelKm7d ?? pick.opponentTravelKm ?? 0);

  if (!travelKm && !opponentTravelKm) {
    return { score: 0, note: "Travel data missing or neutral." };
  }

  const diff = travelKm - opponentTravelKm;
  if (diff <= -1000) return { score: 0.012, note: "Travel load favors the selection." };
  if (diff >= 1000) return { score: -0.018, note: "Travel fatigue risk for the selection." };
  return { score: 0, note: "Travel load is neutral." };
}

function calculateInjuryImpact(pick) {
  const selectedInjuries = Number(pick.selectedInjuries ?? pick.injuriesCount ?? 0);
  const opponentInjuries = Number(pick.opponentInjuries ?? 0);
  const keyPlayerOut = Boolean(pick.keyPlayerOut || pick.selectedKeyPlayerOut);

  if (keyPlayerOut) return { score: -0.04, note: "Key player absence hurts the selection." };

  const diff = selectedInjuries - opponentInjuries;
  if (diff <= -2) return { score: 0.015, note: "Injury situation favors the selection." };
  if (diff >= 2) return { score: -0.025, note: "Injury situation hurts the selection." };
  return { score: 0, note: "Injury situation is neutral or unknown." };
}

function calculateFormImpact(pick) {
  const selectedForm = Number(pick.selectedFormLast5 ?? pick.formLast5 ?? pick.formRating);
  const opponentForm = Number(pick.opponentFormLast5 ?? pick.opponentFormRating);

  if (!Number.isFinite(selectedForm) || !Number.isFinite(opponentForm)) {
    return { score: 0, note: "Recent form data missing." };
  }

  const diff = selectedForm - opponentForm;
  if (diff >= 1.5) return { score: 0.018, note: "Recent form supports the selection." };
  if (diff <= -1.5) return { score: -0.018, note: "Recent form is a concern." };
  return { score: 0, note: "Recent form is neutral." };
}

function calculateLineMovementImpact(pick) {
  const movement = Number(pick.lineMovement ?? pick.oddsMovement ?? 0);

  if (!movement) return { score: 0, note: "No meaningful line movement detected." };
  if (movement > 0.04) return { score: 0.018, note: "Line movement supports the selection." };
  if (movement < -0.04) return { score: -0.018, note: "Line movement moves against the selection." };
  return { score: 0, note: "Line movement is minor." };
}

function gradeContext(score) {
  if (score >= 0.075) return "A";
  if (score >= 0.04) return "B";
  if (score >= 0.01) return "C";
  if (score >= -0.02) return "Neutral";
  if (score >= -0.06) return "Risk";
  return "High Risk";
}

function normalize(value = "") {
  return String(value).toLowerCase().trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
