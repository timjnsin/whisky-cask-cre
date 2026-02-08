# Demo Video Storyboard (3-5 minutes)

## Target: 4 minutes

### Opening (0:00 - 0:30) - THE PROBLEM

**Visual:** Simple slides or screen recording of whisky auction sites and broker listings
**Script:**
> "Bonded warehouses maintain barrel-level gauge records mandated by 27 CFR Part 19 — proof gallons, cooperage, fill dates — and file monthly storage reports to the TTB. This data proves reserve status and physical attributes. But it's locked in warehouse management systems, emailed as spreadsheets, and arrives weeks late.
>
> We built CRE infrastructure to pipe verified warehouse data onchain in real time. Proof of reserve. Physical attributes. Lifecycle provenance. Privacy-preserving."

---

### Architecture Overview (0:30 - 1:15) - WHAT WE BUILT

**Visual:** Architecture diagram showing the four components

> "This is a CRE-powered system with three core components feeding one smart contract on Sepolia.
>
> **Proof of Reserve** - verifies physical backing against tokenized claims every hour.
>
> **Physical Attribute Oracle** - writes per-cask attributes and transparent Tier 2 estimates daily.
>
> **Lifecycle Provenance** - records state transitions as immutable onchain events, with webhook ingest plus daily reconciliation.
>
> The data source is a bun/Hono warehouse API. CRE nodes fetch, reach consensus, and write signed reports through KeystoneForwarder."

---

### Live Demo (1:15 - 3:00) - SHOW IT WORKING

#### Part A: The API (15 sec)
**Visual:** Terminal showing Hono endpoint calls
> "Here is our warehouse API with 47 seeded casks across multiple cask types and age bands."

Quick hit of:
- `GET /inventory` - show active package IDs and count (mirrors TTB F 5110.11)
- `GET /cask/1/gauge-record` - show entry gauge in proof gallons, cooperage type, spirit type

#### Part B: CRE Simulation - Proof of Reserve (30 sec)
**Visual:** Terminal running `cre simulate`
> "Now the proof-of-reserve workflow."

Show:
1. `cre workflow simulate workflows/proof-of-reserve -T staging-settings --non-interactive --trigger-index 0`
2. Console output: "active=47... totalTokenSupply=47000... tokensPerCask=1000... reserveRatioScaled1e18=1000000000000000000... submitReports=false"
3. Optional Sepolia verification if `submitReports=true` with a funded deployer key

#### Part C: CRE Simulation - Physical Attribute Oracle (30 sec)
**Visual:** Terminal
> "Now the physical attribute oracle."

Show:
1. `cre workflow simulate workflows/physical-attributes -T staging-settings --non-interactive --trigger-index 0`
2. Console output: "47 gauge records updated... estimate model: angels_share_v1"
3. Read from contract: `getCaskAttributes(1)` — show proof gallons, cooperage, last gauge date

#### Part D: CRE Simulation - Lifecycle (30 sec)
**Visual:** Terminal + contract read
> "And a lifecycle transition: cask 7 moves from regauged to transfer."

Show:
1. Trigger via HTTP payload: `{"caskId": 7, "toState": "transfer", "gaugeProofGallons": 46.5, "gaugeWineGallons": 39.25, "gaugeProof": 118.5}`
2. Console output: "Lifecycle transition recorded: cask 7, regauged -> transfer, 46.50 PG"
3. Contract read: `getCaskAttributes(7)` — show updated gauge data
4. `LifecycleTransition` event visible on Sepolia explorer with proof gallon values

---

### Privacy Layer (3:00 - 3:30) - IF SUBMITTED TO PRIVACY TRACK

**Visual:** Diagram showing confidential vs public data flows
> "Warehouse inventory data is commercially sensitive. With Confidential HTTP, we prove reserve sufficiency without exposing raw counts, warehouse relationships, or acquisition details.
>
> CRE nodes attest the computation. The contract receives boolean reserve status plus hash, not the raw inventory payload."

Show:
- Side-by-side: regular fetch (visible data) vs confidential fetch (redacted data)
- Equivalent reserve attestation result onchain

---

### Closing (3:30 - 4:00) - WHY THIS MATTERS

**Visual:** Return to slides
> "Every barrel in a bonded warehouse already has a federally mandated paper trail — TTB F 5110.11 storage reports, 27 CFR gauge records, daily transaction logs. We built the pipeline to get that data onchain, verified by CRE consensus, without exposing the warehouse's commercial position.
>
> Whisky casks are the demo. The pattern works for any physically held asset with sensitive custody data and an existing regulatory record-keeping requirement."

---

## Production Notes

- Record terminal demos first. Rehearse clean runs.
- Record voiceover separately for consistent audio quality.
- Keep architecture diagram simple and readable.
- Prioritize technical substance over visual polish.
- Keep total runtime under 4 minutes.
- End with GitHub link, Chainlink files, and team info.

## Demo Script Requirements

For reproducible demo runs, we need:
1. `demo/run_all.sh` - starts API, runs simulations in sequence
2. `demo/seed_tokens.sh` - mints initial token units on Sepolia for PoR comparison
3. Pre-recorded terminal sessions as backup
