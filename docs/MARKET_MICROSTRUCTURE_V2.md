# Scorecaster Market Microstructure V2

Market Microstructure V2 records normalized provider prices before an event starts and explains opening, current and final eligible pre-start market evidence without inventing the cause of a price move.

## Product boundary

The feature is paper-only and informational. It never logs into bookmaker accounts, transfers funds or places a real bet. It never claims that a movement is caused by `sharp money`, inside information or a particular bettor.

## Stored evidence

The worker stores only normalized fields:

- event, sport, league and scheduled start
- market, selection and point
- bookmaker key and display name
- decimal price
- raw implied probability
- bookmaker-level no-vig probability
- market overround
- provider update timestamp and Scorecaster capture timestamp
- source identity and deterministic reference

API keys, provider headers, quota data and raw bookmaker payloads are not stored or exposed.

## No-vig normalization

Within one bookmaker and market:

```text
raw_implied_i = 1 / decimal_odds_i
normalized_probability_i = raw_implied_i / sum(raw_implied_all_outcomes)
```

Provider probabilities are comparable only after this normalization.

## Deterministic movement rules

Default thresholds are versioned in `lib/market-microstructure-v2.mjs`:

- provider stale after 20 minutes
- synchronized update window: 30 minutes
- at least 3 eligible providers
- at least 67% of eligible providers moving in one direction
- provider movement must be at least 1.5 percentage points
- general meaningful probability movement: 1 percentage point
- meaningful price movement: 5%
- outlier floor: 3 percentage points from the fresh-provider median

A broad movement requires fresh, non-outlier, synchronized multi-provider evidence. A stale feed and an isolated outlier are excluded before the rule is evaluated.

Labels are deliberately limited to:

- `inferred-broad-market-movement`
- `isolated-provider-outlier`
- `observed-price-movement-unknown-cause`
- `broadly-stable-market`

Scorecaster never claims `sharp money` because provider prices alone do not identify who placed money or why the market changed.

## Opening, current and closing

- **Opening**: earliest eligible normalized row for each provider.
- **Current**: latest eligible row available at the server-generated audit time.
- **Closing**: final eligible provider row captured before kickoff.

Closing evidence is returned only after kickoff. It is never available to the pre-match model and post-start rows are never used to construct a pre-match closing line.

## Storage and security

Production patch:

```text
scripts/apply-market-microstructure-v2.sql
```

Verification:

```text
scripts/verify-market-microstructure-v2.sql
```

The two tables use RLS and FORCE RLS. `anon` and `authenticated` receive no direct privileges. Only server routes using `service_role` may read or write the normalized records.

## Worker

Protected route:

```text
GET /api/internal/market-microstructure
Authorization: Bearer <CRON_SECRET>
```

The scheduled GitHub workflow runs hourly. Production capture is intentionally enabled by the reviewed repository activation policy after the production storage and source-rights gates have been verified. Non-production environments remain disabled by default.

`MARKET_MICROSTRUCTURE_ENABLED` remains an explicit operational override:

```text
MARKET_MICROSTRUCTURE_ENABLED=false  # immediate emergency stop
MARKET_MICROSTRUCTURE_ENABLED=true   # explicit enable, including controlled non-production testing
```

Unknown non-empty values fail closed. The public health response exposes only the activation mode, never environment-variable values or secrets.

Optional controls:

```text
MARKET_MICROSTRUCTURE_SPORTS=soccer_epl,basketball_nba
MARKET_MICROSTRUCTURE_MARKETS=h2h
```

No more than six sports and three supported markets are requested in one run. The production default remains `h2h` to limit provider usage while opening/closing and CLV evidence accumulates.

## Public evidence

```text
GET /api/market-microstructure?eventId=<event>&market=h2h
GET /api/market-microstructure/health
```

User interface:

```text
/market-microstructure
/event/[eventId]
```

The public response contains normalized display evidence only. It does not redistribute the upstream raw feed.

## Deployment checklist

1. Merge the repository implementation.
2. Run `scripts/apply-market-microstructure-v2.sql` in Supabase SQL Editor.
3. Run `scripts/verify-market-microstructure-v2.sql` and require `ok: true`.
4. Confirm `/api/market-microstructure/health` reports repository production activation or an intentional explicit override.
5. Optionally define the sports and markets lists.
6. Run the protected scheduled workflow.
7. Check `/api/market-microstructure/health` for `healthy` or `awaiting-first-run`.
8. Confirm an event audit shows only normalized prices and no closing line before kickoff.
9. Use `MARKET_MICROSTRUCTURE_ENABLED=false` if an immediate capture stop is required.

## Limitations

- Provider price movement does not reveal betting identity, stake size or intent.
- Liquidity and limit metadata remain absent unless separately licensed.
- A sparse provider set produces missing or cautious evidence rather than a confident broad-movement label.
- Market Microstructure V2 does not promote a selection to PLAY and does not alter the independent probability model.
