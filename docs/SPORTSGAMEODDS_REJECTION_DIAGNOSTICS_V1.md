# SportsGameOdds Rejection Diagnostics V1

## Purpose

This layer explains why a supported SportsGameOdds event did not become usable secondary pricing evidence. It is diagnostic only; it does not change matching thresholds or betting decisions.

## Fixed gates

The matching gates remain:

- per-side team similarity: **0.55**
- event start-time window: **8 hours**
- final match confidence: **0.72**

No production code in this package may lower these values from readiness evidence alone.

## Rejection stages

`no_candidates`
: The provider response contained no events in the requested league/time window.

`team_similarity`
: Candidate events existed, but no direct/swapped orientation had both teams at or above the 0.55 similarity gate.

`time_window`
: At least one orientation passed both team gates, but no team-qualified candidate was within the eight-hour event-time gate.

`confidence_threshold`
: At least one candidate passed team and time gates, but the best final confidence remained below 0.72.

`matched`
: The selected candidate passed all three gates. This does not by itself prove usable market quotes exist; quote availability remains a separate pricing-coverage concern.

## Stored numeric diagnostics

For supported provider responses the allowlisted diagnostic object may contain:

- provider event count
- evaluated orientation count
- count passing both team gates
- count passing the time gate
- count passing final confidence
- best bounded confidence
- best bounded home/away similarity
- best non-negative event-time difference
- the three fixed thresholds

It does **not** retain rejected provider team names or provider event identifiers in the release evidence path.

## Aggregation

Production Evidence aggregates diagnostics by provider and by provider/league:

- rejection reason counts
- average candidate/orientation counts
- average team/time/confidence gate pass counts
- average best confidence
- average best minimum team similarity
- average best time difference
- observed threshold values

Individual event IDs, team names, selections and raw provider payloads are excluded from the public evidence object and from the external provider diagnosis artifact.

## Interpretation

A high `no_candidates` share suggests request scope/provider event availability should be investigated.

A high `team_similarity` share suggests deterministic team normalization or verified aliases should be investigated. Do not add broad fuzzy aliases automatically.

A high `time_window` share suggests event time normalization/provider timestamp behavior should be investigated before changing the eight-hour gate.

A high `confidence_threshold` share suggests candidate quality is borderline after valid team/time matching. The 0.72 threshold must not be lowered automatically to increase coverage.

A high `matched` share combined with weak multi-provider coverage means the next audit should focus on usable quote extraction/market-side support rather than event matching.

## Safety boundary

- paper-only
- no bookmaker login or credential exposure
- no deposits, withdrawals or Cash Out
- no real-money execution
- no probability or stake changes
- no automatic PLAY upgrades
- no invented league IDs
- no missing-data imputation
