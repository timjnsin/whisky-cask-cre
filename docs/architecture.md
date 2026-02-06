# Architecture (Day 1)

## Components

1. Warehouse API (mock)
2. Workflow simulators (proof of reserve, attributes, lifecycle)
3. Onchain vault contract skeleton

## Extension points

- Adapter boundary for DRAMS SOAP/XML integration
- Attestation mode boundary (`public` vs `confidential`)
- Optional reference valuation endpoint/module for downstream products

## Data units

All gauge records are tracked in TTB-native units:

- proof gallons (2 decimal places)
- wine gallons (2 decimal places)
- proof degrees (1 decimal place)

## Current trust model

- Data source is a deterministic mock shaped like regulated warehouse records.
- CRE workflow scripts currently run in local simulation mode.
- Contract is report-consumer storage, not full production token stack.
