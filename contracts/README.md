# Contracts

Day-1 contract scope is storage and report consumption for:

- Per-cask gauge record attributes
- Public/private reserve attestations
- Lifecycle transition events
- `onReport` payload decoding for Keystone-style report forwarding

## Notes

- `WhiskyCaskVault.sol` is a clean baseline for workflow integration.
- `warehouseCode` is stored as `bytes16` to avoid dynamic string storage overhead.
- Full ERC-1155 token logic is intentionally deferred to avoid conflating reserve oracle validation with tokenomics implementation.
- Add Foundry tests before deploying to Sepolia.
