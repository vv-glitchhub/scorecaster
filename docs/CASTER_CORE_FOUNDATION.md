# Caster Core Foundation

Scorecaster is the first working Caster app and should become the model for the rest of the ecosystem.

## Principle

Do not rebuild the same infrastructure four times.

Build common services once, then let each app use its own engine.

```text
Caster Core
  shared account
  shared database
  shared AI agent
  shared dashboard
  shared settings
  shared notifications
  shared analytics

Apps
  Scorecaster Engine
  Stockcaster Engine
  Carcaster Engine
  Travelcaster Engine
```

## Why Scorecaster first

Scorecaster already has:

- dashboard
- quick use page
- risk rules
- bet slip foundation
- tracking direction
- analytics direction
- agent direction
- Supabase schema draft

This makes it the best first app to turn into a production-ready base.

## Shared services to extract

### User and profile

- login
- profile
- preferences
- plan / subscription status

### Storage

- user records
- app records
- events
- notes
- saved items
- audit trail

### AI agent

- explain result
- summarize state
- recommend next action
- warn about risk
- generate user-facing messages

### Local first mode

- localStorage quick use
- backup export
- restore import
- later sync to Supabase

### Notifications

- app alerts
- watchlist alerts
- reminders
- daily brief

### Analytics

- saved activity
- performance
- risk signals
- usage metrics

## App-specific engines

### Scorecaster

- odds
- edge
- EV
- confidence
- bankroll
- CLV

### Stockcaster

- portfolio
- P/L
- allocation
- watchlist
- market brief
- risk label

### Carcaster

- car profile
- fault code
- symptom
- maintenance
- cost
- repair message

### Travelcaster

- trip profile
- itinerary
- budget
- packing
- places
- route notes

## Build order

1. Make Scorecaster fully usable locally.
2. Connect Scorecaster to Supabase.
3. Extract shared auth, storage and AI patterns.
4. Apply the same pattern to Stockcaster.
5. Apply the same pattern to Carcaster and Travelcaster.
6. Use Caster-hub as the central launcher and account dashboard.

## Immediate next task

Build a shared Caster Core contract in code:

- app registry
- event model
- local backup model
- sync status model
- agent action model

Then every app can report the same type of state to Caster-hub.
