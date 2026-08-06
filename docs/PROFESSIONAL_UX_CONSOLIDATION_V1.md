# Scorecaster Professional UX Consolidation V1

The default Scorecaster product has exactly five primary destinations:

1. **Today** — current trusted opportunities and Daily Brief context
2. **AI Feed** — timestamped evidence changes and corrected analyses
3. **Matches** — verified fixtures, provider comparison and event audit
4. **My Picks** — paper portfolio, CLV, calibration and risk review
5. **Profile** — shared preferences, AI Coach, notifications and privacy

All other routes are secondary, advanced or operator tools. They do not become additional primary tabs.

## Shared professional selection card

`app/components/ProfessionalSelectionCard.jsx` is the canonical selection presentation for Today, AI Feed and Matches. It uses the pure `lib/professional-selection-evidence.mjs` engine.

The default card shows:

- event and selection
- explicit PLAY, WATCH, CAUTION or SKIP text
- selected provider and offered decimal price
- independent model probability only when one actually exists
- separately labelled no-vig market benchmark
- EV and fair odds
- strongest supported factor
- largest supported risk or a visible missing-data statement
- paper-only boundary before any save control

The same selection and provider preference must produce the same evidence object on every surface. Pages may change layout density but not the calculation.

## Provider preference

The provider preference is stored in the existing `scorecaster_settings` browser key:

```json
{
  "bookmakerKey": "all",
  "bookmakerLabel": "Best available price",
  "proMode": false
}
```

The setting is shared through `ProfessionalPreferencesProvider`. Changes dispatch `scorecaster:settings-changed` and also synchronize through the browser `storage` event.

The provider setting changes only the evaluated offered price. It never changes:

- independent model probability
- no-vig market benchmark
- context evidence
- event identity
- closing-line history
- settlement outcome

When a preferred provider is unavailable, the card labels the missing provider instead of silently substituting another named provider. `all` explicitly means the best available normalized price.

## Market and model naming

A market-consensus probability is never labelled as an independent predictive model. When `modelMode` is `market-consensus` or the input explicitly says an independent model is unavailable:

- the model field is missing
- the no-vig market field contains the consensus probability
- existing price EV may still be shown as market-price evidence
- Pro Mode exposes the market-only boundary

## Pro Mode

Pro Mode uses exactly the same evidence object as simple mode. It reveals:

- edge
- uncertainty or confidence
- data-quality and source counts
- EV formula
- provider boundary
- source timestamp
- model or audit version

It does not call a separate AI endpoint, change the selection, change the provider, recalculate with hidden inputs or promote a decision.

## Five-tab integration

- `/` adds `ProfessionalSurfaceRail surface="today"`
- `/feed` adds `ProfessionalSurfaceRail surface="feed"`
- `/events` adds `ProfessionalSurfaceRail surface="events"`
- `/tracking` uses a nested layout with `ProfessionalPortfolioRail`
- `/profile` uses a nested layout with `ProfessionalProfileRail`

The shared preference controls are also available in the AppShell menu, so a user does not need to visit Profile to change them.

## Route classification

Normal daily use remains inside the five primary tabs. The following are supporting user tools behind the More menu:

- Daily Brief and Market Changes
- Watchlist and Alerts
- Verified Live Monitor
- AI Coach
- CLV & Calibration
- Risk Lab

The following are advanced evidence or model laboratories rather than primary product destinations:

- Betting and AI Agent legacy analysis views
- Autonomous Agent operator view
- Decision Diagnostics
- Sports Analytics
- Polymarket Intelligence
- Simulator
- Open 1X2 model
- Match X-Ray
- Context Engine
- Market Microstructure
- Transparency and Source Registry

Production Control, Operations, provider health, release readiness and security remain inside the explicit developer/operator disclosure. A later route removal may redirect legacy pages only after analytics prove that no required workflow depends on them.

## Accessibility

- all five bottom navigation items have text labels and icons
- provider select and Pro Mode checkbox use associated labels
- More menu has `aria-expanded` and `aria-controls`
- decision state is written as text and is not color-only
- largest risk and paper-only boundary are written in visible text
- save controls reference the paper-only explanation with `aria-describedby`
- interactive controls use at least the existing 44-pixel Scorecaster minimum height classes
- keyboard focus remains visible through border and ring styles
- Pro Mode uses a native disclosure and the same DOM order as simple mode
- no critical information depends on hover

## Mobile and PWA

The shared card uses two-column mobile metrics and expands to four columns at larger widths. The existing five-item bottom navigation remains unchanged. AppShell's More menu is height-limited and scrollable so provider controls and advanced routes remain reachable on small screens and installed PWA windows.

## Paper-only boundary

Every canonical professional selection card displays the paper-only explanation before any save button:

```text
Saving does not place a real bet, move money or sign in to a bookmaker.
```

No component in this package accesses bookmaker accounts, deposits, withdrawals or real-money execution.
