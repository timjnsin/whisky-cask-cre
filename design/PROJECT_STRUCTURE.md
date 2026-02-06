# Project Structure - Whisky Cask CRE Infrastructure

## Canonical Scope Lock

- The core system is physical attributes + proof of reserve + lifecycle provenance.
- This is not a NAV oracle.
- Tier 3 reference valuation is optional and offchain-consumable.

## Repository Layout

```text
whisky-cask-cre/
|-- README.md                          # Hackathon submission README (links all Chainlink files)
|-- package.json                       # Root package for CRE workflows (bun)
|-- cre.config.json                    # CRE project config
|
|-- contracts/                         # Solidity smart contracts
|   |-- src/
|   |   |-- WhiskyCaskVault.sol        # Main consumer contract (receives CRE reports)
|   |   `-- interfaces/
|   |       `-- IWhiskyCaskVault.sol   # Interface definition
|   |-- test/
|   |   `-- WhiskyCaskVault.t.sol      # Foundry tests
|   |-- script/
|   |   `-- Deploy.s.sol               # Deployment script (Sepolia)
|   `-- foundry.toml
|
|-- workflows/                         # CRE workflows (TypeScript, compiled to WASM)
|   |-- proof-of-reserve/
|   |   |-- workflow.ts                # PoR workflow: fetch inventory, read token supply, write reserve status
|   |   `-- config.staging.json        # API URL, contract address, chain selector, mode
|   |-- physical-attributes/
|   |   |-- workflow.ts                # Attributes workflow: fetch per-cask attributes, compute estimates, batch write
|   |   `-- config.staging.json
|   `-- lifecycle/
|       |-- workflow.ts                # Lifecycle workflow: fetch events, write state transitions onchain
|       `-- config.staging.json
|
|-- api/                               # Mock warehouse API (TypeScript + Hono on bun)
|   |-- index.ts                       # Server entrypoint + routes
|   |-- seed.ts                        # Deterministic seed data generator
|   |-- types.ts                       # Cask, Regauge, Lifecycle types
|   `-- data/
|       `-- portfolio.json             # Generated seed portfolio (47 casks)
|
|-- frontend/                          # Optional dashboard for demo reads
|   `-- (TBD - only if time permits)
|
|-- demo/
|   |-- storyboard.md                  # Video storyboard
|   `-- scripts/                       # Demo simulation scripts
|
`-- docs/
    `-- architecture.md                # Architecture diagram and explanation
```

## Tech Stack

| Component | Tech | Why |
|-----------|------|-----|
| CRE Workflows | TypeScript + `@chainlink/cre-sdk` | Required by hackathon |
| Smart Contracts | Solidity + Foundry | Industry standard, fast testing |
| Mock Warehouse API | TypeScript + Hono (bun) | Same runtime as CRE, fewer moving parts |
| Chain | Ethereum Sepolia | Well-supported testnet, CRE compatible |
| Runtime | bun | Single runtime for API + CRE workflows |

## Day 1 Setup Commands (Feb 6)

```bash
# Install bun (CRE requirement)
curl -fsSL https://bun.sh/install | bash

# Install Foundry (smart contracts)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize CRE project
mkdir whisky-cask-cre && cd whisky-cask-cre
bun init
bun add @chainlink/cre-sdk zod
bunx cre-setup

# Initialize Foundry
cd contracts
forge init --no-git
forge install smartcontractkit/chainlink --no-git

# API shares the same bun runtime
bun add hono
```

## File Ownership (Who Builds What)

Since this is Tim solo + AI assist, the build order matters:

1. **Smart contract** (Feb 6-7) - smallest surface area, blocks everything else
2. **Warehouse API** (Feb 7-8) - needed for CRE workflows to call Tier 1/2 endpoints
3. **CRE workflows** (Feb 8-11) - PoR, physical attributes, lifecycle
4. **Privacy layer** (Feb 12+) - Confidential HTTP swap for PoR attestation
5. **Demo video** (Feb 25+) - last

## Config Management

Each CRE workflow has a `config.staging.json`:

```json
{
  "apiBaseUrl": "http://localhost:3000",
  "contractAddress": "0x...",
  "chainSelector": "ethereum-sepolia",
  "tokensPerCask": 1000,
  "attestationMode": "public"
}
```

Use per-workflow schedules in each workflow config (`hourly` for PoR, `daily` for attributes, event + daily fallback for lifecycle).
Secrets (API keys) are managed via CRE secrets capability and are not stored in config files.
