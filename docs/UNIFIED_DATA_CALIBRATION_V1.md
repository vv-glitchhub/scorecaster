# Unified Data Calibration V1

Unified Data Calibration converts finalized Unified Sports Data V2 history into chronology-safe rows for provider-quality research, CLV calibration and shadow-model experiments.

## API

```text
GET /api/data-layer/calibration
GET /api/data-layer/calibration?days=180&limit=500
```

The endpoint requires the Unified Data Supabase migration and historical capture worker. It returns a graceful unavailable state before activation.

## Chronology policy

A calibration row is emitted only when all of these conditions hold:

1. The event start time is in the past.
2. The closing record was finalized after the event reached its start time.
3. The closing price comes from a snapshot captured at or before start.
4. The selected feature row is the final stored pre-start snapshot.
5. A post-start snapshot is never used as a pregame feature row.
6. The outcome is not loaded or included by this dataset.

## Included fields

Each row contains:

- event, selection, sport and league
- opening odds and capture time
- closing odds and capture time
- price CLV
- final pre-start market probability
- provider count and provider disagreement
- data-family coverage
- AI-used factor count
- bounded context impact
- safety action
- missing families
- compact factor statuses
- snapshot IDs and chronology checks

## Allowed uses

- provider-quality calibration
- CLV calibration
- chronology-safe shadow-model research

## Forbidden uses

- pregame probability changes
- pregame edge changes
- pregame EV changes
- automatic PLAY upgrades
- stake changes
- real-money action

## Web visibility

`/data-layer` shows the current sample size, average price CLV, positive CLV rate and the allowed/forbidden usage boundary.

## Safety tests

Regression coverage rejects:

- a closing snapshot captured after event start
- a closing record pointing to a different final snapshot
- outcome use
- pregame closing-line leakage
- production probability changes
- automatic decision upgrades