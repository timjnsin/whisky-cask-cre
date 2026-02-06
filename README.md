# Whisky Cask CRE Infrastructure

Day-1 baseline for a Chainlink CRE hackathon build focused on:

1. Proof of reserve
2. Physical attribute oracle
3. Lifecycle provenance

This repo is modular so privacy mode and downstream financial products can be added without rewriting core data flows.

## Current Status

Implemented:

- Mock warehouse API (Hono) with TTB-native units (proof gallons, wine gallons, proof)
- Deterministic seeded cask portfolio (47 casks)
- Contract report-consumer skeleton with `onReport(bytes)` routing by `ReportType`
- Contract-aligned ABI report envelope encoding: `abi.encode(uint8 reportType, bytes payload)`
- CRE runtime entrypoints (`index.ts`) for all 4 workflows using:
  - `Runner.newRunner(...)`
  - `cre.handler(...)`
  - `CronCapability` / `HTTPCapability`
  - `HTTPClient` / `EVMClient`
  - `prepareReportRequest(...)` + `writeReport(...)`
- Local simulation scripts (`workflow.ts`) retained for fast iteration and demo

Remaining:

- Deploy and configure Sepolia addresses (`contractAddress`, forwarder, gas config)
- Add Confidential HTTP capability path for PoR fetches

## Workflow Entry Points

- Local simulation scripts:
  - `workflows/proof-of-reserve/workflow.ts`
  - `workflows/physical-attributes/workflow.ts`
  - `workflows/lifecycle-webhook/workflow.ts`
  - `workflows/lifecycle-reconcile/workflow.ts`
- CRE runtime scripts:
  - `workflows/proof-of-reserve/index.ts`
  - `workflows/physical-attributes/index.ts`
  - `workflows/lifecycle-webhook/index.ts`
  - `workflows/lifecycle-reconcile/index.ts`

## Quick Start (Local Simulation)

```bash
npm install
npm run seed
npm run dev:api
```

In a second terminal:

```bash
npm run simulate:all
```

## API Endpoints

- `GET /health`
- `GET /inventory`
- `GET /cask/:id/gauge-record`
- `GET /cask/:id/estimate`
- `GET /cask/:id/lifecycle`
- `GET /casks/batch`
- `GET /lifecycle/recent`
- `GET /portfolio/summary`
- `GET /market-data`
- `GET /cask/:id/reference-valuation`
- `POST /events/lifecycle`

Deterministic snapshot reads support `?asOf=<ISO-8601>` on:

- `/inventory`
- `/casks/batch`
- `/lifecycle/recent`
- `/portfolio/summary`
- `/market-data`
- `/cask/:id/estimate`
- `/cask/:id/reference-valuation`

For the mock data model, `asOf` drives deterministic time-based calculations and windows, not full historical state replay.

Execution budgets are CRE-safe:

- Proof of reserve: `1 HTTP + 1 EVM read + 1 EVM write`
- Physical attributes: `2 HTTP + 1 EVM write`
- Lifecycle webhook: `0 HTTP + 1 EVM write` (uses signed trigger payload directly in CRE runtime path)
- Lifecycle reconcile: `1 HTTP + 1 EVM write`

## Config

Workflow configs:

- `workflows/proof-of-reserve/config.staging.json`
- `workflows/physical-attributes/config.staging.json`
- `workflows/lifecycle-webhook/config.staging.json`
- `workflows/lifecycle-reconcile/config.staging.json`

Staging configs set `submitReports: false` by default so CRE runtime entrypoints can execute safely with zero addresses.

Supported config keys for CRE runtime files include:

- `apiBaseUrl`
- `contractAddress`
- `chainSelector`
- `tokensPerCask`
- `attestationMode`
- `tokenSupplyUnits` (PoR fallback)
- `submitReports`
- `reportGasLimit`

For demos, `project.yaml` currently uses a public Sepolia RPC endpoint. For multi-node/DON execution,
use a dedicated provider URL to avoid rate-limit instability.

## Notes

- Solidity contract remains intentionally minimal (storage + report consumption, no ERC-1155 minting flow yet).
- In this NodeNext workspace, SDK imports are loaded dynamically in `workflows/shared/cre-runtime.ts` for TypeScript compatibility. Runtime behavior still uses `@chainlink/cre-sdk` directly.
