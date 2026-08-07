# Veikkaus Pool Games V1

## Purpose

Scorecaster must not treat every Veikkaus game as a normal fixed-odds market. This module creates a deterministic rules boundary for analysing Finnish fixed-odds and pool/system games while preserving the product's paper-only safety model.

## Supported families

- **Pitkäveto**: fixed odds. A placed price is fixed at acceptance. This family continues to belong to the existing bookmaker/price analysis path.
- **Tulosveto**: pari-mutuel exact-score pool. A system contains every exact-score combination formed by the selected home and away goal counts. A savings system removes home-win, draw or away-win combinations as selected by the user.
- **Vakio**: pari-mutuel 1X2 pool. A complete system contains every row formed by selected 1/X/2 marks. Harava systems are intentionally not synthesized in V1 because their key-row tables and minimum guarantees require an explicit authoritative scheme definition.
- **Voittajaveto / Supertripla**: ordered ranking pool. The engine counts only valid ordered rows; the same competitor cannot occupy multiple positions in one row.
- **Toto**: racing pari-mutuel games. V1 stores deterministic multi-winner-class distribution rules for TOTO86, TOTO75, TOTO76, TOTO64 and TOTO65 and classifies common Toto game names.

## Tulosveto pool math

For a round with return rate `r`, total turnover `V` and amount `A` wagered on a result, the published pool-derived price follows:

`odds = (r * V) / A`

The reverse estimate of the fraction of turnover wagered on an outcome is therefore:

`poolShare = r / odds`

The default round return rate implemented for Tulosveto is 0.77. This is not treated as a bookmaker overround or a no-vig market probability; it is a pool-allocation relationship and must remain labeled separately in product surfaces.

## System calculations

### Vakio complete system

The number of rows equals the product of selected marks in each match. Example: `1 × 2 × 3 = 6` rows.

### Tulosveto complete and savings systems

The engine enumerates the cartesian product of selected home and away goal counts. Savings-system filtering can remove exactly one result class:

- `home`: remove home wins
- `draw`: remove draws
- `away`: remove away wins

### Ordered ranking systems

The engine enumerates valid ordered combinations and excludes any row where a competitor would appear in two positions. This reproduces the supplied Supertripla example where position pools of 4, 5 and 9 selections with the documented overlaps yield 135 valid rows.

## Deliberate V1 exclusions

The module does not place bets, authenticate to Veikkaus, move money, invoke Cash Out, generate real-money stakes or submit tickets. It also does not invent harava key rows, Toto reserve-horse substitutions, cancellation settlement or missing game-specific payout percentages when those are not represented by an explicit deterministic input/source.

These should be added later as separate, source-versioned rule modules rather than inferred from generic sportsbook logic.

## Safety boundary

Every supported family can emit an explicit `paperOnly` rule boundary:

- `allowsBetPlacement: false`
- `allowsBookmakerLogin: false`
- `allowsMoneyMovement: false`
- purpose: analysis and system construction only

## Validation

Run:

```bash
node --test scripts/veikkaus-pool-games.test.mjs
```

The regression suite covers game classification, Tulosveto pool math, complete-system row counts, savings-system filtering, ordered ranking uniqueness, Toto winner-class shares and the permanent paper-only boundary.
