# Scorecaster reviewer notes

## Product boundary

Scorecaster is a sports-analysis, risk-control and virtual paper-tracking application.

- No deposits or withdrawals
- No payment-card or bank-account collection
- No bookmaker credentials or account connection
- No real-money balance
- No real-money bet placement
- No bookmaker redirect or affiliate link
- No guaranteed-win claim

Every bankroll and stake shown in the app is a virtual number used only for paper tracking.

## Review account

Create a dedicated, pre-confirmed review account in the production Supabase project. Enter the credentials only in App Store Connect and Google Play Console. Never commit the password or account token to this repository.

The review account should contain:

- a small virtual bankroll
- at least one open paper selection
- at least one settled paper selection
- one watchlist item when a verified live fixture is available
- no real personal information

## Main review flow

1. Sign in with the dedicated review account.
2. Open **Picks** to view near-term live-provider fixtures and market-consensus analysis.
3. Open **AI** to inspect stress tests, counterarguments, verified sports context and a virtual paper allocation.
4. Open **Watch** to inspect server-verified price and decision changes.
5. Open **Paper** to view virtual tracking and settlement controls.
6. Open **Data** to view ROI, CLV and probability-calibration metrics.
7. Open **Profile** to change language, export account data and access account deletion.

## Authentication and deep links

Email confirmation returns to:

```text
scorecaster://auth/confirm
```

Add the following allowed redirect pattern in Supabase Auth before signed-device testing:

```text
scorecaster://**
```

## Language review

The application supports Finnish, English and Spanish. Changing the language affects interface copy and Agent explanations but does not alter the signed decision metrics.

## Network behavior

The app requires a network connection for authentication, current market data, cloud paper tracking and watchlist refreshes. Missing provider data is displayed as unavailable; the app does not invent replacement injuries, lineups, news or prices.

## Support and policies

- Support: https://scorecaster.vercel.app/help
- Privacy: https://scorecaster.vercel.app/privacy
- Terms: https://scorecaster.vercel.app/terms
- Responsible use: https://scorecaster.vercel.app/responsible-use
- Security: https://scorecaster.vercel.app/security

## Items supplied outside the repository

The following must be entered in the store dashboards or protected credential services:

- review account credentials
- final legal controller identity
- final support contact
- Apple Developer and App Store Connect identifiers
- Google Play service account credentials
- EAS project ID and signing credentials
