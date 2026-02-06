# CRE Workflow Design

> Source of truth: [FULL_MAP.md](FULL_MAP.md) section 8

## Summary

Architecture has 3 components, implemented as 4 workflows to remove trigger ambiguity:

| Workflow | Trigger | HTTP | EVM Read | EVM Write |
|----------|---------|------|----------|-----------|
| Proof of Reserve | Cron hourly | 1 | 1 | 1 |
| Physical Attribute Oracle | Cron daily | 2 | 0 | 1 |
| Lifecycle Webhook | HTTP webhook | 0-1 | 0 | 1 |
| Lifecycle Reconcile | Cron daily | 1 | 0 | 1 |

## Locked Rules

1. Proof of reserve uses `TOKENS_PER_CASK = 1000` for backing normalization.
2. PoR write mode is explicit per environment:
   - `public` for baseline simulation
   - `confidential` for privacy-track semantics
3. Physical Attribute Oracle writes Tier 1 gauge records + Tier 2 estimates. No required dollar-value writes. All gauge data in TTB-native units (proof gallons, wine gallons).
4. Lifecycle is split into webhook + reconcile workflows for deterministic behavior. Lifecycle events include gauge data (proof gallons, wine gallons, proof) when the event is a regauge or transfer.
5. Confidential HTTP is a capability swap on PoR fetch logic, not a redesign of downstream contract reads.

## Execution Budgets

- Proof of Reserve: 1 HTTP (`/inventory`) + 1 EVM read (`totalMinted()`) + 1 EVM write
- Physical Attribute Oracle: 2 HTTP (`/portfolio/summary` + `/cask/{id}/gauge-record`) + 1 EVM write (batch)
- Lifecycle Webhook: up to 1 HTTP + 1 EVM write
- Lifecycle Reconcile: 1 HTTP (`/cask/{id}/lifecycle`) + 1 EVM write

All are within expected CRE execution limits for hackathon scope.
