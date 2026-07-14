# Store data-disclosure draft

This document is an implementation-based draft for App Store privacy labels and Google Play Data safety. Re-check it against the final signed binary, enabled analytics, production logs and current store questionnaires before submission.

## Data collected by the current product

### Account information

- Email address
- Supabase user identifier
- Optional display name when enabled

Purpose: account creation, authentication, synchronization, export and deletion.

### User content / app activity

- Virtual paper bankroll settings
- Paper picks and their status
- Virtual stake values
- Model and market fields saved with a paper pick
- Closing odds, CLV, paper profit and timestamps

Purpose: provide paper tracking, risk controls, history and account synchronization.

These values are simulations. They are not deposits, withdrawals, bank balances, payment transactions or verified real-world gambling activity.

### Security and operational data

- Authentication/session metadata managed by Supabase
- Minimal rate-limit counters containing user ID, bucket, count and timestamps
- Request identifiers and technical errors that must not contain access tokens, passwords or full user content

Purpose: security, fraud/abuse prevention, reliability and troubleshooting.

## Data not collected by the current product

- Payment-card data
- Bank-account data
- Deposits or withdrawals
- Government identifiers
- Bookmaker usernames or passwords
- Contacts
- Photos or videos
- Camera or microphone recordings
- Precise or approximate location
- Health information
- Advertising identifiers
- Cross-app tracking data

## Sharing

The product does not sell user data and does not share data for advertising or cross-app tracking.

Supabase and hosting/infrastructure providers process data only to operate the service under their applicable terms and data-processing arrangements. Confirm the final production vendor list in the public privacy policy before submission.

## Security declarations

- Data is transmitted over HTTPS/TLS.
- Mobile authentication sessions are stored with Expo SecureStore.
- User cloud rows are protected by Supabase authentication and Row Level Security.
- Server-only credentials are excluded from browser and mobile bundles.
- Users can export their data.
- Users can permanently delete their account in the app when the production deletion service is configured.

## App Store privacy-label mapping draft

Likely categories:

- Contact Info → Email Address → App Functionality
- Identifiers → User ID → App Functionality, Security
- User Content or Other Data → paper-pick records and settings → App Functionality
- Usage Data / Product Interaction only if production telemetry is later added
- Diagnostics only if a crash-reporting SDK is later added

Not used for tracking. Not linked to third-party advertising.

## Google Play Data safety mapping draft

Likely collected data:

- Personal info → Email address
- App activity → Other user-generated content / app interactions, depending on the questionnaire wording
- Device or other identifiers → authenticated account identifier where required by the questionnaire

Purposes:

- App functionality
- Account management
- Security, fraud prevention and compliance

Data deletion request: available inside the application.

## Mandatory re-check before submission

- Verify no analytics or crash SDK was added without updating this file.
- Verify production server logs do not retain full email addresses, bearer tokens or paper-pick payloads unnecessarily.
- Verify the Supabase retention and backup configuration.
- Verify the controller identity and support contact in the public privacy policy.
- Verify the store answers against the actual signed iOS and Android binaries.
