# Scorecaster Agent V10 grounded explanations

## Purpose

Agent V10 adds an optional natural-language explanation layer on top of the immutable Agent V9 decision object.

The language model is not the betting model. It cannot change:

- PLAY / WATCH / SKIP
- no-vig consensus probability
- stress range
- edge or expected value
- price guard
- virtual paper stake
- event, league or total portfolio allocation

The deterministic Agent V9 engine remains the source of truth.

## Data flow

```text
Agent V9 deterministic decision
  -> bounded Agent V10 decision contract
  -> authenticated and rate-limited server endpoint
  -> optional language-model structured output
  -> grounding validator
  -> UI explanation
```

When authentication, provider configuration, rate limiting or generated-output validation fails, Scorecaster returns a deterministic local explanation instead.

## Minimal decision contract

The server accepts only a whitelisted object containing:

- decision, match, selection and league labels
- bookmaker label
- odds and calculated probability metrics
- trust, confidence, robustness and coverage values
- price and virtual portfolio limits
- fixed evidence, counterarguments and missing-evidence labels
- a bounded learning note and sample size

The sanitizer drops unknown fields. It does not forward:

- user email, name or account ID
- authentication tokens
- payment information
- bookmaker credentials
- unrestricted user-written text
- full paper history
- provider API keys

## Provider controls

The optional provider request:

- uses the Responses API
- uses strict JSON Schema structured output
- sets `store: false`
- has a bounded output-token limit
- has an upstream timeout
- has no web search, file search, functions or other tools
- is available only after verified authentication
- is limited per authenticated user through the database quota layer

The configurable server model is `OPENAI_AGENT_MODEL`; the default is `gpt-5-mini`.

## Output contract

The language model may return only:

- a concise qualitative summary
- the strongest supplied reason
- a serious supplied counterpoint
- one to four verification steps
- a paper-only limitation statement

Generated output may not contain digits. This prevents the explanation from inventing, rounding or changing probabilities, odds, stakes, dates or sample counts. The deterministic UI remains responsible for every number.

The validator also rejects certainty and execution language such as guaranteed wins, risk-free claims or instructions to place a real-money bet.

## Deterministic fallback

The fallback explanation is built from the same sanitized contract and requires no external provider. It is used when:

- the user is not authenticated
- the optional provider key is not configured
- the quota is unavailable or exceeded
- the provider times out or returns an error
- structured output is missing or malformed
- grounding validation fails

The fallback never blocks access to the deterministic Agent decision.

## Client cache

The web Agent stores the completed explanation in browser local storage for a limited period. The cache key is derived from the decision inputs, not from user identity.

The cache:

- reduces repeated provider calls
- is optional
- contains no authentication secret
- expires automatically
- is replaced when material decision inputs change

## Privacy and logging

The endpoint does not log the decision contract or generated explanation. Responses include a short deterministic decision hash for audit matching without exposing the full payload.

Provider response storage is disabled in the request. The privacy policy discloses the optional processing and must be reviewed with the final controller and processor details before public store release.

## Security boundaries

- Server-only keys never use public environment prefixes.
- Cookie mutations require exact same-origin validation.
- Mobile calls require a valid bearer session.
- Body size, text length, list count and numeric ranges are bounded.
- Provider use occurs only after authentication and quota checks.
- Generated text cannot alter the deterministic decision object.
- No real-money betting capability is introduced.

## Validation

The regression suite checks:

- unknown and personal fields are removed
- lists and numbers are bounded
- canonical decision input is stable
- fallback output remains useful
- valid qualitative structured output is accepted
- new numbers are rejected
- certainty and real-money execution language are rejected
- invalid decisions are rejected
- provider use occurs after authentication
- the provider call is rate-limited, non-persistent and tool-free

## Known limitations

- Qualitative text can still be misunderstood by a user.
- A validated explanation is not independent evidence.
- `store: false` controls response storage for the provider request but does not replace contractual privacy review.
- Local browser cache is accessible to other code running under the same browser origin.
- The explanation does not retrieve current news, lineups or injuries.
- The explanation does not improve the underlying probability model.
