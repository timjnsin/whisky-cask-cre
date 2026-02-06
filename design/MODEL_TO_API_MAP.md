# Financial Model -> API Mapping

> Source of truth for architecture: [FULL_MAP.md](FULL_MAP.md)

## Key Insight

Existing models answer: "Is the distillery a good investment?" (business-level P&L)
The API answers: "What are the verified physical attributes of this cask?" (asset-level data)

This is calibration, not a model port. Financial models provide priors for seed generation.

## Parameters Extracted for Seed Data

From v2 JS model (`brogue-financial-model.js`):

| Parameter | Value | Seed Data Usage |
|-----------|-------|----------------|
| Total barrels | 1,359 | Scale to 47 demo casks |
| Ready now (3-4yr) | 341 (25%) | 12 casks aged 36-48mo |
| Ready Q4 2027 (2-3yr) | 533 (39%) | 18 casks aged 24-36mo |
| Future aging (<2yr) | 332 (25%) | 11 casks aged 6-24mo |
| Premium (4+yr) | 153 (11%) | 6 casks aged 48-144mo |
| Acquisition cost | $1M / 1,359 ~= $736/barrel | Cost basis per cask |
| Bottles per barrel | 320 (base) | Bottle potential estimate |
| Quality loss factor | 0.98 | Bottle yield adjustment |

From v1 Python model (`distillery_model.py`):
- Angel's share: 4% base, 3.5% upside, 4.5% downside -> use 3.5% for Oregon climate seed assumptions
- 3-scenario framework for confidence ranges

## What Is Built New

- Per-cask angel's share model (compound annual volume loss)
- Cask type mapping (bourbon barrel, sherry butt, etc.)
- Regauge simulation (recent + stale regauge snapshots)
- Optional Tier 3 reference valuation curves calibrated to Knight Frank / RW101 (offchain reference only)

## Scope Guardrails

- Core oracle outputs are Tier 1 + Tier 2.
- Tier 3 valuation outputs are optional and clearly labeled model estimates.
- No required onchain NAV dependency for reserve or lifecycle components.
