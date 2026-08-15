# Verified Soccer Lineups V1

Scorecaster can use SportsDataIO Soccer v4 Box Scores as a built-in lineup evidence fallback when the configured lineup provider is unavailable or incomplete.

## Verification boundary

A SportsDataIO lineup is considered live evidence only when:

- the Scorecaster league maps to a SportsDataIO competition with current deep player-stat coverage;
- the event is inside the bounded pregame acquisition window;
- exactly one provider BoxScore matches the home and away teams at or above the configured match-confidence threshold;
- the matched BoxScore contains exactly 11 `Starter` rows for the home team and exactly 11 `Starter` rows for the away team;
- the evidence is fresh enough to survive the existing Sports Intelligence freshness guard.

Anything else remains unsupported, not-yet-available, not-confirmed, ambiguous, subscription-unavailable or otherwise fail-closed.

## Current built-in competition mapping

- EPL: 1
- Bundesliga: 2
- La Liga / Primera Division: 4
- Serie A: 6
- MLS: 8
- Ligue 1: 13
- Eliteserien: 42

Allsvenskan and Veikkausliiga are intentionally not marked supported by this deep lineup adapter until equivalent provider evidence is established.

## Safety

- lineup context remains downgrade/explanation evidence;
- probability is not upgraded from lineup evidence;
- autonomous thresholds are unchanged;
- paper-only boundaries are unchanged;
- unknown key-player availability remains `null`, never silently converted to `true`.
