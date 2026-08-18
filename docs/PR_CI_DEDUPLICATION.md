# Pull-request workflow deduplication

Scorecaster runs a broad regression matrix on pull requests while production Collector and Unified Data workers also use GitHub Actions schedules. Repeated commits to one PR can otherwise leave multiple generations of the same PR workflow queued or running at once.

`Scorecaster PR Run Deduplicator` is intentionally narrow:

- it runs only for same-repository pull requests targeting `main`;
- it queries only GitHub Actions runs whose event is `pull_request` and whose head branch is the current PR branch;
- it cancels only queued or active runs from an older head SHA;
- it never queries or cancels `schedule` or `push` runs;
- it has `actions: write` only for cancellation and `contents: read` for the boundary regression;
- scheduled production workflows such as Collector, Unified Data Capture and Notification Delivery are outside its query.

The cancellation job is gated by `scripts/pr-run-deduplicator.test.mjs`. This boundary must remain fail-closed: if the reviewed static contract changes unexpectedly, stale-run cancellation does not execute.

This optimization changes CI resource use only. It does not change Scorecaster model probabilities, paper decisions, worker credentials or the product's paper-only boundary.
