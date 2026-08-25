# Zero-Cost Football Model Lab V1

## Purpose

Answer one narrow question before Scorecaster pays for live xG data:

> Does an independent football xG/Poisson challenger show enough out-of-sample skill versus a pregame no-vig market benchmark to justify a paid live-data trial?

This is a **research-only** experiment. It cannot change production probabilities, edge, EV, evidence readiness, recommendation ranking, PLAY decisions, paper stakes, or any real-money action.

## Zero-cost sources

### StatsBomb Open Data

- Source: https://github.com/statsbomb/open-data
- Experiment competition: English Premier League 2015/2016
- StatsBomb identifiers: competition `2`, season `27`
- Used fields: match metadata and shot-level `shot.statsbomb_xg`
- Scorecaster entitlement: **research only**
- Production use allowed: **false**
- Commercial deployment allowed: **false unless separately licensed/approved**
- Attribution required when publishing/sharing analysis based on the data

Scorecaster resolves an immutable StatsBomb repository revision at the beginning of an experiment and hashes the downloaded match/event content. Raw StatsBomb event files are not committed into the Scorecaster repository.

### Football-Data.co.uk

- Source: https://www.football-data.co.uk/
- Historical EPL CSV: `mmz4281/1516/E0.csv`
- Used fields: full-time result plus the best available historical 1X2 pregame odds triplet
- Priority: Pinnacle closing (`PSCH/PSCD/PSCA`) -> closing market average -> historical bookmaker average -> market average -> Bet365 fallback
- Scorecaster converts odds to normalized no-vig 1X2 probabilities before evaluation
- Raw CSV is not redistributed by Scorecaster

Football-Data states its historical computer-ready results and betting odds files are free for quantitative analysis. The lab records the retrieved CSV content hash in the experiment manifest.

## Dataset pairing

The loader:

1. resolves the StatsBomb open-data Git revision,
2. loads EPL 2015/2016 match metadata,
3. downloads each match event file at the same immutable revision,
4. sums historical team shot xG for each completed match,
5. parses Football-Data historical odds,
6. canonicalizes known team naming differences,
7. pairs by home team, away team and date (maximum ±2 days),
8. hashes the fully paired derived input rows.

Unmatched rows are reported and are never silently zero-filled.

## Challenger

Model: `zero-cost-xg-poisson-walk-forward-v1`

Inputs available before a target match:

- exponentially weighted historical xG for,
- exponentially weighted historical xG against,
- training-only league home/away xG prior,
- opponent attack/defence history.

The target match's xG or result is never a feature for that target prediction.

The model creates home and away expected-goal rates and converts them to a 1X2 distribution with a Poisson score grid. Market odds are never model features.

## Chronology

- split: 70% chronological training / 30% holdout,
- team state is initialized from the training period,
- each holdout prediction is produced before that match is used,
- after a completed holdout match, its historical xG may update state for later matches,
- evaluation is therefore walk-forward rather than a random shuffled split.

## Champion

The champion for this research experiment is a paired historical no-vig market benchmark from Football-Data odds.

It is not an independent predictive model and it is not replaced automatically.

## Proper scoring rules

Each fully paired holdout match is evaluated with:

- multiclass Brier score,
- multiclass log loss,
- calibration gap,
- Brier skill score relative to the market,
- log-loss improvement relative to the market.

The same rows are used for challenger and champion comparisons.

## Statistical gate

A paid live-data trial is `trial-justified` only when all of these are true:

1. at least 100 fully paired holdout matches,
2. Brier skill score > 0,
3. market log loss - challenger log loss > 0,
4. paired bootstrap 95% interval for Brier improvement has lower bound > 0,
5. paired bootstrap 95% interval for log-loss improvement has lower bound > 0,
6. challenger calibration gap is no more than 0.02 worse than the market benchmark.

A positive point estimate alone is not enough.

Possible purchase decisions:

- `trial-justified`
- `inconclusive`
- `do-not-buy-yet`

Even `trial-justified` only means a **paid live-data trial may be worth testing**. It does not promote a production model.

## Reproducibility manifest

Every full experiment records:

- StatsBomb repository revision,
- StatsBomb match/event content hash,
- Football-Data CSV content hash,
- paired dataset input hash,
- retrieval timestamp,
- pairing counts,
- methodology parameters,
- holdout dates,
- bootstrap seed and sample count.

## Commands

Regression tests:

```bash
node --test scripts/zero-cost-football-model-lab-v1.test.mjs
```

Full free-data experiment:

```bash
node scripts/run-zero-cost-football-model-lab-v1.mjs --output=artifacts/zero-cost-football-model-lab-v1-report.json
```

GitHub Actions workflow:

`.github/workflows/zero-cost-football-model-lab-v1.yml`

The workflow can be launched manually and also runs when the full experiment runner is changed.

## Safety boundary

Always false:

- production probability changed by this lab,
- production edge changed by this lab,
- production EV changed by this lab,
- production evidence gate satisfied by StatsBomb Open Data,
- automatic challenger promotion,
- PLAY upgrade by this lab,
- real-money action availability.

Scorecaster remains paper-only.
