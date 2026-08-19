# Intelligence PLAY Safety V1

Version: `intelligence-play-safety-v1`

## Goal

Keep missing independent sports intelligence neutral while preserving downgrade-only safety for verified adverse evidence.

A market-qualified PLAY is no longer downgraded merely because injury, lineup or news coverage is incomplete. Missing data remains visible as uncertainty, but absence of evidence is not treated as negative evidence.

## Decision contract

The market decision is calculated first from the existing price and market-data gates.

A market-qualified PLAY is downgraded to CAUTION only when one of these conditions is present:

- verified team-attributed negative intelligence crosses the existing -1.5 percentage-point relative-impact threshold
- independent sources contain an unresolved conflict

Missing, partial or market-only intelligence does not itself downgrade PLAY.

The independent-intelligence layer remains downgrade-only. It cannot create a PLAY, increase edge, change EV, alter the no-vig consensus probability or execute a real-money wager.

## Market gates remain unchanged

PLAY still requires the existing Top Picks gates, including:

- at least 2.0% edge
- at least 3.0% EV
- at least four bookmakers
- at least 55% market-data confidence
- non-stale market data
- an accepted quality grade

SKIP and CAUTION thresholds are unchanged.

## Production motivation

Before this policy, a market-qualified selection could be forced to CAUTION solely because Sports Intelligence readiness was not `verified`. This made missing lineup or injury-provider coverage behave as if it were adverse evidence.

The unified-data layer already used the safer rule: missing factors generate a warning while only downgrade-eligible verified negative factors can force CAUTION. This V1 contract aligns Sports Intelligence and Top Picks with that same boundary.

## Safety

- probability adjusted by intelligence: false
- edge adjusted by intelligence: false
- EV adjusted by intelligence: false
- intelligence can upgrade market decision: false
- unresolved conflicts can downgrade PLAY: true
- verified negative evidence can downgrade PLAY: true
- missing evidence can downgrade PLAY: false
- real-money execution: false
- paper-only: true
