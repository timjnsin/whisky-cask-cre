import {
  CaskRecord,
  CaskType,
  GaugeMethod,
  LifecycleEvent,
  LifecycleState,
  PortfolioData,
  SpiritType,
} from "../domain/types.js";
import {
  daysBetween,
  proofGallons,
  round1,
  round2,
  subtractDays,
  subtractMonths,
} from "../domain/units.js";

interface Cohort {
  count: number;
  minMonths: number;
  maxMonths: number;
}

const COHORTS: Cohort[] = [
  { count: 12, minMonths: 36, maxMonths: 48 },
  { count: 18, minMonths: 24, maxMonths: 36 },
  { count: 11, minMonths: 6, maxMonths: 24 },
  { count: 6, minMonths: 48, maxMonths: 144 },
];

const CASK_CAPACITY_WG: Record<CaskType, number> = {
  bourbon_barrel: 53,
  sherry_butt: 132,
  hogshead: 63,
  port_pipe: 145,
};

class SeededRng {
  private state: number;

  constructor(seed: string) {
    this.state = hash(seed);
  }

  next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)] as T;
  }
}

function hash(input: string): number {
  let h = 1779033703;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function monthLetter(month: number): string {
  return "ABCDEFGHIJKL"[month] ?? "A";
}

function packageId(caskId: number, fillDateIso: string): string {
  const dt = new Date(fillDateIso);
  const yy = String(dt.getUTCFullYear() % 100).padStart(2, "0");
  const mm = monthLetter(dt.getUTCMonth());
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const serial = String(caskId).padStart(4, "0");
  return `PKG-${yy}${mm}${dd}-${serial}`;
}

function randomCaskType(rng: SeededRng): CaskType {
  const roll = rng.next();
  if (roll < 0.55) return "bourbon_barrel";
  if (roll < 0.77) return "hogshead";
  if (roll < 0.93) return "sherry_butt";
  return "port_pipe";
}

function randomSpiritType(rng: SeededRng): SpiritType {
  const roll = rng.next();
  if (roll < 0.6) return "bourbon";
  if (roll < 0.8) return "rye";
  if (roll < 0.95) return "malt";
  return "wheat";
}

function selectGaugeMethod(caskId: number, ageMonths: number, rng: SeededRng): GaugeMethod {
  if (ageMonths < 24) return caskId % 5 === 0 ? "wet_dip" : "entry";
  if (caskId % 11 === 0) return "disgorge";
  if (caskId % 7 === 0) return "transfer";
  if (caskId % 3 === 0) return "wet_dip";
  return rng.next() < 0.3 ? "wet_dip" : "entry";
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function addDays(iso: string, days: number): string {
  const dt = new Date(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString();
}

export function generatePortfolioData(asOf = new Date().toISOString()): PortfolioData {
  const rng = new SeededRng("whisky-cask-cre-ttb-v1");

  const ages: number[] = [];
  for (const cohort of COHORTS) {
    for (let i = 0; i < cohort.count; i += 1) {
      ages.push(rng.int(cohort.minMonths, cohort.maxMonths));
    }
  }

  const casks: CaskRecord[] = ages.map((ageMonths, index) => {
    const caskId = index + 1;
    const caskType = randomCaskType(rng);
    const spiritType = randomSpiritType(rng);
    const angelShareRate = round2(0.03 + rng.next() * 0.015);
    const qualityFactor = round2(0.95 + rng.next() * 0.04);

    const fillDate = subtractMonths(asOf, ageMonths);
    const entryWineGallons = round2(CASK_CAPACITY_WG[caskType] * (0.95 + rng.next() * 0.05));
    const entryProof = round1(118 + rng.next() * 10);
    const entryProofGallons = proofGallons(entryWineGallons, entryProof);

    const lastGaugeMethod = selectGaugeMethod(caskId, ageMonths, rng);
    const staleGauge = caskId % 4 === 0 && ageMonths >= 24;
    const minNonEntryGaugeDate = addDays(fillDate, 30);
    const candidateLastGaugeDate =
      staleGauge
        ? subtractDays(asOf, rng.int(1100, 1600))
        : subtractDays(asOf, rng.int(30, 200));
    const lastGaugeDate =
      lastGaugeMethod === "entry"
        ? fillDate
        : maxIso(candidateLastGaugeDate, minNonEntryGaugeDate);

    let lastWineGallons = entryWineGallons;
    let lastProof = entryProof;
    let lastProofGallons = entryProofGallons;
    if (lastGaugeMethod !== "entry") {
      const yearsToLastGauge = daysBetween(fillDate, lastGaugeDate) / 365;
      lastWineGallons = round2(entryWineGallons * Math.pow(1 - angelShareRate, yearsToLastGauge));
      const proofDrift = lastGaugeMethod === "disgorge" ? rng.next() * 2 : rng.next() * 6;
      lastProof = round1(Math.max(95, entryProof - proofDrift));
      lastProofGallons = proofGallons(lastWineGallons, lastProof);
    }

    let state: LifecycleState = ageMonths < 4 ? "filled" : "maturation";
    if (lastGaugeMethod !== "entry") state = "regauged";
    if (ageMonths >= 120) state = "bottling_ready";
    if (ageMonths >= 132 && caskId % 13 === 0) state = "bottled";

    const lifecycle: LifecycleEvent[] = [
      {
        caskId,
        fromState: "filled",
        toState: "maturation",
        timestamp: fillDate,
        gaugeProofGallons: entryProofGallons,
        gaugeWineGallons: entryWineGallons,
        gaugeProof: entryProof,
        reason: "fill",
      },
    ];

    if (lastGaugeMethod !== "entry") {
      lifecycle.push({
        caskId,
        fromState: "maturation",
        toState: "regauged",
        timestamp: lastGaugeDate,
        gaugeProofGallons: lastProofGallons,
        gaugeWineGallons: lastWineGallons,
        gaugeProof: lastProof,
        reason: lastGaugeMethod === "transfer" ? "transfer" : "regauge",
      });
    }

    if (state === "bottling_ready") {
      lifecycle.push({
        caskId,
        fromState: lastGaugeMethod === "entry" ? "maturation" : "regauged",
        toState: "bottling_ready",
        timestamp: subtractDays(asOf, rng.int(10, 80)),
        gaugeProofGallons: 0,
        gaugeWineGallons: 0,
        gaugeProof: 0,
        reason: "bottling",
      });
    }

    if (state === "bottled") {
      lifecycle.push({
        caskId,
        fromState: "bottling_ready",
        toState: "bottled",
        timestamp: subtractDays(asOf, rng.int(2, 30)),
        gaugeProofGallons: 0,
        gaugeWineGallons: 0,
        gaugeProof: 0,
        reason: "bottling",
      });
    }

    const updatedAt = lifecycle.reduce((max, event) => maxIso(max, event.timestamp), fillDate);

    return {
      caskId,
      packageId: packageId(caskId, fillDate),
      spiritType,
      caskType,
      dspNumber: "DSP-OR-15001",
      warehouseId: caskId % 3 === 0 ? "WH-OR-002" : "WH-OR-001",
      fillDate,
      entryGauge: {
        proofGallons: entryProofGallons,
        wineGallons: entryWineGallons,
        proof: entryProof,
        date: fillDate,
        method: "entry",
      },
      lastGauge: {
        proofGallons: lastProofGallons,
        wineGallons: lastWineGallons,
        proof: lastProof,
        date: lastGaugeDate,
        method: lastGaugeMethod,
      },
      state,
      angelShareRate,
      qualityFactor,
      lifecycle: lifecycle.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      updatedAt,
    };
  });

  return {
    schemaVersion: "warehouse-mock-v1",
    generatedAt: asOf,
    casks,
  };
}
