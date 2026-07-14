# Scorecaster Mobile

Native Expo application for iOS and Android.

## Product boundary

Scorecaster Mobile provides sports analysis, paper bets, risk controls, AI explanations and result tracking. It does not accept deposits, withdraw money, connect to betting accounts, store payment information or place real-money bets.

## Mobile MVP

The current application includes:

- email account creation and sign-in
- secure session persistence in Expo SecureStore
- NHL, NBA, EPL, La Liga, Liiga and SHL filters
- cached Top 3 and broader daily pick list
- PLAY / CAUTION / SKIP decisions and trust score
- editable virtual bankroll and paper-risk percentages
- paper stakes limited by the configured virtual bankroll
- cloud paper-bet history
- server-calculated win/loss/void settlement
- closing odds, CLV, total paper profit and ROI
- JSON account-data export through the device share sheet
- in-app permanent account deletion
- privacy, terms, responsible-use and security links

## Security boundary

Only these public values may be embedded in the app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SCORECASTER_API_URL`

Never place a service-role key, Odds API key, OpenAI key, payment secret or bookmaker credential in this directory. Auth sessions use chunked Expo SecureStore storage. User-data API calls send a short-lived Supabase access token over HTTPS and are revalidated by the Scorecaster server.

Paper-risk limits are not trusted to the mobile UI alone. The protected API validates the single-paper-stake limit and PostgreSQL triggers enforce both the single-stake limit and total open paper exposure.

## Local setup

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --check
npm run typecheck
npm run start
```

The server must have Supabase configured and all migrations in `../supabase` applied in the documented order.

## Test builds

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Use TestFlight and Google Play internal testing before any public release.

## Production prerequisites

- Supabase Auth, RLS, API quotas and paper-risk triggers activated
- two-user isolation and quota tests passed
- `SUPABASE_SERVICE_ROLE_KEY` configured only on the server for account deletion
- privacy policy, terms and support URLs published
- app icon, splash image and store screenshots added
- EAS project linked
- Apple and Google developer accounts connected
- real-device login, export, deletion and expired-session tests completed
- external security review completed
