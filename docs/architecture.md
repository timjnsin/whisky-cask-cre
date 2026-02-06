# Architecture (Day 1)

## Components

1. Warehouse API (mock, TTB-shaped data)
2. Workflow layer (local simulation + CRE runtime entrypoints)
3. Onchain vault contract skeleton (`onReport` consumer)

## Extension Points

- Adapter boundary for DRAMS SOAP/XML integration (`api/src/adapters/warehouse/`)
- Attestation mode boundary (`public` vs `confidential`)
- Optional reference valuation endpoint/module for downstream products
- CRE workflow trigger/capability boundaries for privacy and product-specific workflows

## Data Units

All gauge records are tracked in TTB-native units:

- proof gallons (scaled 1e2 onchain)
- wine gallons (scaled 1e2 onchain)
- proof degrees (scaled 1e1 onchain)

## Runtime Model

- Local dev loop:
  - API + `workflow.ts` simulation scripts
  - deterministic outputs and low-friction debugging
- CRE runtime loop:
  - `index.ts` workflow entrypoints using `Runner`, triggers, HTTP/EVM capabilities, and `writeReport`
  - report payloads encoded to match `WhiskyCaskVault.onReport` routing

## Trust Model (Current)

- Data source is deterministic mock data shaped like regulated warehouse records.
- CRE workflows attest and transport data; contract stores attestations and cask state.
- Token economics and full custody/legal enforcement are out of Day-1 scope.
