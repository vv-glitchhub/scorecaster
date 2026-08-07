# Scorecaster Mobile Release Evidence V2

## Purpose

This package prepares issue #97 / #12 for signed iOS and Android internal testing without pretending that Apple Developer, Google Play, Expo EAS, physical devices, production isolation or external security review have already been completed.

Repository CI may prove code-owned configuration and evidence tooling. It must not mark a signed build, store account, physical-device test or push-notification delivery as passed unless that evidence actually exists.

## Repository-owned controls

The mobile release package now contains:

- deterministic Expo/EAS/store metadata audit
- FI / EN / ES Apple and Google Play metadata drafts
- reviewer instructions with no credentials in GitHub
- six-cell physical-device matrix: iOS + Android × FI / EN / ES
- required authentication, paper tracking, export, deletion, notification and accessibility flows
- signed IPA/APK/AAB secret-boundary scanner
- machine-readable mobile release evidence aggregator
- CI that uploads redacted repository evidence

## 1. Repository audit

From `mobile/`:

```bash
npm ci
npm run release:audit
npm run test:release-evidence
npm run check:expo
npm run typecheck
```

Warnings about the EAS project ID, final icon/splash, store accounts or physical-device evidence are not converted into fake passes.

## 2. Link EAS only with the approved Expo account

Do not commit access tokens, signing credentials or account passwords.

After Apple/Google account ownership is confirmed:

```bash
cd mobile
eas login
eas init
```

Verify that the generated EAS project ID belongs to the correct Scorecaster project before committing the public project ID to Expo configuration. Authentication credentials remain in EAS/Apple/Google protected systems.

## 3. Produce signed internal-test builds

Run the repository gate first, then request signed production binaries:

```bash
cd mobile
npm run release:check
eas build --platform ios --profile production
eas build --platform android --profile production
```

The iOS production build is the binary intended for App Store Connect/TestFlight. Android production creates an App Bundle intended for the Google Play internal track. An Android preview APK may also be built for direct device installation:

```bash
eas build --platform android --profile preview
```

Do not submit publicly from this step.

## 4. Audit the actual signed bundles

Download the completed IPA and AAB/APK from the controlled EAS build result. Then run:

```bash
npm run release:signed-bundle-audit -- \
  --artifact /path/to/scorecaster.ipa \
  --artifact /path/to/scorecaster.aab \
  --require-artifact
```

The audit writes `mobile/artifacts/signed-bundle-audit.json` and checks likely JavaScript/configuration entries inside the signed archives for:

- server-only environment-variable names
- forbidden `EXPO_PUBLIC_` / `NEXT_PUBLIC_` aliases of server-only variables
- OpenAI-style secret values
- Supabase secret-key patterns
- embedded private-key blocks

The report contains no matched secret snippets or credential values. A failure blocks release and requires credential rotation if real exposure is suspected.

A clean bundle scan does not prove runtime authorization, store signing-chain validity, network behavior or physical-device correctness. Those remain separate gates.

## 5. Physical-device matrix

The source of truth is:

```text
mobile/store/physical-device-test-matrix.json
```

There are six required cells:

- iOS / Finnish / VoiceOver
- iOS / English / VoiceOver
- iOS / Spanish / VoiceOver
- Android / Finnish / TalkBack
- Android / English / TalkBack
- Android / Spanish / TalkBack

Each cell remains `pending` until a signed build is installed through the intended internal-test path and all required flows are executed.

Required critical flows include:

- cold launch
- sign in
- email-confirmation deep link
- language change + restart persistence
- Today/Picks
- Agent explanation language
- virtual paper save
- settlement refresh
- watchlist / notification deep link
- data export
- sign-out / sign-in
- deletion on a disposable synthetic account
- expired-session fail-closed behavior
- emergency-stop visibility

Required accessibility evidence includes screen-reader navigation, font scaling, small-screen layout, focus order, accessible control labels and long localized labels.

Required notification evidence includes foreground, background, cold-start deep-link and notifications-disabled behavior.

### Evidence hygiene

Never place any of these in the matrix, screenshots, GitHub issues or release artifacts:

- passwords
- access/refresh tokens
- cookies
- Expo push tokens
- persistent device identifiers
- unrelated personal data

Screenshots should use synthetic test data only.

## 6. Reviewer account and reviewer instructions

Repository reviewer instructions live in:

```text
mobile/store/reviewer-instructions.json
```

The synthetic reviewer account must be pre-confirmed, but its email/password credentials must be entered only in App Store Connect / Google Play Console review fields. They must never be committed to GitHub or exported into the mobile release JSON.

## 7. Aggregate release evidence

Repository/CI evidence can be generated with:

```bash
node scripts/mobile-release-evidence.mjs --repository-audit-passed
```

The result is:

```text
mobile/artifacts/mobile-release-evidence.json
```

Until the external gates are complete, the expected state is:

```text
repository-ready-external-evidence-required
```

For the final internal-beta gate only, use:

```bash
node scripts/mobile-release-evidence.mjs --repository-audit-passed --require-complete
```

That command must fail unless all of the following are true:

- repository release audit passed
- correct EAS project is linked
- signed iOS bundle audit passed
- signed Android bundle audit passed
- all six physical-device cells are complete
- required external blockers are explicitly completed

## 8. Store delivery

Only after the production P0 security/isolation gates and mobile evidence are retained:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Android targets the internal track and remains draft by repository configuration. iOS upload is for App Store Connect/TestFlight. Neither command is authorization for a public production release.

## 9. Release blockers

The repository blocker registry remains:

```text
mobile/store/release-blockers.json
```

At minimum, public release remains blocked by any unresolved requirement involving:

- Apple Developer membership / App Store Connect
- Google Play Console
- EAS project ownership and signing credentials
- production cloud isolation and hard-cap evidence (#92/#93/#9)
- signed-device auth callback
- synthetic reviewer account
- final legal controller and support contact
- approved icon, splash and localized screenshots
- FI/EN/ES physical accessibility tests
- external security review

## Product boundary

All release evidence must remain consistent with the permanent Scorecaster boundary:

- sports analysis and decision support
- virtual paper bankroll and stake values only
- no bookmaker login
- no deposits or withdrawals
- no payment-card or bank data
- no Cash Out
- no real-money bet execution
- no guaranteed-profit claim
- no automatic model promotion
