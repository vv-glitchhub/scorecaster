# Mobile production review findings

Reviewed the 41-second iPhone production recording from 2026-07-31.

## Confirmed problems

- Today shows a useful explanation but still leaves a visually empty Top 3 area.
- AI Feed can be completely empty even while Matches has current market cards.
- Matches is the strongest screen, but the primary action and full AI explanation are separated from the card.
- The user must infer that market-only cards are observations rather than independent model recommendations.
- Profile exposes a Production Status entry in the normal account flow.
- Profile gives little value when the authentication session is missing.
- Hero typography and vertical spacing are too large on a narrow iPhone viewport.

## Acceptance criteria

- No blank black containers.
- AI Feed has a transparent fallback based on publishable market observations.
- Match cards expose a concise explanation and a clear paper action.
- Profile shows local paper performance before authentication and keeps operator links out of the normal account card.
- All changes preserve paper-only and open-methodology boundaries.
