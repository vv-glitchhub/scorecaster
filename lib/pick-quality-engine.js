export function calculatePickQuality(pick = {}) {
  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const finalScore = Number(pick.finalScore || 0);
  const odds = Number(pick.odds || 0);
  const sourceTrust = Number(pick.sourceTrust ?? 0.4);
  const sentiment = Number(pick.sentimentScore || 0);
  const confidence = Number(pick.confidence || pick.dataQuality?.confidence || 0);
  const bookmakerCount = Number(pick.bookmakerCount || pick.dataQuality?.bookmakerCount || 0);
  const dispersion = Number(pick.probabilityDispersion || pick.dataQuality?.probabilityDispersion || 0);
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const hasCoverageData = bookmakerCount > 0;

  let qualityScore = 0;
  const notes = [];

  if (edge >= 0.04) {
    qualityScore += 0.25;
    notes.push("Large best-price gap versus consensus.");
  } else if (edge >= 0.025) {
    qualityScore += 0.2;
    notes.push("Meaningful best-price gap versus consensus.");
  } else if (edge >= 0.015) {
    qualityScore += 0.14;
    notes.push("Moderate best-price gap versus consensus.");
  } else if (edge >= 0.005) {
    qualityScore += 0.07;
    notes.push("Small positive best-price gap.");
  } else {
    qualityScore -= 0.08;
    notes.push("No meaningful price advantage detected.");
  }

  if (ev >= 0.08) qualityScore += 0.12;
  else if (ev >= 0.03) qualityScore += 0.08;
  else if (ev > 0) qualityScore += 0.03;
  else qualityScore -= 0.06;

  if (confidence >= 0.75) {
    qualityScore += 0.18;
    notes.push("High market-data confidence.");
  } else if (confidence >= 0.55) {
    qualityScore += 0.12;
    notes.push("Good market-data confidence.");
  } else if (confidence >= 0.35) {
    qualityScore += 0.06;
    notes.push("Limited market-data confidence.");
  } else if (confidence > 0) {
    qualityScore -= 0.08;
    notes.push("Low market-data confidence.");
  }

  if (hasCoverageData) {
    if (bookmakerCount >= 8) {
      qualityScore += 0.15;
      notes.push("Broad bookmaker coverage.");
    } else if (bookmakerCount >= 5) {
      qualityScore += 0.1;
      notes.push("Good bookmaker coverage.");
    } else if (bookmakerCount >= 3) {
      qualityScore += 0.05;
      notes.push("Minimum useful bookmaker coverage.");
    } else {
      qualityScore -= 0.12;
      notes.push("Insufficient bookmaker coverage.");
    }

    if (dispersion <= 0.01 && bookmakerCount >= 3) {
      qualityScore += 0.1;
      notes.push("Bookmaker probabilities agree closely.");
    } else if (dispersion <= 0.025 && bookmakerCount >= 3) {
      qualityScore += 0.05;
    } else if (dispersion >= 0.06) {
      qualityScore -= 0.08;
      notes.push("Bookmaker probabilities disagree materially.");
    }
  } else {
    notes.push("Bookmaker coverage was not supplied to this analysis route.");
  }

  if (freshness === "fresh") qualityScore += 0.08;
  else if (freshness === "recent") qualityScore += 0.05;
  else if (freshness === "stale") {
    qualityScore -= 0.15;
    notes.push("Market data is stale.");
  } else if (freshness === "unknown" && hasCoverageData) {
    qualityScore -= 0.02;
    notes.push("Market-data age is unknown.");
  }

  if (sourceTrust >= 0.7) qualityScore += 0.07;
  else if (sourceTrust >= 0.4) qualityScore += 0.03;
  else qualityScore -= 0.05;

  if (finalScore >= 0.1) qualityScore += 0.06;
  else if (finalScore >= 0.05) qualityScore += 0.03;

  if (odds > 10) {
    qualityScore -= 0.05;
    notes.push("Extreme odds increase outcome variance.");
  }

  qualityScore += clamp(sentiment, -0.02, 0.02);

  const normalizedScore = clamp(qualityScore, 0, 1);
  const grade = gradeQuality(normalizedScore);

  return {
    qualityScore: normalizedScore,
    qualityGrade: grade,
    qualityNotes: notes
  };
}

function gradeQuality(score) {
  if (score >= 0.75) return "A";
  if (score >= 0.6) return "B";
  if (score >= 0.45) return "C";
  if (score >= 0.25) return "D";
  return "F";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
