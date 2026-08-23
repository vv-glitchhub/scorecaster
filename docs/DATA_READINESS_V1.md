# Scorecaster Data Readiness V1

Data Readiness V1 combines four previously separate operational questions without weakening Scorecaster's paper-only or source-rights boundaries:

1. Is Market Capture producing recent normalized price snapshots?
2. Which football target markets are provider-capable and which require a new licensed source?
3. Is Verified Live Monitor backed by an explicitly approved live-data contract?
4. Has Shadow Learning collected enough settled and closing-line evidence for human review?

## Public surfaces

- `/data-readiness` is the human-readable dashboard.
- `/api/data-readiness` returns an aggregate, secret-free audit response.
- `/market-universe` shows the procurement bundle and priority for every provider-gap market.
- `/live-monitor` shows the exact fail-closed contract gates that remain open.

The public API returns no user IDs, personal rows, API keys, raw provider payloads or contract references.

## Provider acquisition bundles

The 14 football gaps are assigned to four bounded commercial work packages:

- P1 goal-event and timing markets;
- P2 result and total combinations;
- P2 BTTS and total combinations;
- P3 special outcomes.

Every bundle requires a machine-readable catalogue, example payloads, exact settlement rules, written display and derived-analysis rights, retention terms and attribution requirements. Provider onboarding runs in shadow ingestion before public display. Synthetic prices and undocumented endpoints remain prohibited.

## Verified Live Monitor contract gate

`liveMonitorProviderConfiguration()` now requires all of the following before production collection is allowed:

- configured HTTPS endpoint;
- enabled and production-approved registry source;
- explicit commercial, live-data and display rights;
- a contract reference on file;
- a defined retention period;
- valid attribution configuration when required;
- an approved authentication mode;
- an enabled worker.

The relevant server-only environment controls are:

- `LIVE_MONITOR_LIVE_DATA_ALLOWED`
- `LIVE_MONITOR_DISPLAY_ALLOWED`
- `LIVE_MONITOR_CONTRACT_REFERENCE`
- `LIVE_MONITOR_RETENTION_DAYS`
- `LIVE_MONITOR_AUTH_MODE` (`bearer`, `ip_allowlist` or `none`)

The contract reference is never returned by public APIs. Missing gates block the provider instead of silently degrading to fabricated data.

## Shadow Learning evidence

The readiness dashboard measures progress against the existing research thresholds:

- 300 settled paper observations;
- 100 eligible closing-line/CLV observations.

Meeting the counts does not promote a model. Chronological holdout, drift, CLV and risk gates still apply, and a separate human release decision remains mandatory.

## Safety invariants

- paper-only;
- no real-money execution;
- no automatic model promotion;
- no synthetic market or live data;
- no raw-provider redistribution;
- no personal data in the public readiness response.
