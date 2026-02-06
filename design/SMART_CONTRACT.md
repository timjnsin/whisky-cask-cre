# Smart Contract Design - WhiskyCaskVault

> Source of truth: [FULL_MAP.md](FULL_MAP.md) section 6

## Summary

ERC-1155 + IReceiver contract that accepts CRE reports through KeystoneForwarder `onReport()` and stores:
- Per-cask gauge records using TTB-native units (proof gallons, wine gallons, proof degrees)
- Proof-of-reserve attestations (public and confidential modes)
- Lifecycle transition events

## Locked Rules

1. Core contract scope is gauge records, reserves, and provenance. No mandatory onchain dollar valuation.
2. `TOKENS_PER_CASK = 1000` is the fixed conversion used for reserve normalization.
3. Two reserve attestation semantics are supported:
   - Public simulation mode: count, supply, ratio
   - Confidential mode: boolean reserve status + hash
4. Tier 3 reference valuation is optional and must be clearly labeled if ever stored.
5. All gauge data uses TTB-native units: proof gallons (scaled 1e2), wine gallons (scaled 1e2), proof (scaled 1e1). No mL/ABV conversions.

## Data Model Snapshot

### CaskAttributes (mirrors 27 CFR 19.618/619 gauge records)

Fields map directly to federally mandated package records:

- **Entry record:** `caskType`, `spiritType`, `fillDate`, `entryProofGallons`, `entryWineGallons`, `entryProof`
- **Last gauge:** `lastGaugeProofGallons`, `lastGaugeWineGallons`, `lastGaugeProof`, `lastGaugeDate`, `lastGaugeMethod`
- **Tier 2 estimate:** `estimatedProofGallons` (clearly separated from gauge data)
- **Lifecycle:** `state`, `warehouseCode` (`bytes16`, fixed-width storage)

See FULL_MAP.md section 6 for the full struct definition with scaling conventions.

### ReserveAttestationPublic
`physicalCaskCount`, `totalTokenSupply`, `tokensPerCask`, `reserveRatio` (1e18), `timestamp`, `attestationHash`

### ReserveAttestationPrivate
`isFullyReserved`, `timestamp`, `attestationHash`

### LifecycleTransition event
`caskId` (indexed), `fromState`, `toState`, `timestamp`, `gaugeProofGallons`, `gaugeWineGallons`, `gaugeProof` (all zero if not a gauge event)

### Report Ingestion

- Contract supports `onReport(bytes)` and `onReport(bytes,bytes)` entry points.
- Reports decode as `(reportType, payload)` and route to:
  - public reserve attestation update
  - private reserve attestation update
  - cask batch update
  - lifecycle transition update
- `keystoneForwarder` is explicitly configurable and accepted as a report source.

## Remaining Validation Items

1. Confirm KeystoneForwarder address on Sepolia from Chainlink docs.
2. Gas profile for 47-cask batch gauge record writes on Sepolia.
3. Proof gallon scaling: 1e2 gives 2 decimal places (66.25 PG → stored as 6625). Confirm this is sufficient precision for TTB reporting.
4. Keep canonical `attestationHash` serialization exactly aligned with `WAREHOUSE_API.md`.
5. `lastGaugeMethod` enum: 0=entry, 1=wet_dip, 2=disgorge, 3=transfer. Extensible if needed.
