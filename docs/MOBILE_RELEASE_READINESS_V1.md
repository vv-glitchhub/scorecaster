# Mobile Release Readiness V1

## Purpose

This sprint prepares the Expo iOS and Android application for signed internal testing without claiming that external developer accounts, credentials, production cloud verification or store review are complete.

## Repository-owned release controls

The mobile project now includes:

- matching `0.2.0` app and package versions
- remote EAS developer-facing version management
- automatic production build-number increments
- internal Android APK preview profile
- Android App Bundle production profile
- Google Play internal draft submission profile
- Apple EAS Metadata path
- Finnish, English and Spanish Apple metadata
- Finnish, English and Spanish Google Play listing drafts
- iOS tracking-disabled privacy manifest configuration
- native email-confirmation callback at `scorecaster://auth/confirm`
- deterministic release audit in mobile CI
- reviewer notes, data-safety draft and screenshot/device test plan
- explicit external release blockers

## Authentication callback

Email sign-up sets this redirect URL:

```text
scorecaster://auth/confirm
```

The app processes both cold-start and foreground links. It exchanges a PKCE authorization code for a session and supports the token callback format as a fallback. Supabase Auth must allow this redirect pattern before device testing:

```text
scorecaster://**
```

No session token is placed in source control. Persisted sessions continue to use Expo SecureStore.

## Release audit

Run from `mobile/`:

```bash
npm run release:audit
```

The audit fails when:

- app and package versions differ
- bundle identifiers or scheme change unexpectedly
- EAS internal/production profiles become unsafe
- FI/EN/ES store metadata is missing or exceeds key limits
- policy URLs are not HTTPS
- native email confirmation loses its redirect or callback handler
- server-only key names appear in mobile source or store configuration
- the product boundary enables real-money betting

The audit reports warnings, but does not fabricate values, for:

- missing EAS project ID
- missing approved app icon
- missing approved splash asset

## Store metadata

Apple metadata is stored in:

```text
mobile/store.config.json
```

Google Play metadata is stored as a validated repository draft in:

```text
mobile/store/google-play-listing.json
```

EAS Metadata currently manages Apple metadata only. Google Play listing text must be entered or synchronized through Google Play Console using the approved draft.

## Internal delivery commands

After the correct EAS project, accounts and protected credentials are configured:

```bash
cd mobile
npm run release:check
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

The Android submission profile targets the internal track and keeps the release in draft status. iOS submission uploads the binary to App Store Connect/TestFlight; it does not publish the app publicly.

## External blockers

The source of truth is:

```text
mobile/store/release-blockers.json
```

Public submission remains blocked until all required evidence exists, including:

- Apple Developer and Google Play access
- correct EAS project link and signing credentials
- issue #9 production cloud and two-user isolation tests
- signed-device auth callback test
- synthetic reviewer account stored only in store dashboards
- final legal controller and support contact
- approved icon, splash and localized screenshots
- FI/EN/ES VoiceOver and TalkBack device testing
- external security review with critical/high findings resolved

## Product boundary

The release package must continue to state and enforce:

- no deposits or withdrawals
- no payment-card or bank data
- no bookmaker credentials
- no real-money balance
- no bet execution or bookmaker redirect
- no guaranteed-profit claim

All stake and bankroll values remain virtual paper-tracking numbers.
