# Daily Brief V1

Daily Brief V1 gives normal Scorecaster users one governed daily view instead of requiring them to interpret several separate tools.

## User value

The brief combines:

- the strongest current PLAY decisions
- WATCH observations that need a price, evidence or risk change
- explicit SKIP decisions
- local paper-portfolio ROI and open-pick count
- a selectable daily discipline mode
- a copyable plain-text brief
- a locally stored snapshot

## Discipline modes

### Selective

Shows at most one PLAY. This is the default choice for users who want the smallest decision load.

### Balanced

Shows at most three PLAY decisions and the strongest WATCH observations.

### Observe

Shows no new PLAY decisions. The user can monitor WATCH observations and risk context without adding a paper pick.

The focus mode changes presentation only. It cannot alter market probability, model probability, decision gates, odds, edge or EV.

## Product boundaries

- paper tracking only
- no bookmaker execution
- no deposits or withdrawals
- no automatic probability override
- no promotion from WATCH or SKIP to PLAY
- missing data remains visible
- SKIP remains a valid outcome

## Data flow

1. The client fetches the existing governed `/api/top-picks` response with `cache: "no-store"`.
2. Existing product decisions are normalized to PLAY, WATCH, CAUTION or SKIP.
3. Picks are ordered by decision class, edge, EV and confidence for presentation only.
4. Local paper-tracking history is summarized with the existing tracking engine.
5. Focus preferences and snapshots are stored only in browser local storage.

## Discoverability

The page is available at `/brief` and appears in the normal More tools menu as Daily Brief / Päivän briefi / Informe diario.

## Validation

`npm run test:easy-use` now includes `scripts/daily-brief.test.mjs`, which verifies:

- route and navigation discoverability
- use of shared product components
- PLAY, WATCH and SKIP separation
- paper-only and no-override safety language
- governed Top Picks data use
- local preference and snapshot storage
