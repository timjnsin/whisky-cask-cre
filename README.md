# Whisky Cask CRE: Privacy-Preserving Proof of Reserve for Physical Assets

## The Problem

In 2025, Braeburn Whisky collapsed with $80 million in claimed cask assets. Thousands of investors couldn't verify whether their barrels existed. The same year, the BBC aired "Hunting the Whisky Bandits" -- documenting a convicted fraudster who sold phantom casks to 213 victims across multiple shell companies. In Tasmania, an audit of Nant Distillery revealed 1,300 barrels that didn't exist, with the same cask sold to multiple buyers.

This isn't a whisky problem. It's a structural problem. **There is no centralized ownership registry for whisky casks.** Each warehouse maintains its own ledger. No cross-referencing. No independent verification. No API. Investors receive PDFs, if they receive anything at all, and ownership transfers happen via paper Delivery Orders with no standard format.

The irony: the underlying data is already regulated. In the US, bonded warehouses file monthly storage reports (TTB Form 5110.11) and maintain per-barrel gauge records under 27 CFR Part 19. The data that proves a cask exists, what's in it, and where it is -- that data is legally mandated. It's just locked in warehouse management systems, inaccessible to anyone outside.

## Why Whisky

Whisky is arguably the best-suited physical asset for tokenization:

- **Anti-depreciation.** Aging *improves* the product. A barrel appreciates 13-22% CAGR from age 12 to 25. Name another physical asset where time increases value by design.
- **Natural scarcity.** Angel's share (evaporation) removes 2-5% of volume per year. A 20-year cask has lost a third of its contents. Supply literally disappears. Scarcity isn't manufactured -- it's physics.
- **Regulated custody.** Unlike gold in a vault, whisky sits in facilities regulated by federal law (TTB in US, HMRC in UK). Per-barrel records are legally mandated. Falsifying them is a criminal offense.
- **Semi-fungible.** Unlike art or real estate, casks of the same distillery/age/type are substantially interchangeable within their cohort -- suitable for pooled ownership and tokenization.
- **Consumption floor.** Independent bottlers and blenders always need aged stock. Even in a downturn, someone wants to bottle your whisky. This creates a demand floor that pure investment assets lack.

39 million barrels of whisky are maturing in warehouses right now (22M in Scotland, 16M+ in Kentucky). The secondary cask market is ~$250M annually and growing 33% year-over-year. Scotland's Moveable Transactions Act (April 2025) just created statutory pledges over whisky casks -- lenders now have legal tools but zero data infrastructure. The lending market alone represents billions in untapped collateral.

## What We Built

Three CRE workflows that fetch warehouse data, reach DON consensus, and write verified reports to a Solidity contract. The core capability: **proof of reserve that makes double-selling structurally impossible.**

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

Fetches warehouse inventory count, reads `totalMinted()` from the contract, computes reserve ratio, writes attestation onchain. If a token issuer claims 47 casks but the warehouse reports 45, the reserve ratio drops below 1.0 and everyone can see it. In confidential mode, only a boolean `isFullyReserved` is published -- the raw inventory count stays private.

### 2. Physical Attribute Oracle (daily cron)

Fetches per-cask gauge records and angel's share estimates for recently changed casks. Writes batch updates to the contract. Every field maps to a TTB-required measurement: proof gallons, wine gallons, proof, gauge method, gauge date. Any lending protocol or secondary market can read these attributes and build their own risk model -- no need to trust ours.

### 3. Lifecycle Provenance (webhook + daily fallback)

Records every state transition as an immutable onchain event: `filled -> maturation -> regauged -> transfer -> bottling_ready -> bottled`. Each transition carries gauge data when applicable. The webhook path requires zero HTTP calls (data arrives in the signed trigger payload). A daily cron reconcile catches any missed events. The result is an unbroken chain of custody from fill to bottle.

## Why Privacy Matters

A warehouse's aggregate inventory is commercially sensitive. It reveals total barrel count (purchasing power), acquisition patterns (supplier relationships), and inventory velocity (business health signals). No warehouse will pipe raw inventory data to a public blockchain.

TTB tracks the proprietor (DSP number), not the beneficial token holder. Privacy protects the warehouse operator's business data, not investor anonymity.

Confidential HTTP enables the proof-of-reserve workflow to attest "casks >= tokens" without revealing the actual count onchain. The warehouse participates because its competitive position isn't exposed. Without this, the system is architecturally correct but commercially undeployable.

## What This Enables

1. **Cask-backed lending.** Scotland's Moveable Transactions Act (April 2025) created statutory pledges over whisky casks. Lenders have legal tools but no data infrastructure. Our oracle provides proof of existence, current physical measurements, and provenance trail -- the inputs a lender needs to price risk on whisky collateral.

2. **Institutional capital formation.** Fund managers can't deploy capital into assets they can't independently verify. Current process: fly to Scotland, visit warehouses, request regauges, cross-reference Delivery Orders. Our proof of reserve replaces point-in-time audits with continuous attestation. Any protocol can read the contract.

3. **Secondary market liquidity.** The current secondary market has weeks-long settlement and 20-40% round-trip friction. Tokenized casks with verified on-chain attributes enable automated price discovery based on real data, composable DeFi integration, and near-instant settlement.

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

## Files That Use Chainlink CRE

### CRE Workflow Entrypoints (compiled to WASM, executed on DON)

| File | CRE Capabilities Used |
|------|----------------------|
| [workflows/proof-of-reserve/index.ts](workflows/proof-of-reserve/index.ts) | CronCapability, HTTPClient (`/inventory`), EVMClient (`totalMinted()` read + report write) |
| [workflows/physical-attributes/index.ts](workflows/physical-attributes/index.ts) | CronCapability, HTTPClient (`/portfolio/summary` + `/casks/batch`), report write |
| [workflows/lifecycle-webhook/index.ts](workflows/lifecycle-webhook/index.ts) | HTTPCapability (webhook trigger), report write |
| [workflows/lifecycle-reconcile/index.ts](workflows/lifecycle-reconcile/index.ts) | CronCapability, HTTPClient (`/lifecycle/recent`), report write |

### CRE Shared Infrastructure

| File | What It Does |
|------|-------------|
| [workflows/shared/cre-runtime.ts](workflows/shared/cre-runtime.ts) | CRE SDK facade: typed runtime, `loadCreSdk()`, `httpGetJson()`, `submitReport()`, `resolveSnapshotAsOf()`, `resolveTotalTokenSupply()` |
| [workflows/shared/cre-sdk.ts](workflows/shared/cre-sdk.ts) | Type-only CRE SDK binding (`CreSdkTypeBinding`) |
| [workflows/shared/report-encoding.ts](workflows/shared/report-encoding.ts) | ABI encoding for all 4 report types, matching Solidity structs exactly |
| [workflows/shared/contract-mapping.ts](workflows/shared/contract-mapping.ts) | API-to-contract type transforms with exhaustive enum mappings |

### CRE Workflow Manifests (CRE CLI configuration)

| File | Trigger |
|------|---------|
| [workflows/proof-of-reserve/workflow.yaml](workflows/proof-of-reserve/workflow.yaml) | Cron (hourly) |
| [workflows/physical-attributes/workflow.yaml](workflows/physical-attributes/workflow.yaml) | Cron (daily) |
| [workflows/lifecycle-webhook/workflow.yaml](workflows/lifecycle-webhook/workflow.yaml) | HTTP trigger |
| [workflows/lifecycle-reconcile/workflow.yaml](workflows/lifecycle-reconcile/workflow.yaml) | Cron (daily) |
| [project.yaml](project.yaml) | Project-level CRE settings (RPC endpoints, chain selectors) |

### Smart Contract (CRE Report Receiver)

| File | CRE Integration |
|------|----------------|
| [contracts/src/WhiskyCaskVault.sol](contracts/src/WhiskyCaskVault.sol) | `onReport(bytes)` receiver, `keystoneForwarder` address, `onlyReportSource` modifier, report type dispatch |
| [contracts/src/interfaces/IWhiskyCaskVault.sol](contracts/src/interfaces/IWhiskyCaskVault.sol) | `ReportType` enum, report payload structs, `onReport()` signatures |
| [contracts/test/WhiskyCaskVault.t.sol](contracts/test/WhiskyCaskVault.t.sol) | Tests for KeystoneForwarder path, `onReport()` ACL, report routing |

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
