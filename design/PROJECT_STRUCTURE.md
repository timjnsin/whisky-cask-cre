# Project Structure - Whisky Cask CRE Infrastructure

## Canonical Scope Lock

- Core system is proof of reserve + physical cask attributes + lifecycle provenance.
- This is not a NAV oracle.
- Tier-3 reference valuation remains optional/offchain.

## Repository Layout

```text
whisky-cask-cre/
|-- README.md
|-- package.json
|-- cre.config.json
|
|-- api/
|   `-- src/
|       |-- index.ts
|       |-- adapters/warehouse/
|       |-- domain/
|       |-- scripts/seed.ts
|       `-- services/
|
|-- workflows/
|   |-- shared/
|   |   |-- config.ts
|   |   |-- cre-runtime.ts
|   |   |-- report-encoding.ts
|   |   `-- contract-mapping.ts
|   |-- proof-of-reserve/
|   |   |-- workflow.ts      # local simulation
|   |   |-- index.ts         # CRE runtime entrypoint
|   |   `-- config.staging.json
|   |-- physical-attributes/
|   |   |-- workflow.ts
|   |   |-- index.ts
|   |   `-- config.staging.json
|   |-- lifecycle-webhook/
|   |   |-- workflow.ts
|   |   |-- index.ts
|   |   `-- config.staging.json
|   `-- lifecycle-reconcile/
|       |-- workflow.ts
|       |-- index.ts
|       `-- config.staging.json
|
|-- contracts/
|   |-- src/
|   |   |-- WhiskyCaskVault.sol
|   |   `-- interfaces/IWhiskyCaskVault.sol
|   |-- script/Deploy.s.sol
|   `-- foundry.toml
|
|-- design/
|-- demo/
`-- docs/
```

## Runtime Split

- `workflow.ts`: local script path for iterative dev + demo.
- `index.ts`: CRE runner path (`Runner`, triggers, capabilities, report submission).

This split keeps Day-1 velocity high while preserving direct migration to managed CRE execution.

## Config Pattern

Each workflow folder has `config.staging.json` with shared keys:

- `apiBaseUrl`
- `contractAddress`
- `chainSelector`
- `tokensPerCask`
- `attestationMode`

CRE runtime files also support:

- `submitReports`
- `reportGasLimit`
- `tokenSupplyUnits` (PoR fallback)
- workflow-specific keys (`schedule`, `scanLimit`, `webhookAuthorizedKeys`, `maxBatchSize`)
