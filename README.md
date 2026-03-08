# Whisky Cask CRE

Bonded whisky casks are already an investable real-world asset. Whisky Cask CRE makes them verifiable, reserve-backed, and financeable onchain with Chainlink CRE.

CRE infrastructure that pulls legally mandated warehouse records into a DON, reaches consensus on reserve and cask state, and writes verified reports to a Solidity contract on Sepolia. The project combines proof of reserve, per-cask physical attributes, and lifecycle provenance, with Confidential HTTP for privacy-preserving attestations.

## Why This Matters

Whisky is a genuinely interesting RWA category:

- It already trades as an investment asset.
- It lives in regulated custody.
- Its physical state changes over time in measurable ways.
- It is financeable, but the data infrastructure is still primitive.

People buy and sell casks, brokers intermediate deals, warehouses hold inventory, and lenders are starting to look at cask-backed structures. But the records that prove a cask exists, where it sits, and how much spirit is still inside are usually trapped in warehouse systems, PDFs, spreadsheets, and paper delivery orders.

That creates a serious verification gap. Investors can be shown a document, but they still cannot independently verify reserve coverage, physical state, or title history. The result is a market that is already valuable enough to matter, but still too opaque to safely bring online.

## The Problem

Recent whisky fraud cases made the failure mode obvious: investors were sold casks that could not be independently verified, and in some cases did not exist at all. This is not just a bad sales process. It is an infrastructure problem.

There is no universal cask registry. Each bonded warehouse maintains its own ledger. Ownership transfers are not standardized. Gauge data is not easily accessible to investors or protocols. Meanwhile, the underlying source data is often already regulated. In the US, bonded warehouses maintain per-cask records and storage reports under TTB rules. The data exists, but it is not available in a form onchain finance can use.

## What We Built

Whisky Cask CRE turns warehouse data into verifiable onchain state through four CRE workflows:

1. Proof of reserve
   Reads warehouse inventory, compares it to token supply, and publishes an attestation onchain.
2. Physical attribute oracle
   Publishes per-cask gauge data and modeled estimates for recently changed casks.
3. Lifecycle webhook
   Writes real-time cask lifecycle transitions from an external system into an immutable event trail.
4. Lifecycle reconcile
   Scans for recent lifecycle changes and backfills anything the webhook path missed.

The output is a cask dataset that can actually support tokenization, reserve audits, provenance, and eventually lending or secondary market infrastructure.

## Why Chainlink CRE

This project is not using Chainlink as branding. CRE is the actual execution layer that makes the architecture viable.

- Multiple DON nodes fetch and verify external warehouse data independently.
- The workflows combine external APIs, deterministic transforms, and EVM reads and writes.
- Confidential HTTP lets us prove reserve coverage without exposing raw inventory counts.
- Cron and HTTP triggers let us support both scheduled attestations and real-time lifecycle updates.

Without Chainlink CRE, this is either a centralized backend writing to a contract or a dashboard making unverifiable claims. The point of the project is to decentralize the reporting pipeline around a real-world data source that is commercially sensitive and operationally messy.

## Architecture

```text
Warehouse API                Chainlink CRE                 Smart Contract
-------------                -------------                 --------------

GET /inventory        --->   DON nodes fetch, verify,     ReserveAttestation
(count, proof gallons,       reach consensus, and         { physicalCaskCount,
 attestation hash)           submit report                 totalTokenSupply,
                                                            reserveRatio,
                                                            attestationHash }

GET /casks/batch      --->   DON consensus on per-cask    CaskAttributes[id]
(gauge records,              attributes and estimates     { caskType, fillDate,
 estimates)                                                   entryProofGallons,
                                                              lastGaugeProofGallons,
                                                              state, warehouseCode }

Webhook payload       --->   DON consensus on lifecycle   LifecycleTransition event
(regauge, transfer,          event payload                { caskId, fromState,
 bottling ready, etc.)                                       toState, timestamp,
                                                              gaugeProofGallons }
```

## Workflow Breakdown

### 1. Proof of Reserve

Runs on a cron. The workflow reads warehouse inventory, reads `totalMinted()` from the vault contract, computes reserve coverage, and submits an attestation. If a token issuer claims more casks than the warehouse reports, the reserve ratio drops below `1.0` and the mismatch is visible immediately.

In confidential mode, the raw inventory count is not posted onchain. The workflow publishes whether the system is fully reserved while keeping sensitive warehouse inventory data private.

### 2. Physical Attribute Oracle

Runs on a daily cron. The workflow fetches per-cask gauge records and estimate inputs for recently changed casks, then writes a batch update to the contract. Core gauge fields map cleanly to warehouse-native measurements such as proof gallons, wine gallons, proof, gauge method, and gauge date.

This means downstream applications do not have to trust our dashboard. They can read cask-level physical facts directly from the contract and price risk however they want.

### 3. Lifecycle Provenance

The webhook path records state transitions such as:

`filled -> maturation -> regauged -> transfer -> bottling_ready -> bottled`

Each transition can carry fresh gauge data when it exists. The webhook path handles real-time updates with zero HTTP reads because the data arrives in the trigger payload. A daily reconcile workflow catches anything that was missed and keeps the onchain lifecycle trail consistent.

## Why Whisky Is the Hook

Whisky is a weirdly good fit for onchain RWA infrastructure.

- It is already treated like an investment product.
- Time changes the asset itself. Aging can improve value while evaporation reduces supply.
- Warehouses already hold the source data needed for reserve checks and physical verification.
- The asset is semi-fungible enough to support pooled ownership and structured products, but physical enough that provenance and custody still matter.

That combination is rare. Most RWAs either have weak custody data, poor standardization, or no natural reason to live online. Whisky has a real market and a real verification problem, which is exactly where CRE is strongest.

## Why Privacy Matters

A warehouse may be willing to prove reserve coverage, but not willing to expose its full inventory position to the public. Raw barrel counts can reveal purchasing patterns, supplier relationships, inventory velocity, and broader business health.

Confidential HTTP solves that problem. DON nodes can fetch encrypted inventory data, compute the result, and publish the attestation without exposing the underlying payload onchain or in logs. That makes the design commercially plausible instead of just technically interesting.

## Data Honesty

We use warehouse-native units throughout:

- Proof gallons (PG)
- Wine gallons (WG)
- Proof
- Gauge date
- Gauge method

`PG = WG x (proof / 100)`

The data model has three explicit tiers:

| Tier | What | Source | Example |
|------|------|--------|---------|
| 1: Verified facts | Warehouse and regulatory records | Gauge records | Cask exists, fill date, entry proof gallons, last regauge |
| 2: Computed estimates | Deterministic math on tier 1 data | Angel's share model | Estimated current proof gallons, bottle yield |
| 3: Market opinions | External comps or valuation models | Reference only | Age curve valuation |

We label estimates as estimates. We do not present modeled outputs as if they were measured warehouse facts.

## What This Enables

If this pattern is deployed against a real warehouse integration, it unlocks infrastructure that is hard to build today:

- Token reserve verification for cask-backed products
- Onchain collateral monitoring for lenders
- Provenance-aware secondary markets
- Standardized cask data feeds for brokers, custodians, and marketplaces

Whisky is the demo asset, but the pattern generalizes to other custodied commodities with regulated records.

## CRE Execution Budgets

All workflows fit within CRE limits.

| Workflow | Trigger | HTTP | EVM Read | EVM Write |
|----------|---------|------|----------|-----------|
| Proof of reserve | Cron (hourly) | 1 | 1 | 1 |
| Physical attributes | Cron (daily) | 2 | 0 | 1 |
| Lifecycle webhook | HTTP trigger | 0 | 0 | 1 |
| Lifecycle reconcile | Cron (daily) | 1 | 1 | 1 |

Cron-based workflows use deterministic snapshot timestamps with `resolveSnapshotAsOf` and `?asOf=` query params so every DON node evaluates the same data window. The webhook workflow requires an explicit event timestamp in the trigger payload.

## Submission Map

If you only open a few files, use these:

- `README.md` for the narrative and runbook
- `contracts/src/WhiskyCaskVault.sol` for onchain report ingestion
- `workflows/proof-of-reserve/index.ts` for public vs confidential proof of reserve logic
- `workflows/shared/cre-runtime.ts` for the CRE integration layer
- `api/src/index.ts` for the warehouse API
- `dashboard/app/page.tsx` for the reserve dashboard

Supporting design docs live in `design/` as markdown only.

## Quick Start

```bash
# Install dependencies and seed mock warehouse data
npm install
npm run seed

# Optional: define API and workflow env vars
cp .env.example .env

# Start the warehouse API
npm run dev:api
```

For the fastest end-to-end local demo, use one command:

```bash
npm run demo:all
```

If you want the manual path instead, use a second terminal:

```bash
# Run all 4 workflow simulations against the local API
npm run simulate:all

# Run the dashboard
npm run dev:dashboard
```

Proof-of-reserve staging defaults to `attestationMode: "confidential"` in `workflows/proof-of-reserve/config.staging.json`, so the main simulation path demonstrates the privacy-preserving report flow.

Dashboard env vars are documented in `dashboard/.env.example`.

To run a workflow through the CRE CLI:

```bash
cre workflow simulate workflows/proof-of-reserve -T staging-settings --non-interactive --trigger-index 0
```

By default, local and staging configs run in simulation mode with `submitReports: false`, so they do not broadcast onchain transactions.

To compile and test the Solidity contract:

```bash
cd contracts
forge build
forge test -vvv
```

## Files That Use Chainlink CRE

### CRE workflow entrypoints

| File | CRE capabilities used |
|------|------------------------|
| [workflows/proof-of-reserve/index.ts](workflows/proof-of-reserve/index.ts) | CronCapability, HTTPClient or ConfidentialHTTPClient, EVMClient, report submission |
| [workflows/physical-attributes/index.ts](workflows/physical-attributes/index.ts) | CronCapability, HTTPClient, report submission |
| [workflows/lifecycle-webhook/index.ts](workflows/lifecycle-webhook/index.ts) | HTTPCapability, report submission |
| [workflows/lifecycle-reconcile/index.ts](workflows/lifecycle-reconcile/index.ts) | CronCapability, HTTPClient, EVMClient, report submission |

### Supporting CRE infrastructure

| File | Role |
|------|------|
| [workflows/shared/cre-runtime.ts](workflows/shared/cre-runtime.ts) | CRE SDK facade for typed runtime, HTTP, EVM, and report submission |
| [workflows/shared/cre-sdk.ts](workflows/shared/cre-sdk.ts) | Type-only CRE SDK binding |
| [workflows/shared/report-encoding.ts](workflows/shared/report-encoding.ts) | ABI encoding for all report types |
| [workflows/shared/contract-mapping.ts](workflows/shared/contract-mapping.ts) | API-to-contract type transforms with exhaustive enum mappings |
| [workflows/*/workflow.yaml](workflows/) | CRE CLI workflow manifests |
| [project.yaml](project.yaml) | Project-level CRE settings |

### Smart contract receiver

| File | CRE integration |
|------|-----------------|
| [contracts/src/WhiskyCaskVault.sol](contracts/src/WhiskyCaskVault.sol) | `onReport(bytes)` receiver, `keystoneForwarder` ACL, report dispatch |
| [contracts/src/interfaces/IWhiskyCaskVault.sol](contracts/src/interfaces/IWhiskyCaskVault.sol) | `ReportType` enum and report payload structs |
| [contracts/test/WhiskyCaskVault.t.sol](contracts/test/WhiskyCaskVault.t.sol) | Contract tests for ACL, report routing, lifecycle rules, and pause control |

## Project Structure

```text
contracts/
  src/WhiskyCaskVault.sol              Onchain report consumer
  src/interfaces/IWhiskyCaskVault.sol  Enums, structs, interface
  test/WhiskyCaskVault.t.sol           Foundry tests
  script/Deploy.s.sol                  Sepolia deployment script

api/
  src/index.ts                         Hono server
  src/domain/types.ts                  Shared TypeScript types
  src/services/portfolio.ts            Portfolio store, batch logic, lifecycle logic
  src/services/seed.ts                 Deterministic 47-cask portfolio generator
  src/services/estimate.ts             Angel's share estimation model
  src/services/attestation.ts          Inventory attestation hash
  src/adapters/warehouse/              Warehouse adapter interface and mock implementation

workflows/
  shared/cre-runtime.ts                CRE runtime facade
  shared/report-encoding.ts            ABI encoding matching Solidity structs
  shared/contract-mapping.ts           API-to-contract type transforms
  proof-of-reserve/index.ts            Proof-of-reserve workflow
  physical-attributes/index.ts         Physical attributes workflow
  lifecycle-webhook/index.ts           Webhook-triggered lifecycle workflow
  lifecycle-reconcile/index.ts         Daily lifecycle reconcile workflow
  */workflow.ts                        Local simulation scripts
  */config.staging.json                Local and staging configs
  */config.production.json             Production configs
  */workflow.yaml                      CRE CLI workflow manifests

dashboard/
  app/page.tsx                         Reserve dashboard
  app/casks/page.tsx                   Cask explorer
  app/lifecycle/page.tsx               Lifecycle feed
  components/                          UI building blocks
  lib/contract.ts                      viem contract reads and attestation event reads
  lib/api.ts                           Typed warehouse API client
  .env.example                         Dashboard runtime config template

project.yaml                           CRE project settings
```

## Tech Stack

- CRE workflows: TypeScript, `@chainlink/cre-sdk`, Bun
- Smart contract: Solidity 0.8.24, Foundry
- Warehouse API: TypeScript, Hono
- Dashboard: Next.js 15 App Router, React, viem
- Chain: Ethereum Sepolia
- Encoding and validation: `viem`, `zod`

## Known Limitations

- Lifecycle reconcile is intentionally bounded per run, so very large backlogs may require multiple executions.
- The project demonstrates reserve verification and provenance, not full legal title transfer.
- The current repo uses a mock warehouse API. The production path is to connect the same workflows to a real warehouse or custodian system.

## Hackathon Context

Built for the [Chainlink Convergence Hackathon](https://chain.link/hackathon) (Feb 6 - Mar 1, 2026).
