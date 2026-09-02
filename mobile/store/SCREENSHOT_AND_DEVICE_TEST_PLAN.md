# Screenshot and real-device test plan

## Required device matrix

### iOS

- Current supported iPhone with standard text size
- Smaller iPhone screen
- Current supported iPhone with large accessibility text
- VoiceOver enabled

### Android

- Current Pixel-class phone
- Narrow Android phone
- Current supported Android with large font and display scaling
- TalkBack enabled

The repository keeps iPad support disabled until a separate tablet layout and accessibility pass is complete.

## Language matrix

Run every critical flow in:

- Finnish (`fi-FI`)
- English (`en-US`)
- Spanish (`es-ES`)

Confirm that language persists after app restart and after sign-out/sign-in. Provider names, team names and bookmaker names may remain in their source language. Application controls and current guidance must use the selected language.

## Screenshot set per platform and language

Capture the same seven scenes for iPhone and Android:

1. **Home** — product boundary, virtual bankroll and risk limits
2. **Picks** — verified near-term fixture, price, consensus, edge and freshness
3. **AI** — PLAY/WATCH/SKIP decision, stress range and verified sports-intelligence status
4. **Watchlist** — verified price or decision movement without a paper stake
5. **Paper tracking** — open and settled virtual selections
6. **Analytics** — ROI, CLV, calibration and Brier score
7. **Profile** — language, export, policy links and account deletion

Do not show:

- personal email addresses
- real user IDs
- access tokens
- API keys
- test passwords
- real bank or payment details
- bookmaker account screens
- guaranteed-profit language

## Screenshot preparation account

Use a dedicated synthetic account with:

- virtual bankroll only
- one open paper selection
- at least two settled paper selections
- one watchlist item when a current verified fixture exists
- no personal profile data

Reset or delete the synthetic account after the final capture set.

## Critical flow test protocol

1. Install a clean signed build.
2. Open the app from a cold start.
3. Create an account and open the email confirmation link.
4. Confirm the `scorecaster://auth/confirm` callback returns to the app.
5. Sign in and change language.
6. Load Picks and verify missing provider data is shown as unavailable, not invented.
7. Add a verified item to Watchlist and confirm no paper stake is created.
8. Add an allowed Agent PLAY item to paper tracking.
9. Confirm a blocked WATCH/SKIP item cannot create a paper allocation.
10. Refresh settlement for a supported completed event.
11. Export account data and inspect the file.
12. Delete the account and confirm the session is removed.
13. Repeat with VoiceOver or TalkBack.
14. Repeat the language change with large text enabled.

## Visual quality gates

- No clipped tab labels at supported font scaling
- Spanish text wraps without hiding actions
- Buttons remain at least 44 points / 48 dp high where practical
- Focus order follows the visual order
- Selected tabs and disabled actions have accessible state
- Error messages explain recovery without exposing server details
- Dark-mode contrast remains readable outdoors and at reduced brightness

## Store asset blockers

The final icon, adaptive icon and splash asset are committed from the existing Scorecaster visual identity. FI, EN and ES screenshots must still be captured from signed iOS and Android builds after production cloud isolation passes; screenshot completion must not be inferred from repository assets.
