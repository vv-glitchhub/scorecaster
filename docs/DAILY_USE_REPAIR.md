# Daily use repair

The daily user path is now Today → Matches → Event analysis → Watchlist / paper tracking.

- The directory view lists every available, verified fixture in the selected leagues and seven-day window. It does not create recommendations or run model enrichment. The analyzed view remains a clearly identified, bounded sample.
- Event detail and single-event audited saves request the actual event before ranking, so an event outside the old top 24/36 can still be reviewed and saved.
- Empty provider results and provider outages are distinct. Partial batches retain successful results and disclose gaps. All-provider failure returns 503.
- Research panels mount on expansion. Primary data requests cancel obsolete requests, have deadlines, and never reuse a failed refresh as a current recommendation.
- Login preserves an internal return URL, supports localized errors and password recovery. The password change page requires a verified Supabase user. Recovery email delivery still depends on the configured Supabase email service and redirect allowlist.
- Cloud history failures preserve the previous view and disable editing. Only a 401 selects local history. Closing odds are explicitly saved, accepting a decimal comma. A local result and its closing odds are saved together.
- Missing current market consensus remains null. Stale-only providers cannot create a zero price, apparent probability drop or movement alert.

No model thresholds, evidence requirements, user isolation, provider rights or real-money restrictions were loosened.

Validation: deterministic request, routing, directory, partial-provider, redirect, local storage and stale-market regressions run in Scorecaster CI with the existing event, paper-flow, security and build gates. The initial local production build passed. The workspace disconnected during subsequent testing; the final branch is verified by CI. No real user password was changed and no password-recovery email was sent during verification.
