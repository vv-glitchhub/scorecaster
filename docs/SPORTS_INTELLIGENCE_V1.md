# Sports Intelligence V1

Sports Intelligence V1 adds independently sourced match context to Scorecaster without allowing external context to rewrite the market-consensus probability.

## Purpose

The system is designed to answer three separate questions:

1. Is the fixture real and inside the supported near-term window?
2. Is independent evidence fresh, attributable to the correct team and internally consistent?
3. Does verified evidence create a reason to downgrade an otherwise valid market decision?

It does not claim that news, injuries or lineups make a pick certain.

## Data contract

The intelligence endpoint accepts only bounded match identity fields:

- home team
- away team
- supported sport / league context
- optional event ID
- optional kickoff timestamp

Provider responses are normalized on the server. Browser and mobile clients cannot assign source trust or submit evidence that becomes authoritative.

## Team attribution

Injury and lineup evidence is directional only when the provider row can be matched to exactly one of the fixture teams.

- unmatched team rows are discarded
- stale rows are discarded
- generic match-level lineup objects do not become team evidence
- a selected-team absence is negative for that side
- the same absence is not automatically negative for the opponent
- draw selections receive no directional team adjustment

## Source and freshness rules

The initial rules are intentionally conservative:

- news requires an HTTPS URL and a valid timestamp
- duplicate news URLs are removed
- news older than 96 hours is excluded from the report
- injury observations older than 120 hours are excluded
- lineup observations older than 36 hours are excluded
- source trust is assigned from a server-owned source-type table
- provider-supplied arbitrary trust numbers are not authoritative

News is contextual evidence. V1 does not convert headline keywords directly into a probability adjustment.

## Conflict handling

When the same player is reported both unavailable and available in current evidence, the report records an unresolved conflict.

An unresolved conflict prevents PLAY from surviving the independent-evidence gate. The result becomes CAUTION / WATCH until the conflict is resolved.

## Decision governance

Sports Intelligence V1 is downgrade-only:

- it may convert PLAY to CAUTION / WATCH
- it may add missing-evidence and conflict reasons
- it may expose a selection-relative evidence impact for auditing
- it cannot convert CAUTION or SKIP to PLAY
- it cannot change consensus probability, edge, EV or the Model Lab challenger
- it cannot create a real-money action

The Top Picks route preserves this gate after quality scoring. A later market-quality calculation cannot undo an intelligence downgrade.

## Provider controls

- the service skips provider calls when no intelligence provider is configured
- match intelligence responses use a bounded five-minute server cache
- Top Picks enriches at most 12 prefiltered selections per request
- cross-origin browser POST requests to the intelligence endpoint are rejected
- the News API credential is sent in a request header rather than the URL
- provider errors return unavailable evidence instead of invented replacement data

## Readiness levels

### Market-only

No independently verified team evidence is available. Market consensus cannot receive PLAY through the independent-evidence gate.

### Partial

Some current evidence exists, but one or more required checks are missing, generic or unresolved.

### Verified

Both teams have current team-attributed lineup evidence, the injury provider was checked and no current evidence conflict remains.

Verified does not mean certain. It only means the independent-evidence contract passed.

## Product boundary

Sports Intelligence V1 remains part of a paper-analysis product:

- no deposits or withdrawals
- no bookmaker credentials
- no real-money bet placement
- no guaranteed result or profit
- no invented fixture, injury, lineup or news item
