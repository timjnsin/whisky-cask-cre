# Contracts

Day-1 contract scope is storage and report consumption for:

- Per-cask gauge record attributes
- Public/private reserve attestations
- Lifecycle transition events

## Notes

- `WhiskyCaskVault.sol` is a clean baseline for workflow integration.
- Full ERC-1155 token logic is intentionally deferred to avoid conflating reserve oracle validation with tokenomics implementation.
- Add Foundry tests before deploying to Sepolia.
