import { buildAgentLearningV4 } from "./agent-learning-v4";
import { applyAgentScoreV9 } from "./agent-score-engine-v9";

export function applyModelReview({ picks = [], records = [] } = {}) {
  const learning = buildAgentLearningV4({ records });
  const segmentProfile = buildSegmentProfile(records);
  const scored = applyAgentScoreV9({ picks, learning });

  const data = scored
    .map((pick) => {
      const segmentAdjustment = calculateSegmentAdjustment({ pick, segmentProfile });
      const riskAdjustment = calculateRiskAdjustment({ pick, learning });
      const reviewedScore100 = clamp(Number(pick.finalScore100 || 0) + segmentAdjustment + riskAdjustment, 0, 100);
      const reviewGrade = gradeScore(reviewedScore100);
      const reviewDecision = decideReviewedPick({ score: reviewedScore100, grade: reviewGrade, pick, riskMode: learning.weights?.riskMode || "balanced" });

      return {
        ...pick,
        reviewVersion: "model-review-v1",
        finalScore100: reviewedScore100,
        reviewGrade,
        reviewDecision,
        decision: reviewDecision,
        segmentAdjustment,
        riskAdjustment,
        review: {
          riskMode: learning.weights?.riskMode || "balanced",
          segmentProfile: findSegmentSnapshot({ pick, segmentProfile }),
          notes: buildReviewNotes({ segmentAdjustment, riskAdjustment, learning })
        },
        rankScore: reviewedScore100
      };
    })
    .sort((a, b) => Number(b.rankScore || 0) - Number(a.rankScore || 0))
    .map((pick, index) => ({ ...pick, reviewRank: index + 1 }));

  return {
    ok: true,
    source: "model-review-engine-v1",
    generatedAt: new Date().toISOString(),
    learning,
    segmentProfile,
    summary: buildReviewSummary(data, learning),
    data
  };
}

function buildSegmentProfile(records = []) {
  const groups = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    const league = record.league || record.leagueTitle || record.sportKey || "Unknown";
    const market = record.marketKey || record.market || "Unknown";
    const key = `${league}::${market}`;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const [league, market] = key.split("::");
    const wins = group.filter((record) => ["win", "won"].includes(normalizeResult(record.result))).length;
    const losses = group.filter((record) => ["loss", "lost"].includes(normalizeResult(record.result))).length;
    const stake = group.reduce((sum, record) => sum + Number(record.stake || record.suggestedStake || 0), 0);
    const profit = group.reduce((sum, record) => sum + Number(record.profit || 0), 0);
    const roi = stake > 0 ? profit / stake : average(group.map((record) => Number(record.roi || 0)));
    const hitRate = wins + losses > 0 ? wins / (wins + losses) : 0;
    const averageCLV = average(group.map((record) => Number(record.clvPercent || 0)));

    return {
      key,
      league,
      market,
      count: group.length,
      roi,
      hitRate,
      averageCLV,
      scoreAdjustment: clamp(roi * 18 + averageCLV * 0.7 + (hitRate - 0.5) * 10, -8, 8)
    };
  });
}

function calculateSegmentAdjustment({ pick, segmentProfile }) {
  const league = pick.league || pick.leagueTitle || pick.sportKey || "Unknown";
  const market = pick.marketKey || pick.market || "Unknown";
  const exact = segmentProfile.find((item) => item.league === league && item.market === market);
  const leagueOnly = segmentProfile.filter((item) => item.league === league);

  if (exact && exact.count >= 3) return exact.scoreAdjustment;
  if (leagueOnly.length) return clamp(average(leagueOnly.map((item) => item.scoreAdjustment)) * 0.5, -4, 4);
  return 0;
}

function calculateRiskAdjustment({ pick, learning }) {
  const riskMode = learning?.weights?.riskMode || "balanced";
  const riskLevel = pick.riskLevel || "Medium";
  const readiness = pick.readiness?.level || pick.readinessLevel || "Medium";

  let adjustment = 0;
  if (riskMode === "defensive") adjustment -= 4;
  if (riskMode === "aggressive") adjustment += 2;
  if (riskLevel === "High") adjustment -= 5;
  if (readiness === "Low") adjustment -= 4;
  if (Number(pick.sourceTrust || 0) < 0.35) adjustment -= 3;

  return adjustment;
}

function findSegmentSnapshot({ pick, segmentProfile }) {
  const league = pick.league || pick.leagueTitle || pick.sportKey || "Unknown";
  const market = pick.marketKey || pick.market || "Unknown";
  return segmentProfile.find((item) => item.league === league && item.market === market) || null;
}

function buildReviewSummary(data, learning) {
  return {
    total: data.length,
    bets: data.filter((pick) => pick.decision === "BET").length,
    watchlist: data.filter((pick) => pick.decision === "WATCH").length,
    wait: data.filter((pick) => pick.decision === "WAIT").length,
    pass: data.filter((pick) => pick.decision === "PASS").length,
    riskMode: learning?.weights?.riskMode || "balanced",
    averageScore: average(data.map((pick) => Number(pick.finalScore100 || 0)))
  };
}

function decideReviewedPick({ score, grade, pick, riskMode }) {
  if (riskMode === "defensive" && score < 84) return score >= 70 ? "WATCH" : "WAIT";
  if (pick.riskLevel === "High" && score < 86) return "WAIT";
  if (["A+", "A"].includes(grade) && score >= 84) return "BET";
  if (["A", "B"].includes(grade) && score >= 72) return "WATCH";
  if (score >= 62) return "WAIT";
  return "PASS";
}

function buildReviewNotes({ segmentAdjustment, riskAdjustment, learning }) {
  const notes = [];
  if (segmentAdjustment > 1) notes.push("Historical segment profile supports this setup.");
  if (segmentAdjustment < -1) notes.push("Historical segment profile reduces confidence.");
  if (riskAdjustment < 0) notes.push("Risk controls reduced the score.");
  if (learning?.weights?.riskMode === "defensive") notes.push("Learning profile is currently defensive.");
  if (!notes.length) notes.push("Review layer applied neutral adjustment.");
  return notes;
}

function gradeScore(score) {
  if (score >= 90) return "A+";
  if (score >= 84) return "A";
  if (score >= 72) return "B";
  if (score >= 62) return "C";
  if (score >= 50) return "D";
  return "F";
}

function normalizeResult(result) {
  const value = String(result || "").toLowerCase();
  if (value === "won") return "win";
  if (value === "lost") return "loss";
  return value;
}

function average(values = []) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
