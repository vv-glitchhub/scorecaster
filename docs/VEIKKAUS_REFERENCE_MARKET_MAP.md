# Football market reference map

This document records the football market families visible in operator UI reference screenshots supplied by the Scorecaster operator on 2026-08-21. The screenshots are used only to define product taxonomy and UX coverage targets.

Scorecaster must not scrape, reproduce or redistribute Veikkaus prices, account data or private API traffic. Production odds remain sourced only from providers that pass Scorecaster's source-rights and entitlement checks.

## Market families visible in the reference

- Match winner / 1X2
- First goal / first team to score
- 3-way handicap / result handicap
- Match goals over/under with alternate lines
- Winner + match total combinations
- Both teams to score
- 1X2 + both teams to score
- Both teams to score + match total combinations
- Double chance
- Draw no bet
- Goalscorers and player scoring props
- Half-time / full-time
- First-half 1X2
- Corners over/under
- First-half first goal
- Team goals over/under
- Most corners / corners 1X2
- Cards over/under
- Most cards
- Winning margin
- Specials / same-game combinations
- First-goal time bands (10-minute and 15-minute intervals)

## Current provider-backed Scorecaster coverage

The Odds API currently documents event-level soccer support for a subset of these families, including `h2h_3_way`, `btts`, `draw_no_bet`, `double_chance`, `correct_score`, `halftime_fulltime`, `btts_h1`, `double_chance_h1`, `correct_score_h1`, corners, cards, alternate totals/team totals and selected player props.

The event markets discovery endpoint should be treated as the runtime source of truth for which market keys are actually available for a specific event and bookmaker. Static taxonomy is a target catalog, not evidence that a price exists.

## Product rule

Every taxonomy entry must resolve to one of three states:

1. `available` — confirmed by a licensed provider for the selected event;
2. `provider-gap` — known product family but no configured provider exposes it;
3. `not-offered` — supported by the configured provider contract but not currently offered for the selected event.

Scorecaster may show `provider-gap` and `not-offered` as transparent coverage information, but must never invent prices, probabilities, player lines or event availability.

Real-money execution remains absent. All Scorecaster decisions and tracking remain paper-only.
