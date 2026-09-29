# Shared Caster AI explanation integration

The authenticated Agent explanation route can use Caster AI for the existing web
and mobile explanation interface. Set server-only `CASTER_AI_URL` and
`CASTER_AI_API_KEY` after deploying an approved `scorecaster.explain` model in the
shared CasterDev service. The URL is the gateway origin without `/v1`.

The service receives the already sanitized, server-signed decision contract after
the existing origin, authentication, ticket, evidence-seal and rate-limit checks.
It cannot change the deterministic decision, numbers, allocation or source evidence.
The application independently validates the returned indexes and qualitative prose.
Evidence text is always selected from the original signed arrays.

The SDK is vendored unchanged from `CasterDev/sdk/caster-ai-client.mjs` so this public
application does not require access to a private package registry during builds.
Update both copies together when changing the shared protocol.

If neither setting exists, existing provider behavior continues. A partial
configuration, unavailable service, invalid provenance or failed grounding check
uses the current deterministic fallback. There is no automatic second provider call.
Service tokens stay on the server and are never `NEXT_PUBLIC_` or mobile settings.

This change is an integration, not evidence that a model has been trained, approved
or deployed. Production activation depends on the companion CasterDev service and
independent review. It changes a provider boundary and is YELLOW under CasterDev's
autonomy policy.

Verified locally: integration and signed-decision tests, API security, autonomous
agent and ready-app regressions, repository security scan and production build.
The integration tests use a mocked gateway, not fabricated live model evidence.

```bash
npm run test:agent-v10
npm run test:agent-ticket
npm run test:security
npm run build
```
