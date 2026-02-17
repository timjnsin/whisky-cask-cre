# Architecture

## System Layers

1. Warehouse API (`api/`)
2. CRE workflows (`workflows/`)
3. Onchain report consumer (`contracts/src/WhiskyCaskVault.sol`)

The API is the source of truth for cask facts and lifecycle events. CRE workflows fetch data, compute deterministic outputs under DON consensus, and submit encoded reports. The contract stores reserve attestations, cask attributes, and lifecycle checkpoints/events.

## Workflow Topology

- Proof of reserve (`workflows/proof-of-reserve/index.ts`)
  - Trigger: cron
  - Reads: `/inventory`, `totalMinted()`
  - Writes: reserve attestation report
- Physical attributes (`workflows/physical-attributes/index.ts`)
  - Trigger: cron
  - Reads: `/portfolio/summary`, `/casks/batch`
  - Writes: cask batch report
- Lifecycle webhook (`workflows/lifecycle-webhook/index.ts`)
  - Trigger: HTTP
  - Reads: trigger payload only
  - Writes: lifecycle report
- Lifecycle reconcile (`workflows/lifecycle-reconcile/index.ts`)
  - Trigger: cron
  - Reads: `/lifecycle/recent`, `lastLifecycleTimestamps(...)`
  - Writes: lifecycle batch report

## Privacy Model

Proof of reserve supports two attestation modes:

- `public`: fetch via `HTTPClient`, publish counts and reserve ratio
- `confidential`: fetch via `ConfidentialHTTPClient`, publish only `isFullyReserved` + timestamp + attestation hash

Confidential mode prevents raw inventory count from being emitted in the report payload, contract storage, or contract event.

## Shared Runtime

`workflows/shared/cre-runtime.ts` is the workflow facade:

- runtime-safe SDK loading and capability checks
- deterministic `asOf` timestamp resolution (`resolveSnapshotAsOf`, `withAsOf`)
- shared HTTP fetch helpers (`httpGetJson`)
- EVM read helpers (`resolveTotalTokenSupply`, `resolveLastLifecycleTimestamps`)
- report submission guardrails (`submitReport`)

## Data Model

TTB-native units are preserved end to end:

- proof gallons (scaled 1e2 onchain)
- wine gallons (scaled 1e2 onchain)
- proof (scaled 1e1 onchain)

Attestation hashes are bytes32 and validated before report encoding.

## Environment Model

- Local simulation: `workflow.ts` files use plain `fetch` for fast development.
- CRE execution: `index.ts` files are compiled to WASM and run via CRE runtime.

Both paths share domain models and report encoders to keep output shape consistent.
