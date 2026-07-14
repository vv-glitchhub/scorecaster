# Scorecaster Production Runbook

## Purpose

This runbook keeps local development, GitHub CI and Vercel deployment aligned.

## Required runtime

- Node.js 20
- npm
- Next.js 16

The repository includes `.nvmrc` with Node 20.

## Local verification

```bash
npm install --no-audit --no-fund
npm run build
npm run dev
```

Open:

```text
http://localhost:3000/
http://localhost:3000/quick-use
http://localhost:3000/production-status
http://localhost:3000/core-status
http://localhost:3000/api/health
```

## Production verification

After merging to `main`:

1. Confirm GitHub Actions build is successful.
2. Confirm Vercel deployment is successful.
3. Open `/api/health`.
4. Confirm `status` is `ok`.
5. Confirm `/quick-use`, `/production-status` and `/core-status` load.
6. Test one local manual pick.
7. Confirm the local slip survives a browser refresh.

## Health endpoint

`/api/health` reports only configuration presence and safe runtime metadata. It does not return secret values.

Expected local-first response:

```json
{
  "app": "Scorecaster",
  "status": "ok",
  "mode": "local-first"
}
```

## Environment variables

Required for live odds:

```text
ODDS_API_KEY
```

Future cloud and AI integrations:

```text
OPENAI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Never commit `.env.local` or secret values.

## Failure procedure

When Vercel fails:

1. Read the exact build error.
2. Reproduce with `npm run build`.
3. Fix the smallest root cause.
4. Open a pull request.
5. Wait for GitHub CI before merging.
6. Confirm Vercel success after merge.

Do not add new production features while `main` is failing to build.
