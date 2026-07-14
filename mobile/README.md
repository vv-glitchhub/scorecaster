# Scorecaster Mobile

Native Expo application for iOS and Android.

## Product boundary

Scorecaster Mobile provides sports analysis, paper bets, risk controls, AI explanations and result tracking. It does not accept deposits, withdraw money, connect to betting accounts or place real-money bets.

## Security boundary

Only these public values may be embedded in the app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SCORECASTER_API_URL`

Never place a service-role key, Odds API key, OpenAI key, payment secret or bookmaker credential in this directory. Auth sessions use chunked Expo SecureStore storage. User-data API calls send a short-lived Supabase access token over HTTPS and are revalidated by the Scorecaster server.

## Local setup

```bash
cd mobile
cp .env.example .env
npm install
npx expo install --fix
npm run typecheck
npm run start
```

The server must have Supabase configured and the migrations in `../supabase` applied.

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

- Supabase Auth and RLS activated
- two-user isolation test passed
- `SUPABASE_SERVICE_ROLE_KEY` configured only on the server for account deletion
- privacy policy, terms and support URLs published
- app icon and store screenshots added
- EAS project linked
- Apple and Google developer accounts connected
- external security review completed
