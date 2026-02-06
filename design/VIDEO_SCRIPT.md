# Demo Video Script (5 minutes)

Target: 4:30-5:00. Tight. No filler.

## Pre-Production Notes

- Record in terminal (dark theme, large font, clean prompt)
- Architecture diagram as a static image (show 2-3 times at key moments)
- Code snippets: show briefly, narrate over, don't read line by line
- No slides with walls of text. If you show text, it's 1-2 sentences max.
- Tone: knowledgeable, direct, not salesy. Talk like you're explaining to a smart person who doesn't know whisky.

---

## COLD OPEN (0:00 - 0:30)

**[SCREEN: Black screen, white text]**

> "In 2025, Braeburn Whisky collapsed. $80 million in claimed cask assets. Thousands of investors couldn't verify whether their barrels existed."

**[SCREEN: Second line appears]**

> "There is no centralized ownership registry for whisky casks. Anywhere."

**[SCREEN: Cut to presenter / voiceover with terminal visible]**

**NARRATION:**

"Whisky cask investment has a trust problem. The broker says 'I have 47 casks.' The warehouse says 'yes.' Both parties have economic incentives to agree. That's self-attestation, not verification.

But here's the thing -- the data that proves a cask exists is already legally mandated. US bonded warehouses file monthly reports to the TTB. Per-barrel gauge records are required by federal law. The data exists. It's just locked in warehouse management systems, emailed as PDFs, and inaccessible onchain.

We built CRE infrastructure to change that."

---

## THE ARCHITECTURE (0:30 - 1:30)

**[SCREEN: Architecture diagram]**

**NARRATION:**

"Three CRE workflows. Each one fetches data from a warehouse API, reaches consensus across the DON, and writes a verified report to a Solidity contract on Sepolia.

**Workflow 1: Proof of Reserve.** Runs hourly. Fetches the warehouse inventory count, reads the token supply from the contract, computes the reserve ratio, and writes an attestation onchain. If someone mints tokens without casks to back them, the ratio drops below 1.0 and everyone can see it.

This is the core anti-fraud mechanism. If every token is backed by a CRE-attested inventory count, you cannot sell a barrel that doesn't exist.

**Workflow 2: Physical Attribute Oracle.** Runs daily. Fetches per-cask gauge records -- cask type, fill date, proof gallons, wine gallons, gauge method, warehouse code. Every field maps to a TTB-required measurement under 27 CFR 19.618. We also compute angel's share estimates, but those are clearly labeled as Tier 2 data -- math on top of measurements, not measurements themselves.

Any lending protocol or secondary market can read these attributes directly from the contract and build their own risk model. They don't need to trust our valuation. They have the raw data.

**Workflow 3: Lifecycle Provenance.** Event-driven. Records every state transition from fill to bottle as an immutable onchain event. Filled, maturation, regauged, transfer, bottling ready, bottled. Each transition carries gauge data when applicable. There's a webhook path for real-time events and a daily cron fallback to catch anything missed.

The result is an unbroken chain of custody for every cask."

---

## THE PRIVACY LAYER (1:30 - 2:15)

**[SCREEN: Architecture diagram with privacy highlighted, or code showing attestation mode toggle]**

**NARRATION:**

"Now here's the problem. A warehouse's aggregate inventory is commercially sensitive. If I put '47 casks at DSP number XYZ' on a public blockchain, I've just told every competitor in the industry exactly how much inventory that warehouse holds, what their acquisition patterns look like, and how fast they're moving product.

No warehouse will participate in a system that does that.

This is where Confidential HTTP comes in. It's a CRE capability that lets DON nodes fetch data from an API endpoint where the response payload is encrypted. The nodes can reach consensus on the data and compute a result -- 'casks greater than or equal to tokens, true or false' -- without the raw inventory count ever appearing onchain or in node logs.

The contract stores a boolean: `isFullyReserved`. Not the number. The warehouse participates because its competitive position isn't exposed. Without this privacy layer, the system is architecturally correct but commercially undeployable.

This is why we're targeting the Privacy track. Confidential HTTP is what makes the difference between a demo and something a real warehouse would actually use."

---

## LIVE DEMO (2:15 - 3:45)

**[SCREEN: Terminal]**

**NARRATION:**

"Let me show you this running."

**[ACTION: Start the warehouse API]**

```
npm run dev:api
```

"This is a Hono server serving 47 deterministically seeded casks. Each cask has TTB-native gauge records -- proof gallons, wine gallons, fill dates, lifecycle state. The seed data is realistic: bourbon barrels, sherry butts, hogsheads. Multiple warehouse codes. Casks in various lifecycle states."

**[ACTION: In second terminal, run simulations]**

```
npm run simulate:all
```

"This runs all four workflow simulations against the local API. Each simulation does exactly what the CRE runtime would do: fetch data, compute the report, ABI-encode it to match the Solidity structs, and log the result.

*(Point at output as it appears)*

The proof-of-reserve workflow: 47 physical casks, 47,000 token supply at 1,000 tokens per cask, reserve ratio 1.0, fully reserved. Plus an attestation hash -- a keccak256 of the inventory snapshot for tamper detection.

The physical attributes workflow: fetches recently changed casks, maps each gauge record to the contract's CaskAttributes struct. Cask type, spirit type, fill date, entry proof gallons, last gauge data, estimated current proof gallons from the angel's share model.

The lifecycle webhook: processes a state transition event. Cask moved from maturation to regauged, with new gauge measurements.

The lifecycle reconcile: daily fallback, catches any events the webhook missed."

**[ACTION: Run CRE CLI simulation]**

```
cre workflow simulate workflows/proof-of-reserve -T staging-settings --non-interactive --trigger-index 0
```

"Same workflow, now through the actual CRE CLI. This compiles the TypeScript to WASM and runs it in the CRE sandbox -- the same environment it would execute in on the DON. The output matches."

**[ACTION: Run Foundry tests]**

```
cd contracts && forge test -vvv
```

"Nine Foundry tests covering the contract: ACL enforcement, report routing for all four report types, lifecycle state transitions, zero-gauge preservation, ownership transfer, invalid report rejection. All passing."

---

## WHY IT MATTERS (3:45 - 4:30)

**[SCREEN: Architecture diagram or key stats overlay]**

**NARRATION:**

"So what does this actually unlock?

There are 39 million barrels of whisky maturing in warehouses right now. That's tens of billions of dollars in physical assets with no standardized data infrastructure.

**First: lending.** Scotland's Moveable Transactions Act came into force in April 2025. For the first time, lenders can take statutory pledges over whisky casks without physical delivery. They have the legal tools. What they don't have is the data layer -- proof that the collateral exists, current physical measurements, provenance trail. That's exactly what our oracle provides.

**Second: institutional trust.** Fund managers can't deploy capital into assets they can't independently verify. Today, verification means flying to Scotland, visiting warehouses, and cross-referencing paper Delivery Orders. Continuous on-chain attestation replaces point-in-time audits.

**Third: secondary markets.** The current cask market has weeks-long settlement and 20-40% round-trip friction. Tokenized casks with verified on-chain attributes enable real price discovery and composable DeFi integration.

And this pattern isn't whisky-specific. Any physically-held asset with regulated custody records -- wine, precious metals, commodities -- can use the same architecture. Privacy-preserving proof of reserve via CRE."

---

## CLOSE (4:30 - 5:00)

**[SCREEN: Terminal or architecture diagram]**

**NARRATION:**

"We don't tell you what a cask is worth. Valuation is a model output, not a measurement. We give you the verified physical facts -- from federally regulated warehouse records, through decentralized CRE consensus, onto a public blockchain -- and let you decide for yourself.

The data exists. It's legally mandated. We just made it accessible.

Thank you."

**[SCREEN: GitHub repo URL, project name, team name]**

---

## Timing Budget

| Section | Duration | Cumulative |
|---------|----------|------------|
| Cold open | 0:30 | 0:30 |
| Architecture | 1:00 | 1:30 |
| Privacy layer | 0:45 | 2:15 |
| Live demo | 1:30 | 3:45 |
| Why it matters | 0:45 | 4:30 |
| Close | 0:30 | 5:00 |

## Recording Notes

- Record terminal segments first, then narrate over them (easier to edit timing)
- Architecture diagram: create a clean SVG/PNG, keep it simple, show data flow left-to-right
- Font size in terminal: at least 16pt, dark background, light text
- If the CRE CLI simulation takes more than ~10 seconds, speed up the middle of the recording
- The forge test output is visually satisfying (green checkmarks) -- let it breathe for a moment
- Keep narration pace steady. Don't rush. 150 words per minute is the target.
- Total word count of narration above: ~950 words. At 150 wpm, that's ~6:20. **Needs trimming.** Cut the architecture section by ~100 words and the demo narration by ~50 words during recording. Or: let some sections play with just terminal output visible and no narration.
