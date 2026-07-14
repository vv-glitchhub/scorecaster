# Scorecaster mobile release checklist

Public submission is blocked until every required item is complete.

## Code and security

- [x] Paper-only product boundary encoded in the app and APIs
- [x] No payment, deposit, withdrawal or bookmaker-account integration
- [x] Mobile sessions stored with Expo SecureStore
- [x] User APIs revalidate bearer sessions on the server
- [x] Row Level Security migrations prepared
- [x] Database-backed API quotas prepared
- [x] Paper stake and total exposure limits prepared
- [x] Account export and in-app deletion implemented
- [x] Secret scan, API security tests, CodeQL and mobile TypeScript CI
- [x] Expo compatibility check
- [x] Store metadata and review-note drafts
- [x] Public support page
- [ ] External security review completed with no unresolved critical/high findings

## Supabase production activation

- [ ] Run `supabase/scorecaster_schema.sql`
- [ ] Run `supabase/scorecaster_auth_cloud.sql`
- [ ] Run `supabase/scorecaster_api_rate_limits.sql`
- [ ] Run `supabase/scorecaster_paper_risk_limits.sql`
- [ ] Enable Email + Password authentication
- [ ] Configure production Site URL and redirect URLs
- [ ] Configure server-only account deletion key
- [ ] Complete two-user RLS isolation test
- [ ] Complete quota test and verify HTTP 429 plus `Retry-After`
- [ ] Verify single-stake and total-open-exposure limits cannot be bypassed
- [ ] Verify export contains only the authenticated user's data
- [ ] Verify permanent deletion removes authentication and cloud rows

## Expo and signed builds

- [ ] Create/link the Expo EAS project
- [ ] Add `extra.eas.projectId` through EAS project linking
- [ ] Configure only public mobile environment values in EAS
- [ ] Create iOS preview build
- [ ] Create Android preview build
- [ ] Inspect signed bundles for forbidden secrets
- [ ] Test session persistence and expiration on a real iPhone
- [ ] Test session persistence and expiration on a real Android device
- [ ] Test Top Picks, bankroll, paper-pick save, settlement, CLV, export and deletion
- [ ] Test offline, timeout, invalid-session and rate-limit states

## Store accounts and assets

- [ ] Apple Developer membership active
- [ ] App Store Connect app record created
- [ ] Google Play Console account active
- [ ] Google Play app record created
- [ ] Final icon approved
- [ ] Final splash screen approved
- [ ] Real screenshots captured from signed builds
- [ ] Controller identity and support contact finalized
- [ ] Privacy policy reviewed against production vendors and retention
- [ ] App Store privacy labels completed
- [ ] Google Play Data safety completed
- [ ] Age-rating and gambling-reference questionnaires completed truthfully
- [ ] Review account created and credentials stored only in store consoles

## Submission

- [ ] Upload to TestFlight internal testing
- [ ] Upload to Google Play internal testing
- [ ] Complete tester feedback round
- [ ] Resolve crashes, security findings and blocking usability issues
- [ ] Freeze the release commit and record its SHA
- [ ] Submit iOS for review
- [ ] Submit Android for review
- [ ] Monitor review communication and keep backend services online

## Never do

- Never commit Apple, Google, Expo, Supabase service-role, Odds API or AI-provider secrets.
- Never put review-account credentials in GitHub.
- Never publish fake screenshots or claims that do not match the binary.
- Never introduce real-money betting, payment handling or bookmaker redirects without a separate legal, licensing and store-policy review.
