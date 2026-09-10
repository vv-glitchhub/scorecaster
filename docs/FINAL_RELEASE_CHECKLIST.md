# Final External Release Checklist

This checklist tracks the few release items that require provider/account/device actions rather than code-only completion.

- [ ] Enable Supabase leaked-password protection when the project plan supports it; rerun the security advisor and confirm the warning is cleared.
- [ ] Run a real test-account password-reset flow from email link through the new password screen and back to the intended Scorecaster route.
- [ ] Register a real iOS/Android test device for notifications, configure the Expo access token, verify delivery and receipt handling, then enable exactly one protected production scheduler.
- [ ] Decide whether to configure a governed lineup provider. Until then, keep lineup evidence explicitly unavailable and downgrade-only.
- [ ] Recheck The Odds API `/sports` capability for `icehockey_finland_liiga`; restore it to default market scans only when support is verified, or add a governed replacement primary source.
- [ ] Complete one end-to-end test-account journey: sign in → browse Events → open verified Event Detail → add Watchlist → save paper bet → settle result → inspect Tracking/Analytics → export/delete test account.

These items must not weaken paper-only boundaries, risk controls, RLS/user isolation, model-promotion governance, or evidence provenance.
