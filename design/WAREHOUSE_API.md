# External Warehouse API Design

> Source of truth: [FULL_MAP.md](FULL_MAP.md) section 7

## Summary

TypeScript + Hono service on bun simulating what a DRAMS adapter would produce. Exposes cask data across three tiers using TTB-native field names and units (27 CFR Part 19).

- Tier 1: verifiable facts from gauge records (inventory, gauge records, lifecycle)
- Tier 2: computed estimates (current proof gallons, bottle yield), clearly labeled
- Tier 3: market reference data (optional), clearly labeled as model output

Backed by deterministic seeded mock data for reproducible hackathon simulation.

## Locked Rules

1. This API is the warehouse-facing data source for oracle infrastructure, not a valuation product.
2. Tier 3 reference valuation is optional and never required for core reserve/attribute/provenance flows.
3. Confidential mode must avoid onchain exposure of raw inventory counts.
4. Field names and units mirror 27 CFR 19.618/619 gauge record requirements. Proof gallons and wine gallons, not mL/ABV.

## Production Data Chain

```
DRAMS (warehouse mgmt system)
  └── WSDL/SOAP/XML web services
        └── Adapter (SOAP/XML → JSON, conforms to this spec)
              └── CRE nodes fetch via HTTP
```

For the hackathon, the mock API replaces the entire chain above. In production, a thin adapter translates DRAMS SOAP responses into this JSON shape.

## Canonical Attestation Hash (v1)

To avoid ambiguity across workflows and contract reads, the PoR hash input is fixed:

- Schema object (minified JSON, UTF-8 bytes):
  - `schema_version`: `"por-v1"`
  - `as_of`: ISO-8601 UTC timestamp
  - `active_cask_ids_sorted`: ascending numeric cask ID array
- Hash function: `keccak256` of that exact minified UTF-8 byte sequence

This hash is what gets written onchain in public/confidential reserve attestations.

## Gauge Record Fields (per 27 CFR 19.618/619)

Each cask's gauge record exposes these fields — directly mapped from TTB-mandated package records:

| API Field | Type | TTB Source | Unit / Scale |
|-----------|------|------------|--------------|
| `packageId` | string | Package identification (serial) | Unique per barrel |
| `spiritType` | string | Kind of spirits | `"bourbon"`, `"rye"`, `"malt"`, `"wheat"` |
| `caskType` | string | Cooperage description | `"bourbon_barrel"`, `"sherry_butt"`, `"hogshead"` |
| `dspNumber` | string | DSP plant number | e.g., `"DSP-OR-15001"` |
| `warehouseId` | string | Warehouse/plant number | e.g., `"WH-OR-001"` |
| `fillDate` | string | Date of original gauge | ISO-8601 |
| `entryProofGallons` | number | Proof gallons at fill | 2 decimal places (66.25 PG) |
| `entryWineGallons` | number | Wine gallons at fill | 2 decimal places (53.00 WG) |
| `entryProof` | number | Proof at fill | 1 decimal place (125.0°) |
| `lastGaugeProofGallons` | number | Proof gallons at most recent gauge | 2 decimal places |
| `lastGaugeWineGallons` | number | Wine gallons at most recent gauge | 2 decimal places |
| `lastGaugeProof` | number | Proof at most recent gauge | 1 decimal place |
| `lastGaugeDate` | string | Date of most recent gauge | ISO-8601 |
| `lastGaugeMethod` | string | How gauge was taken | `"entry"`, `"wet_dip"`, `"disgorge"`, `"transfer"` |
| `state` | string | Current lifecycle state | `"filled"`, `"maturation"`, `"regauged"`, `"bottled"`, etc. |

**Tier 2 estimate fields** (separate endpoint, clearly labeled):

| API Field | Type | Description |
|-----------|------|-------------|
| `estimatedCurrentProofGallons` | number | Model estimate, 2 decimal places |
| `estimatedBottleYield` | integer | Based on proof gallons + quality factor |
| `modelVersion` | string | e.g., `"angels_share_v1"` |
| `angelShareRate` | number | Annual rate used (e.g., 0.035 for 3.5%) |
| `daysSinceLastGauge` | integer | Data freshness indicator |

## CRE-Oriented Batch Endpoints

To stay within CRE HTTP execution limits, the API exposes batch/reconcile routes:

- `GET /casks/batch?ids=1,2,3&limit=20&asOf=<ISO-8601>`
  - Returns `gaugeRecord + estimate` for each requested cask in one response.
- `GET /lifecycle/recent?limit=100&asOf=<ISO-8601>`
  - Returns recent lifecycle events across casks for reconcile workflow replay.

Cron workflows should also pass `asOf` to:

- `GET /inventory`
- `GET /portfolio/summary`
- `GET /market-data`
- `GET /cask/:id/estimate`
- `GET /cask/:id/reference-valuation`

This ensures all DON nodes evaluate the same snapshot time when using identical consensus aggregation.

## Seed Portfolio Design

47 casks map proportionally to Brogue's 1,359-barrel inventory. See [MODEL_TO_API_MAP.md](MODEL_TO_API_MAP.md) for source model parameters.

Seed data requirements:
- Mix of spirit types (bourbon, rye, malt)
- Mix of cooperage (bourbon barrel, sherry butt, hogshead)
- Age distribution matching v2 model cohorts
- Recently regauged casks (gauge method: wet_dip, date within 6 months)
- Stale regauge casks (last gauge 3+ years ago, gauge method: entry)
- At least one disgorge gauge for accuracy contrast
- Realistic proof gallon ranges (50-70 PG entry for standard barrels)

This is required to show data freshness and estimation uncertainty.

## Hosting

- Localhost is the default for simulation.
- Deployment target can be selected later (Railway/Fly.io equivalent) and is not a design blocker.
