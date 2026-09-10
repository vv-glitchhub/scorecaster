# External release gates

The following gates require evidence outside repository code before they can be closed:

- Supabase Auth leaked-password protection enabled and advisor warning cleared.
- Password-reset flow verified through a real email link and test account.
- Mobile push registration, delivery and receipt verified on a real device before enabling the worker.
- Lineup provider either configured under governed provenance rules or deliberately kept unavailable.
- Liiga primary odds capability re-verified before re-entering default background scans.
- Full test-account paper journey completed end to end.

Code-only automation must not mark these gates complete.
