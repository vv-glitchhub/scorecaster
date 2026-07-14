# Scorecaster security policy

## Supported version

Security fixes are applied to the current `main` branch and the latest published mobile/web release.

## Reporting a vulnerability

Do not disclose an exploitable vulnerability, credential, access token, recovery link or personal user data in a public GitHub issue.

Use GitHub private vulnerability reporting for this repository when available:

https://github.com/vv-glitchhub/scorecaster/security/advisories/new

Include only the minimum information required to reproduce the issue:

- affected route, screen or release version
- device/operating-system details when relevant
- safe reproduction steps
- expected and actual behavior
- estimated impact
- a redacted proof of concept

Do not access, alter, download or delete data belonging to another user. Do not perform denial-of-service testing, credential stuffing, social engineering or testing against third-party services without authorization.

## Product data boundary

Scorecaster does not need or intentionally collect payment-card numbers, bank-account details, bookmaker credentials, deposits, withdrawals or real-money balances. Never send those details in a security report.

## Response process

The project owner will:

1. acknowledge a valid report when it is received
2. reproduce and classify the issue
3. rotate exposed secrets or revoke sessions immediately when required
4. prepare a private fix and regression test
5. deploy the fix before publishing detailed technical information
6. notify affected users and authorities when legally required

No response-time guarantee is made during the pre-release phase. Public release is blocked while known critical or high-severity findings remain unresolved.

## Safe harbor

Good-faith research that follows this policy, avoids privacy harm and stops after demonstrating the issue will be treated as authorized security testing for this project. This does not authorize testing against Supabase, Vercel, Expo, Apple, Google, odds providers, AI providers or any other third party.
