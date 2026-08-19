import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../lib/autonomous-paper-agent-governed-v13.js", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing autonomous risk patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Ambiguous autonomous risk patch anchor: ${label}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'import { buildAgentV9Portfolio } from "./agent-v9-engine.mjs";\n',
  'import { buildAgentV9Portfolio } from "./agent-v9-engine.mjs";\nimport { normalizeAgentRiskProfile } from "./agent-risk-profile-v1.mjs";\n',
  "shared risk import"
);

replaceOnce(
  '    sports,\n    dailyPickLimit: Math.max(1, Math.min(MAX_PICKS_PER_USER, Math.trunc(finite(row.daily_pick_limit, 3)))),',
  '    sports,\n    riskProfile: normalizeAgentRiskProfile(row.risk_profile),\n    dailyPickLimit: Math.max(1, Math.min(MAX_PICKS_PER_USER, Math.trunc(finite(row.daily_pick_limit, 3)))),',
  "settings normalization"
);

replaceOnce(
  '.select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled")',
  '.select("enabled,sports,daily_pick_limit,min_priority_score,min_odds,max_odds,min_data_coverage,min_provider_count,max_provider_disagreement,max_drawdown_percent,max_daily_loss_percent,pause_after_losses,cooldown_hours,max_open_picks,minimum_minutes_before_start,maximum_hours_before_start,auto_pause_on_incident,require_unified_data,adaptive_cadence,shadow_learning_enabled,risk_profile")',
  "settings query"
);

replaceOnce(
  '    const requested = Math.max(0, finite(decision.allocatedStake || decision.suggestedStake));',
  '    const requested = Math.max(0, finite(decision.allocatedStake ?? decision.suggestedStake));',
  "zero allocation preservation"
);

replaceOnce(
  '      robustnessScore: round(decision.robustnessScore, 6),\n      minimumPlayOdds: decision.priceGuard?.minimumPlayOdds ?? null,',
  '      robustnessScore: round(decision.robustnessScore, 6),\n      riskProfile: decision.riskProfile,\n      riskPolicy: decision.riskPolicy || null,\n      probabilityChangedByRisk: false,\n      minimumPlayOdds: decision.priceGuard?.minimumPlayOdds ?? null,',
  "paper-pick risk audit"
);

replaceOnce(
  '    minutes_before_start: audit.data?.minutesBeforeStart ?? null,\n    proposed_stake: round(proposedStake, 2) || 0,',
  '    minutes_before_start: audit.data?.minutesBeforeStart ?? null,\n    risk_profile: decision.riskProfile,\n    risk_policy: decision.riskPolicy || {},\n    proposed_stake: round(proposedStake, 2) || 0,',
  "decision audit risk columns"
);

replaceOnce(
  '      maxLeagueExposurePercent: entry.context.bankroll.maxLeagueExposurePercent,\n      learning\n    });\n    const governed = applyModelLabSafety(portfolio.decisions, modelLab);\n    const exposure = existingExposure(entry.context.openBets, entry.context.bankroll);',
  '      maxLeagueExposurePercent: entry.context.bankroll.maxLeagueExposurePercent,\n      riskProfile: entry.context.settings.riskProfile,\n      learning\n    });\n    const riskBoundedContext = {\n      ...entry.context,\n      bankroll: {\n        ...entry.context.bankroll,\n        maxStakePercent: portfolio.effectiveLimits.maxStakePercent,\n        maxTotalExposurePercent: portfolio.effectiveLimits.maxTotalExposurePercent,\n        maxLeagueExposurePercent: portfolio.effectiveLimits.maxLeagueExposurePercent\n      }\n    };\n    const governed = applyModelLabSafety(portfolio.decisions, modelLab);\n    const exposure = existingExposure(riskBoundedContext.openBets, riskBoundedContext.bankroll);',
  "portfolio risk propagation"
);

replaceOnce(
  '        bankroll: entry.context.bankroll,\n        performance,',
  '        bankroll: riskBoundedContext.bankroll,\n        performance,',
  "candidate effective limits"
);

replaceOnce(
  '    const allocation = allocateSelections(audited, entry.context, performance, globalBudget);',
  '    const allocation = allocateSelections(audited, riskBoundedContext, performance, globalBudget);',
  "allocation effective limits"
);

replaceOnce(
  '      paperOnly: true,\n      agentVersion: "Autonomous-Paper-Agent-V2",\n      source: source.source,',
  '      paperOnly: true,\n      agentVersion: "Autonomous-Paper-Agent-V2",\n      riskProfile: portfolio.riskProfile,\n      riskPolicy: portfolio.riskPolicy,\n      effectiveRiskLimits: portfolio.effectiveLimits,\n      probabilityChangedByRisk: false,\n      source: source.source,',
  "run summary risk provenance"
);

await writeFile(path, source, "utf8");
