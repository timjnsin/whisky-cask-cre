# CRE Workflow Design

> Source of truth: [FULL_MAP.md](FULL_MAP.md) section 8

## Summary

Architecture has 3 components, implemented as 4 workflows to remove trigger ambiguity:

| Workflow | Trigger | HTTP | EVM Read | EVM Write |
|----------|---------|------|----------|-----------|
| Proof of Reserve | Cron hourly | 1 | 1 | 1 |
| Physical Attribute Oracle | Cron daily | 2 | 0 | 1 |
| Lifecycle Webhook | HTTP webhook | 0 | 0 | 1 |
| Lifecycle Reconcile | Cron daily | 1 | 0 | 1 |

## Implementation Paths

Each workflow now has two code paths:

- Local simulation (`workflow.ts`): Node/`tsx`, fetch-based, quick debug loop.
- CRE runtime (`index.ts`): `Runner + cre.handler + capabilities + writeReport` path for managed execution.

Runtime entrypoints:

- `workflows/proof-of-reserve/index.ts`
- `workflows/physical-attributes/index.ts`
- `workflows/lifecycle-webhook/index.ts`
- `workflows/lifecycle-reconcile/index.ts`

## Locked Rules

1. Proof of reserve uses `TOKENS_PER_CASK = 1000` for backing normalization.
2. PoR write mode is explicit per environment:
   - `public` for baseline simulation
   - `confidential` for privacy-track semantics
3. Physical Attribute Oracle writes Tier 1 gauge records + Tier 2 estimates. No required dollar-value writes. All gauge data in TTB-native units (proof gallons, wine gallons, proof).
4. Lifecycle is split into webhook + reconcile workflows for deterministic behavior. Lifecycle events include gauge data (proof gallons, wine gallons, proof) when the event is a regauge or transfer.
5. Confidential HTTP is a capability swap on PoR fetch logic, not a redesign of downstream contract reads.

## Execution Budgets

- Proof of Reserve: 1 HTTP (`/inventory`) + 1 EVM read (`totalMinted()`) + 1 EVM write
- Physical Attribute Oracle: 2 HTTP (`/portfolio/summary` + `/casks/batch`) + 1 EVM write (batch)
- Lifecycle Webhook: 0 HTTP + 1 EVM write (trigger payload is canonical source in CRE runtime path)
- Lifecycle Reconcile: 1 HTTP (`/lifecycle/recent`) + 1 EVM write

All are within expected CRE execution limits for hackathon scope.

## Deterministic Snapshot Strategy

- Cron workflows derive a shared snapshot timestamp from trigger payload (`scheduledExecutionTime`) and append it as `asOf` query param.
- Warehouse API supports `asOf` across key read endpoints to avoid node-by-node timestamp drift during `consensusIdenticalAggregation`.
- This keeps CRE node responses byte-stable for consensus while preserving TTB-shaped response schemas.

## Report Envelope Contract

All CRE runtime workflows encode report payloads as:

`abi.encode(uint8 reportType, bytes payload)`

Report type mapping:

- `0` = `RESERVE_PUBLIC`
- `1` = `RESERVE_PRIVATE`
- `2` = `CASK_BATCH`
- `3` = `LIFECYCLE`

Encoding helpers live in `workflows/shared/report-encoding.ts`.
