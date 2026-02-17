# Dashboard

Next.js App Router dashboard for reserve attestations, cask explorer, and lifecycle feed.

## Run

1. Start warehouse API from repo root:

```bash
npm run dev:api
```

2. In a second terminal, run dashboard from repo root:

```bash
npm run dev:dashboard
```

3. Open `http://localhost:3001` (or whatever Next assigns).

## Environment

Copy `dashboard/.env.example` to `dashboard/.env.local` and set:

- `NEXT_PUBLIC_WAREHOUSE_API_URL` for API reads.
- `NEXT_PUBLIC_VAULT_ADDRESS` + `NEXT_PUBLIC_SEPOLIA_RPC_URL` for onchain mode detection and attestation logs.

If contract vars are unset, the dashboard falls back to API-derived reserve values.

## Node Requirement

Dashboard scripts run Next/TypeScript via `npx node@20`, so they work even if your global Node is older.

For consistency in local dev, use the pinned version in `dashboard/.nvmrc` (`20.20.0`).
