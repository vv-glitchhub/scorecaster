# Agent Decision Signing Key Handoff V1

Scorecaster signs short-lived Agent decision tickets with a dedicated server-only HMAC key named `AGENT_DECISION_SIGNING_KEY`. The runtime already fails closed when that key is missing or shorter than 32 characters.

This runbook makes generation, verification and future rotation reproducible without placing the secret in Git, CI logs, release artifacts or browser/mobile bundles.

## 1. Generate the key locally

Run this on a trusted local development machine, not in GitHub Actions or another shared CI environment:

```bash
npm run agent:signing-key-generate
```

The command:

- generates 48 cryptographically random bytes with Node `crypto.randomBytes`
- writes the base64url value to `.scorecaster-secrets/agent-decision-signing-key.txt`
- refuses to run when `CI=true`
- refuses to overwrite an existing key unless rotation is explicitly requested
- verifies a signed-ticket round trip and wrong-key rejection before saving
- prints only the local path, a short SHA-256 fingerprint prefix and boolean verification state
- never prints the key value

`.scorecaster-secrets/*` is ignored by Git except for its `.gitignore` marker. On POSIX filesystems the directory/file are also set to `0700` / `0600`; Windows does not rely on POSIX mode bits, so OS account/file permissions still matter.

## 2. Verify the local handoff file

```bash
node scripts/verify-agent-decision-signing-key.mjs \
  --file=.scorecaster-secrets/agent-decision-signing-key.txt \
  --require-present
```

Expected redacted result:

- `passed: true`
- `configured: true`
- `minimumLengthMet: true`
- `roundTripPassed: true`
- `wrongKeyRejected: true`
- a short `fingerprintPrefix`
- `secretValueIncluded: false`

Do not paste the key into an issue, PR, chat, CI variable dump or release-evidence JSON.

## 3. Add the value to Vercel manually

In the Scorecaster Vercel project, add the contents of the local file as the **server-only** environment variable:

`AGENT_DECISION_SIGNING_KEY`

Use the production environment. Add it to Preview only when preview Agent ticket testing is intentionally required.

Never create any `NEXT_PUBLIC_AGENT_DECISION_SIGNING_KEY`, `EXPO_PUBLIC_AGENT_DECISION_SIGNING_KEY` or other client-visible alias. `config/production-security.json` classifies the key as required server-only configuration.

The repository and CI intentionally do not write Vercel environment variables. This prevents a build job from becoming a secret-management authority.

## 4. Redeploy and verify production

After changing the Vercel environment, create a fresh production deployment. Then verify:

1. `/api/health` is running the intended `main` commit.
2. `services.agentV10DecisionSigningConfigured` is `true`.
3. `node scripts/production-security-report.mjs --require-present` passes in an approved environment that can inspect production variable presence.
4. Authenticated Agent portfolio responses can mint current signed tickets.
5. The enhanced explanation endpoint accepts a current ticket and rejects a modified/wrong-key ticket.
6. Evidence records only variable presence, ticket-test booleans and a non-secret reference/fingerprint. Never retain the key value.

Do not mark #92 production-complete solely because `/api/health` changes to `true`; the other worker, RLS, migration and release evidence requirements remain separate.

## Rotation

Generate a replacement only when rotation is intentional:

```bash
npm run agent:signing-key-generate -- --rotate
```

Then:

1. verify the new local file
2. replace the server-only Vercel value
3. redeploy production
4. verify health and signed-ticket behavior
5. retain only redacted evidence/fingerprint reference
6. remove any obsolete local backup according to your secret-management policy

Rotation intentionally invalidates tickets signed with the previous key. Agent decision tickets live for at most 30 minutes and normally 10 minutes, so plan rotation when that short interruption is acceptable.

## CI behavior

CI tests use synthetic ephemeral strings only. The generator itself refuses to run in CI, and the verification command only consumes a key when explicitly supplied by a trusted environment or local file.

## Product boundary

This key signs Scorecaster's internal paper-analysis decision contract. It does not enable bookmaker login, deposits, withdrawals, Cash Out or real-money execution, and it does not grant automatic model-promotion authority.
