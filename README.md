# Whisky Cask CRE: Privacy-Preserving Proof of Reserve for Physical Assets

Bonded warehouses maintain federally regulated custody records for every whisky cask: existence, type, age, gauge readings, and lifecycle events. Today that data is locked in warehouse management systems, emailed as PDFs, and arrives weeks late. Investors, lending protocols, and secondary markets have no way to independently verify what they're told.

This project uses Chainlink CRE to pipe verified warehouse data onchain on a near-real-time cadence. Proof of reserve. Physical attributes. Lifecycle provenance. With a privacy layer so warehouses can participate without exposing commercially sensitive inventory data.

We don't tell you what a cask is worth. We give you the verified facts to decide for yourself.

## The Problem

Whisky cask tokenization has a trust problem. The token issuer says "I have 47 casks in a warehouse." The warehouse says "yes." Both parties have economic incentives to agree. That's self-attestation, not verification.

Meanwhile, the actual data that proves cask existence and condition is governed by federal law:

- **27 CFR Part 19** requires bonded warehouses to maintain per-barrel gauge records (package ID, cooperage, proof gallons, wine gallons, fill date, DSP number)
- **TTB Form 5110.11** (Monthly Report of Storage Operations) is a literal proof-of-reserve source document filed with the Alcohol and Tobacco Tax and Trade Bureau
- **27 CFR 19.618/619** specifies the exact per-barrel measurements warehouses must record at each gauge

This data exists. It's legally mandated. It's just not accessible onchain.

## What We Built

Three CRE workflows that fetch warehouse data, reach DON consensus, and write verified reports to a Solidity contract:

```
Warehouse API                CRE (DON consensus)           Smart Contract
-------------                -------------------           --------------

GET /inventory  ---------->  N nodes fetch independently,  ReserveAttestation
(cask count,                 verify, reach BFT consensus   { physicalCaskCount,
 proof gallons,              on identical data               totalTokenSupply,
 attestation hash)                                           reserveRatio,
                                                             attestationHash }

GET /casks/batch ----------> Consensus on per-cask         CaskAttributes[id]
(gauge records,              attributes from warehouse     { caskType, fillDate,
 estimates)                  records                         entryProofGallons,
                                                             lastGaugeProofGallons,
                                                             state, warehouseCode }

Webhook payload  ----------> Consensus on state            LifecycleTransition event
(cask regauged,              transition event              { caskId, fromState,
 new gauge data)                                             toState, timestamp,
                                                             gaugeProofGallons }
```

### 1. Proof of Reserve (hourly cron)

Fetches warehouse inventory count, reads `totalMinted()` from the contract, computes reserve ratio, writes attestation onchain. In confidential mode, only a boolean `isFullyReserved` is published onchain (the raw inventory count is not included in the onchain report payload).

### 2. Physical Attribute Oracle (daily cron)

Fetches per-cask gauge records and angel's share estimates for recently changed casks. Writes batch updates to the contract. Every field maps to a TTB-required measurement: proof gallons, wine gallons, proof, gauge method, gauge date.

### 3. Lifecycle Provenance (webhook + daily fallback)

Records every state transition as an immutable onchain event: `filled -> maturation -> regauged -> transfer -> bottling_ready -> bottled`. Each transition carries gauge data when applicable. The webhook path requires zero HTTP calls (data arrives in the signed trigger payload). A daily cron reconcile catches any missed events.

## Why Privacy Matters

A warehouse's aggregate inventory is commercially sensitive. It reveals:

- Total barrel count (purchasing power, scale)
- Acquisition patterns (supplier relationships)
- Inventory velocity (business health signals)

TTB tracks the proprietor (DSP number), not the beneficial token holder. Privacy protects the warehouse operator's business data, not investor anonymity.

Confidential HTTP enables the proof-of-reserve workflow to attest "casks >= tokens" without revealing the actual count onchain. In production, node-side logging should also be configured to avoid emitting sensitive raw counts.

## Data Honesty

We use TTB-native units throughout: proof gallons (PG) and wine gallons (WG), not milliliters or ABV. PG = WG x (proof / 100). This is how warehouses actually measure and report.

The data model has three explicit tiers:

| Tier | What | Source | Example |
|------|------|--------|---------|
| 1: Verified facts | Warehouse/TTB records | 27 CFR 19.618 gauge records | Cask exists, fill date, entry proof gallons, last regauge |
| 2: Computed estimates | Math on Tier 1 data | Angel's share decay model | Estimated current proof gallons, bottle yield |
| 3: Market opinions | Models, comps | Reference only | Age-curve valuation (labeled as estimate, not price) |

Tier 2 and 3 are clearly labeled. We never pass off a model output as a measurement.

## CRE Execution Budgets

All workflows operate within CRE limits (max 5 HTTP calls, 10 EVM reads per execution):

| Workflow | Trigger | HTTP | EVM Read | EVM Write |
|----------|---------|------|----------|-----------|
| Proof of reserve | Cron (hourly) | 1 | 1 | 1 |
| Physical attributes | Cron (daily) | 2 | 0 | 1 |
| Lifecycle webhook | HTTP trigger | 0 | 0 | 1 |
| Lifecycle reconcile | Cron (daily) | 1 | 0 | 1 |

Deterministic snapshot timestamps (`resolveSnapshotAsOf` + `?asOf=` query params) ensure all DON nodes evaluate the same data window for consensus.

## Quick Start

```bash
# Install dependencies and seed mock warehouse data
npm install
npm run seed

# Start the warehouse API (serves 47 seeded casks)
npm run dev:api
```

In a second terminal:

```bash
# Run all 4 workflow simulations against the local API
npm run simulate:all
```

To run through the CRE CLI (requires `cre` installed):

```bash
cre workflow simulate workflows/proof-of-reserve -T staging-settings --non-interactive --trigger-index 0
```

By default, local/staging configs run in safe simulation mode (`submitReports: false`) and do not broadcast onchain transactions.

To compile and test the Solidity contract (requires `forge`):

```bash
cd contracts
forge build
forge test -vvv
```

## Project Structure

```
contracts/
  src/WhiskyCaskVault.sol          Onchain report consumer (onReport routing by ReportType)
  src/interfaces/IWhiskyCaskVault.sol  Enums, structs, interface
  test/WhiskyCaskVault.t.sol       Foundry tests (9 tests)
  script/Deploy.s.sol              Sepolia deployment script

api/
  src/index.ts                     Hono server (11 endpoints)
  src/domain/types.ts              Shared TypeScript types (TTB-native units)
  src/services/portfolio.ts        Portfolio store with Map index, batch, lifecycle
  src/services/seed.ts             Deterministic 47-cask portfolio generator
  src/services/estimate.ts         Angel's share estimation model
  src/services/attestation.ts      Inventory attestation hash (keccak256)
  src/adapters/warehouse/          WarehouseAdapter interface + mock implementation

workflows/
  shared/cre-runtime.ts            CRE SDK facade (typed runtime, HTTP, EVM, report submission)
  shared/report-encoding.ts        ABI encoding matching Solidity structs exactly
  shared/contract-mapping.ts       API-to-contract type transforms (exhaustive enum mappings)
  proof-of-reserve/index.ts        CRE runtime: reserve attestation
  physical-attributes/index.ts     CRE runtime: batch cask attribute updates
  lifecycle-webhook/index.ts       CRE runtime: webhook-triggered lifecycle events
  lifecycle-reconcile/index.ts     CRE runtime: daily fallback for missed events
  */workflow.ts                    Local simulation scripts (fetch-based, no CRE dependency)
  */config.staging.json            Local/staging configs (submitReports: false)
  */config.production.json         Production configs (Sepolia addresses TBD)
  */workflow.yaml                  CRE CLI workflow manifests

project.yaml                       CRE project settings (RPC endpoints)
```

## Tech Stack

- **CRE workflows**: TypeScript, `@chainlink/cre-sdk`, Bun
- **Smart contract**: Solidity 0.8.24, Foundry
- **Warehouse API**: TypeScript, Hono, `@hono/node-server`
- **Chain**: Ethereum Sepolia
- **Encoding**: `viem` for ABI encoding/decoding, `zod` for config validation

## What This Is Not

- **Not a valuation oracle.** We put verified physical facts onchain. Valuation is a model output, not a measurement, and we label it accordingly.
- **Not trustless end-to-end.** The system trusts TTB-regulated warehouses to report accurately (falsifying federal records is a criminal offense). CRE decentralizes the *pipeline*, not the *source*.
- **Not whisky-specific.** Whisky casks are the demo asset. The pattern (privacy-preserving proof of reserve for physically-held assets via CRE) generalizes to wine, art, precious metals, or any custodied commodity with regulated record-keeping.

## Known Limitations (Current Demo)

- **Lifecycle reconcile submits one event per run.** The daily fallback currently submits the latest event only, not a full backlog replay.
- **Lifecycle event dedup is workflow-level.** Webhook and reconcile paths can emit the same transition twice; contract state remains idempotent, but duplicate events may appear in logs.

## Hackathon Context

Built for the [Chainlink Convergence Hackathon](https://chain.link/convergence) (Feb 6 -- Mar 1, 2026). Primary track: Privacy. The core capability is Confidential HTTP on the proof-of-reserve inventory fetch.
