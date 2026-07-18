# Form & Rest Shadow V1

## Purpose

Form & Rest Shadow V1 is Scorecaster's first sport-specific independent feature model. It is an evaluation layer, not a production betting model.

The production probability remains the no-vig market consensus. The shadow output cannot change:

- PLAY / CAUTION / SKIP
- model or consensus probability
- edge or expected value
- ranking
- paper stake or portfolio allocation

## Supported modes

### Binary shadow probability

- NHL: `nhl-form-rest-logit-v1`
- NBA: `nba-form-rest-logit-v1`

### Feature audit only

- English Premier League
- La Liga

Football remains feature-only in V1 because a home-versus-away binary probability would incorrectly omit the draw outcome.

## Data and chronology

Recent completed league events are loaded through the bounded `results-provider` adapter.

- TheSportsDB league mapping is explicit.
- At most 120 league results are accepted.
- Results are cached for 10 minutes.
- At most five previous games per team are used.
- Events at or after the target fixture start are excluded.
- Incomplete events and unmatched teams are excluded.

The snapshot calculates:

- recency-weighted result rate
- normalized score margin
- last played time
- rest hours and days
- back-to-back status
- games in the previous 7 and 14 days
- schedule-congestion score

## Shadow model

NHL and NBA use a fixed, reviewed V1 logit formula over home advantage, form, score margin, rest and congestion. Its output is stored as `shadowProbability` alongside the unchanged market benchmark.

Every snapshot carries these immutable safety declarations:

```text
probabilityAppliedToProduction: false
usedForDecision: false
chronologyGuard: true
```

## Audited paper save

Current Scorecaster picks use:

```text
POST /api/cloud/bets/audited
```

The server:

1. authenticates the user and checks mutation origin
2. rate-limits the request
3. reloads current Top Picks
4. matches the event and selection
5. saves the paper row through the existing risk-controlled API
6. attaches a compact server-derived feature snapshot to `raw_pick`

Client-supplied feature snapshots are ignored. Accepted audit rows use:

```text
featureSnapshotSource: server-top-picks
```

Manual paper picks continue to use the normal paper API and are not treated as model-audit samples.

## Chronological lab

Authenticated users can open:

```text
/form-rest-lab
GET /api/agent/form-rest-lab
```

The lab accepts only settled rows that contain a server-audited snapshot. It compares:

- Champion: market consensus
- Challenger: Form & Rest Shadow V1

Evaluation uses an older training segment and a newer untouched holdout. Metrics include Brier score, log loss and calibration gap.

The V1 lab never automatically promotes the challenger, even when it performs better on a holdout. A future production experiment requires a separately reviewed sport-specific model version, a larger sample and explicit approval.

## Privacy and deletion

The snapshot contains public sports-derived features and bounded technical metadata. It does not contain payment data, bookmaker credentials, contacts or precise location.

Snapshots are stored inside the existing paper row:

- account export includes `raw_pick`
- deleting the paper row removes the snapshot
- deleting the account removes all paper rows under the existing deletion flow
- Row Level Security continues to isolate rows by authenticated user

## Required checks

Run:

```bash
npm run test:form-rest
npm test
npm run build
cd mobile && npm run typecheck
```

Public release remains blocked until the normal two-user isolation, account export/deletion, mobile-device and external security checks pass.
