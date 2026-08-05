# Scorecaster Source Registry V1

Source Registry V1 is the canonical public record of where Scorecaster data comes from, what rights have been verified and which normalized fields may be displayed.

## Public surfaces

- Human-readable registry: `/sources`
- Public JSON registry: `/api/sources`
- Decision-level formulas and used-source evidence: `/transparency`

No sign-in is required for the public registry. The API supports CORS `*` for read-only GET requests.

## Required metadata

Every registered source has:

- stable source ID and display name
- source type and operating status
- sports or leagues covered
- licence and terms reference
- commercial-use decision
- redistribution decision
- model-training decision
- required attribution wording
- expected update cadence
- freshness threshold
- retention period
- allowed normalized public fields
- restricted server-only fields
- outage and stale-data behaviour

## Field firewall

The registry is fail-closed.

A public record is rejected when:

- the source ID is unknown
- the source is research-only or disabled
- commercial display rights are not confirmed
- the requested field is not listed as public
- a restricted field is requested

No API key, authorization header, cookie, account identifier, personal data, request URL or raw provider payload is public.

Normalized event, market and model values may be public only when their source registry entry explicitly allows the field. A source may permit use in a user-facing Scorecaster application while still prohibiting redistribution as a standalone raw-data service.

## The Odds API boundary

The Odds API is registered as a production market-data source when `ODDS_API_KEY` exists on the server.

Scorecaster may display normalized prices and derived market comparisons in its user interface. It does not publish:

- the API key
- raw provider responses
- provider quota headers
- an unrestricted downloadable bookmaker feed
- a proxy endpoint that reproduces the provider service

Attribution is `Market odds: The Odds API`. The registry links to the provider's official terms.

## Research sources

StatsBomb Open Data and MoneyPuck research entries remain research-only and disabled in production by default. Their existence in the registry is not production approval.

Research-only records cannot be published through the source-governance firewall. Written rights and a reviewed registry change are required before production activation.

## Freshness

Every source has a freshness threshold in minutes.

- `fresh`: age is at or below the threshold
- `aging`: age is above the threshold but no more than twice the threshold
- `stale`: age is more than twice the threshold
- `unknown`: no valid observation time exists

Stale or unknown data must be labelled and may downgrade or block a decision. It may not be silently replaced with an invented AI value.

## Adding a source

1. Add the source to `lib/collector-source-registry.mjs` or configure the governed JSON adapter.
2. Record rights, attribution, freshness, retention, public fields and restricted fields.
3. Add tests covering production, research and missing-rights states.
4. Verify `/api/sources` contains no secret or server endpoint.
5. Run Source Registry CI and the complete Scorecaster CI.
6. Review the source in production evidence before enabling it for decisions.

## Safety boundary

Source Registry V1 does not place bets, connect bookmaker accounts, transfer money or change model probabilities. It governs provenance, publication and evidence quality for Scorecaster's paper-only intelligence product.
