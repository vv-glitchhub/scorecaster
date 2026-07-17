# Scorecaster trilingual release

Scorecaster supports three interface languages:

- Finnish (`fi`)
- English (`en`)
- Spanish (`es`)

## Coverage

The selected language is used by the web and native mobile application for:

- navigation and onboarding
- Home
- Picks
- Agent V10 and grounded explanations
- Tracking
- Analytics
- Simulator
- authentication
- Profile, export, privacy and account-deletion controls
- contextual help and the main user guide

Provider, league, team and bookmaker names remain in their source form. Historical engine text stored before this release can also remain in its original language; the application labels and newly generated Agent explanation use the selected language.

## Persistence

Web stores the language preference locally under:

```text
scorecaster_language_v3
```

Native mobile stores the same preference with the device-protected SecureStore implementation.

The language preference is not sensitive personal data and is not sent to bookmakers. The native and web clients send only the language code (`fi`, `en` or `es`) when requesting a grounded Agent explanation.

## Agent V10 trust boundary

Language changes presentation only.

It does not enter or modify the signed deterministic decision contract. It cannot change:

- PLAY / WATCH / SKIP
- probability
- edge
- EV
- stress range
- price guard
- virtual paper stake
- portfolio exposure

The server validates the generated explanation using the same grounding rules in all three languages. Unsupported language values fall back safely to Finnish.

## Release gates

The CI pipeline verifies:

- identical non-empty dictionary keys in all three languages
- web language persistence and the HTML language attribute
- protected native preference storage
- global language selectors
- selected-language Agent explanation requests
- language-independent signed decisions
- deterministic Agent fallback in Finnish, English and Spanish
- the existing security, model, settlement, mobile and production-build checks
