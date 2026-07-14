# App Review notes

Paste the relevant parts into App Store Connect and Google Play review notes. Never commit reviewer passwords, one-time codes, access tokens or recovery links to GitHub.

## Core explanation

Scorecaster is a sports-analysis, risk-control and paper-tracking application. It does not enable real-money gambling.

The app:

- does not accept deposits or withdrawals
- does not hold a real-money balance
- does not store bank or payment-card details
- does not connect to bookmaker credentials
- does not execute bets
- does not contain Bet Now links or bookmaker affiliate redirects
- uses only virtual bankroll and paper-pick values

Odds are displayed as market data for analysis. PLAY, CAUTION and SKIP are analysis classifications, not commands to place a real-money bet.

## Suggested review path

1. Sign in using the private review account supplied only in the store console.
2. Open Picks.
3. Select NHL, NBA, EPL, La Liga, Liiga or SHL.
4. Open a pick and review probability, edge, EV, trust and risk explanation.
5. Add a non-SKIP pick using a virtual paper stake.
6. Open Paper tracking.
7. Settle the paper pick and optionally enter closing odds to see CLV.
8. Open Profile and privacy.
9. Export account data.
10. Confirm that permanent account deletion is available in the app.
11. Open Support, Privacy, Terms, Responsible use and Security.

## Review account handling

Create a dedicated review account in the production Supabase project after issue #9 is complete. Store its credentials only in App Store Connect / Google Play Console review fields or another approved secret manager.

Do not use a personal administrator account. Do not give the review account access to any data belonging to another user.

## Backend requirements during review

The following must remain available throughout review:

- Scorecaster production API
- Supabase authentication
- paper-bet and bankroll APIs
- odds and Top Picks APIs
- privacy, terms, responsible-use, security and support pages

## Contact and support URLs

- Support: https://scorecaster.vercel.app/support
- Privacy: https://scorecaster.vercel.app/privacy
- Terms: https://scorecaster.vercel.app/terms
- Responsible use: https://scorecaster.vercel.app/responsible-use
- Security: https://scorecaster.vercel.app/security

## Encryption declaration

Scorecaster uses standard HTTPS/TLS and platform-provided secure storage. It does not implement proprietary cryptography. Confirm the final iOS export-compliance answer against the signed binary and current Apple requirements before submission.
