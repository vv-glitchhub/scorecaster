# Google Play data safety draft

This document is a repository checklist, not a substitute for completing the Google Play Console form. Confirm production behavior before submission.

## Data collected

### Email address

- Purpose: account authentication, confirmation and account recovery
- Linked to identity: yes
- Shared with third parties: Supabase Auth processes it as the authentication provider
- Required: yes for the current account model
- User deletion: included in in-app account deletion

### User ID

- Purpose: isolate the user's cloud rows and authorize protected APIs
- Linked to identity: yes
- Shared with third parties: processed by Supabase as the backend provider
- User deletion: deleted with the account

### App activity and user content

Includes virtual bankroll settings, paper selections, watchlist items, result history, language preference and app settings.

- Purpose: core app functionality, cross-device sync, risk calculations and analytics shown to the user
- Linked to identity: yes for cloud rows
- Shared with third parties: stored and processed by the configured Supabase project; bounded Agent explanation input may be sent to the configured language-model provider only after the user requests an explanation
- User deletion: export and deletion controls are available in the app

### Diagnostics and security events

- Purpose: abuse prevention, rate limiting, safe error handling and service reliability
- Linked to identity: may be linked to the internal user ID when required for protected API quotas
- Retention: keep only the minimum needed for security and reliability

## Data not collected by the Scorecaster product flow

- Payment-card numbers
- Bank-account details
- Deposits or withdrawals
- Real-money balances
- Bookmaker credentials
- Government identifiers
- Identity documents
- Precise location
- Contacts
- Photos, camera or microphone recordings
- Advertising identifiers

## Encryption and transport

- Client-server traffic uses HTTPS
- Mobile sessions are stored using Expo SecureStore
- Server-only provider keys are not included in the mobile bundle
- Supabase Row Level Security isolates user-owned rows

## Tracking and advertising

- No third-party advertising SDK
- No cross-app or cross-site tracking
- No sale of user data
- iOS privacy manifest declares tracking as false

## Account deletion

The in-app Profile flow provides account deletion when the server-side deletion integration is configured. Deletion covers the authentication account and user-owned Scorecaster rows, including paper tracking and watchlist data.

## Verification before submission

- Complete the two-user isolation test from issue #9
- Verify export includes only the authenticated user's data
- Verify account deletion removes all user-owned rows
- Confirm production logging contains no tokens, passwords or sensitive payloads
- Confirm the signed Android App Bundle contains only public mobile configuration
- Reconcile this document with the final Google Play Console answers
