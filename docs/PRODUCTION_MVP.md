# Scorecaster Production MVP

Scorecaster is the sports intelligence product inside the Caster ecosystem.

The goal is not to encourage random betting. The goal is to create a disciplined decision platform that explains odds, edge, risk, bankroll exposure and when to skip.

## Current product state

Already visible in the app:

- Dashboard
- Betting Workspace
- Agent V9
- Analytics
- Paper Trading
- Simulator
- Tracking
- Top picks
- Risk, CLV and ROI concepts

## Production MVP target

A user should be able to:

1. Open Scorecaster.
2. Choose a sport or league.
3. See ranked picks.
4. Understand why each pick exists.
5. See edge, EV, confidence, odds movement and risk warnings.
6. Add a pick to a bet slip.
7. Apply bankroll and staking limits.
8. Save or paper-track the bet.
9. View result, ROI and CLV later.
10. Receive clear responsible-use warnings.

---

## Core product pillars

### 1. Odds intelligence

- Live odds by sport and market
- Best bookmaker price
- Implied probability
- Market movement
- Opening price vs current price
- Closing line value tracking

### 2. Model intelligence

- Model probability
- Edge
- Expected value
- Confidence
- Agent V9 score
- Pick grade
- Pick explanation

### 3. Risk intelligence

- Bankroll setting
- Suggested stake
- Maximum stake cap
- Exposure per day
- Exposure per league
- Exposure per correlated picks
- No-bet / skip warnings

### 4. Tracking intelligence

- Saved bet history
- Paper trading mode
- Result status
- ROI
- Profit/loss
- CLV
- Segment performance
- Learning feedback

### 5. Responsible use

- Clear disclaimer
- Skip weak bets
- No chasing losses
- No guarantees
- Encourage bankroll limits
- Strong warnings when confidence is low or exposure is high

---

## MVP pages

| Page | Purpose |
| --- | --- |
| `/` | Command center |
| `/betting` | Main odds and bet slip workspace |
| `/analytics` | ROI, CLV and performance |
| `/tracking` | Saved bets and results |
| `/paper-trading` | Simulated bankroll and exposure |
| `/simulator` | Match simulation |
| `/agent-v7` | Agent dashboard / V9 intelligence layer |
| `/risk` | Recommended next page: bankroll, exposure and responsible controls |
| `/daily-top-3` | Recommended next page: daily curated picks |

---

## Recommended database tables

- `profiles`
- `bankroll_settings`
- `bet_slips`
- `bet_slip_items`
- `tracked_bets`
- `odds_snapshots`
- `closing_lines`
- `pick_explanations`
- `agent_feedback`
- `risk_events`

See `supabase/scorecaster_schema.sql` for the first schema draft.

---

## Next coding sprint

### Sprint A — Bet slip and bankroll

- [ ] Add persistent bet slip structure
- [ ] Add bankroll config
- [ ] Add stake calculator
- [ ] Add max stake warning
- [ ] Add exposure warning

### Sprint B — CLV and tracking

- [ ] Save odds snapshot when pick is tracked
- [ ] Save closing line value
- [ ] Add CLV result column
- [ ] Add ROI by sport/market

### Sprint C — Daily Top 3

- [ ] Create `/daily-top-3` page
- [ ] Use Agent V9 ranking
- [ ] Show pick, edge, risk, explanation and no-bet logic
- [ ] Add refresh and source status

### Sprint D — Production safety

- [ ] Add responsible gambling page
- [ ] Add disclaimers on betting pages
- [ ] Add hard warning for high exposure
- [ ] Add no-bet recommendations when edge is weak

---

## Definition of done

Scorecaster production MVP is ready when a normal user can use the app for disciplined paper tracking without needing developer help.
