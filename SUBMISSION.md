# Submission Guide

## What To Open First

1. `README.md` for project narrative and architecture.
2. `contracts/src/WhiskyCaskVault.sol` for onchain report ingestion.
3. `workflows/proof-of-reserve/index.ts` for public/confidential PoR logic.
4. `workflows/shared/cre-runtime.ts` for CRE integration layer.
5. `dashboard/app/page.tsx` for mode-aware dashboard rendering.

## Run Locally

```bash
npm install
npm run seed
npm run dev:api
```

In another terminal:

```bash
npm run dev:dashboard
```

## Notes

- Dashboard reads from API by default (`dashboard/.env.example`).
- Optional onchain read path is enabled via `NEXT_PUBLIC_VAULT_ADDRESS` + Sepolia RPC env vars.
- Use `npm run dev:dashboard` / `npm run build:dashboard` from repo root; these commands run the dashboard with Node 20 automatically.
- Node version is pinned in `.nvmrc` and `dashboard/.nvmrc` (`20.20.0`).
