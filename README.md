# Whisky Cask CRE Infrastructure

Day-1 baseline for a Chainlink CRE hackathon build focused on:

1. Proof of reserve
2. Physical attribute oracle
3. Lifecycle provenance

This repo is intentionally modular so privacy mode and downstream financial products can be added without rewriting the core.

## Current Status

Implemented in this baseline:

- Mock warehouse API (Hono) with TTB-native units (proof gallons, wine gallons, proof)
- Deterministic seeded cask portfolio (47 casks)
- Chainlink CRE SDK dependency wired into workflow runtime scaffolding
- Workflow simulation scripts for:
  - Proof of reserve
  - Physical attributes
  - Lifecycle webhook ingest
  - Lifecycle reconciliation
- Smart contract report-consumer skeleton (Solidity) with `onReport` decoding and forwarder path
- Demo helper scripts

Not implemented yet (planned next):

- Full CRE managed runtime wiring (beyond local simulation scripts)
- Sepolia deployment wiring
- Confidential HTTP capability integration
- Foundry test suite

## Why this shape

- `api/` owns data realism and source adapter boundaries
- `workflows/` owns report construction and mode-specific reserve logic
- `contracts/` owns onchain storage/event schema
- `design/` remains source-of-truth architecture docs

## Quick Start (Node)

```bash
npm install
npm run seed
npm run dev:api
```

In a second terminal:

```bash
npm run simulate:all
```

## Quick Start (bun-compatible aliases)

```bash
npm run seed:bun
npm run dev:api:bun
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

`workflows/physical-attributes` now uses 2 HTTP calls and `workflows/lifecycle-reconcile` uses 1 HTTP call to stay within CRE execution limits.

## Config

Workflow configs live in:

- `workflows/proof-of-reserve/config.staging.json`
- `workflows/physical-attributes/config.staging.json`
- `workflows/lifecycle-webhook/config.staging.json`
- `workflows/lifecycle-reconcile/config.staging.json`

## Contract Note

The Solidity contract is a storage/report-consumer skeleton and does not yet include production access control and token minting flow.

## Next Recommended Steps

1. Swap mock warehouse adapter for a DRAMS-compatible adapter module.
2. Wire workflow scripts to CRE SDK execution runtime.
3. Add confidential reserve mode path to PoR workflow once Confidential HTTP is available.
4. Add Foundry tests and Sepolia deployment scripts.
