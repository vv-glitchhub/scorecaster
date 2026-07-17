# Real Sports Intelligence V1

Real Sports Intelligence V1 separates Scorecaster's market calculation from optional sports context.

## Architecture

The public Top Picks route remains a market-only calculation:

1. accept a verified near-term fixture from the configured live odds provider
2. remove bookmaker margin
3. build a multi-bookmaker consensus probability
4. compare the best available price with the consensus fair price
5. calculate edge, expected value, market-data confidence and freshness

News, injury, lineup or external-market data does not alter that public probability.

The authenticated Agent evaluates sports context for at most six high-priority selections per request. This bound reduces provider load and prevents one unavailable service from delaying the complete market list.

## Evidence requirements

A context item is shown as verified evidence only when it contains:

- a recognized category
- a concrete subject and status
- an identified source
- a retrieval or observation time when available
- a freshness classification
- an explicit provider mode marked live

Missing data remains missing. Provider errors, unsupported leagues, disabled sources and not-configured sources do not become neutral or positive claims.

## Removed placeholder behavior

The active context path no longer:

- calls a placeholder lineup URL
- assumes key players are available
- assumes lineup stability
- substitutes unrelated news articles
- substitutes unrelated external markets
- labels ordinary price movement as informed money
- changes probability through a legacy context score

## Downgrade-only governance

Verified sports context may add a safety blocker. A blocker can convert PLAY to WATCH and set the planned paper allocation to zero.

The context layer cannot:

- promote WATCH or SKIP to PLAY
- change model or consensus probability
- change edge or expected value
- increase a paper allocation
- override Agent V11 drift protection
- override personal or portfolio risk limits

Current safety blockers include:

- a verified key-player availability concern
- no fresh confirmed starting lineup close to kickoff
- no verified injury feed close to kickoff
- stale critical lineup or injury evidence
- sports context not evaluated because the bounded request limit was reached

## Current source adapters

### News

The news adapter is optional. It keeps only articles that mention at least one of the teams with sufficient token overlap, requires an HTTPS article URL and attaches source and publication metadata. It does not insert unrelated fallback articles.

### Injuries

The injury adapter is optional and currently supports only leagues mapped to the configured structured sports-data provider. Records without a player, team or status are rejected. Team matching is required before a record enters the evidence set.

### Lineups

No production lineup provider is configured in V1. The adapter returns explicit unknown values. This is intentional: unknown is safer than claiming that starters, goalies or key players are confirmed.

### External markets

External-market context is disabled by default. When explicitly enabled, a market must mention both teams. It remains context-only and is never a decision input.

## Web and mobile audit

The Agent surfaces:

- how many selections received context evaluation
- verified, partial, unavailable and unevaluated counts
- how many selections were blocked by context
- per-selection context status and coverage
- source provider and mode
- verified evidence
- missing evidence
- context blockers
- a clear statement that probability was unchanged

## Security and privacy

The standalone context endpoint:

- requires an authenticated session
- validates request origin for cookie mutations
- applies a per-user quota
- accepts only bounded strings and supported sport keys
- returns the normalized report rather than raw provider payloads
- does not accept unrestricted user notes
- does not send account identifiers or payment information to context providers

Provider keys remain server-only.

## Release tests

The regression suite verifies that:

- unavailable providers create no evidence
- live records create bounded sourced evidence
- close-to-kickoff gaps create safety blockers
- context attachment preserves probability, edge and expected value
- context governance only downgrades decisions
- placeholder and unrelated fallback behavior is absent
- public Top Picks remains market-only
- Agent context work is authenticated and bounded
- web and native Agent interfaces expose source audit information

## Product boundary

Real Sports Intelligence V1 supports sports analysis and virtual paper tracking. It does not guarantee outcomes or profit, process money, connect to bookmaker accounts or execute transactions.
