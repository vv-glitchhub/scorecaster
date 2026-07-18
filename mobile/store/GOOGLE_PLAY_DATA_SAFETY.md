# Google Play data safety draft

This document is a repository checklist, not a substitute for completing the Google Play Console form. Confirm production behavior before submission.

## Data collected

### Email address

- Purpose: account authentication, confirmation and account recovery
- Linked to identity: yes
- Shared with third parties: processed by the configured authentication provider
- Required: yes for the current account model
- User deletion: included in in-app account deletion

### User ID

- Purpose: isolate cloud rows and authorize protected APIs
- Linked to identity: yes
- Shared with third parties: processed by the configured backend provider
- User deletion: deleted with the account

### App activity and user content

Includes virtual bankroll settings, paper selections, bounded model-audit snapshots, Watchlist rows, Alert Inbox rows and preferences, result history, language preference and app settings.

- Purpose: core app functionality, cross-device sync, risk calculations, verified alerts and user-facing analytics
- Linked to identity: yes for cloud rows
- User deletion: main export, dedicated Alert Inbox export and account deletion controls are available

Alert Inbox V2 stores server-generated alert type, severity, bounded comparison details, read state, resolved state, optional dismissal timestamp and user filtering preferences. The client cannot upload arbitrary alert content.

Alert Inbox V2 does not collect a device push token, request operating-system notification permission or claim background delivery.

### Diagnostics and security events

- Purpose: abuse prevention, rate limiting, safe error handling and reliability
- Linked to identity: may use the internal user ID for protected API quotas
- Retention: only the minimum needed for security and reliability

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
- Device push tokens in Alert Inbox V2

## Encryption and transport

- Client-server traffic uses HTTPS
- Mobile sessions use Expo SecureStore
- Server-only provider keys are not included in the mobile bundle
- Supabase Row Level Security isolates paper, Watchlist, Alert Inbox and inbox-setting rows

## Tracking and advertising

- No third-party advertising SDK
- No cross-app or cross-site tracking
- No sale of user data
- iOS privacy manifest declares tracking as false

## Account deletion

The in-app Profile flow provides account deletion when server-side deletion is configured. Deletion covers authentication and user-owned Scorecaster rows, including paper tracking, Watchlist data, Alert Inbox history and preferences.

## Verification before submission

- Complete two-user isolation testing for paper, Watchlist, Alert Inbox and settings tables
- Verify the main export and Alert Inbox V2 export include only the authenticated user's data
- Verify account deletion removes all user-owned rows
- Confirm production logging contains no tokens, passwords or sensitive payloads
- Confirm the signed Android App Bundle contains only public mobile configuration
- Confirm the app does not request notification permission while V2 remains in-app only
- Reconcile this document with the final Google Play Console answers
