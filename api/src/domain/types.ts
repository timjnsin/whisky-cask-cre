export const TOKENS_PER_CASK_DEFAULT = 1000;

export type SpiritType = "bourbon" | "rye" | "malt" | "wheat";

export type CaskType = "bourbon_barrel" | "sherry_butt" | "hogshead" | "port_pipe";

export type GaugeMethod = "entry" | "wet_dip" | "disgorge" | "transfer";

export type LifecycleState =
  | "filled"
  | "maturation"
  | "regauged"
  | "transfer"
  | "bottling_ready"
  | "bottled";

export interface GaugeSnapshot {
  proofGallons: number;
  wineGallons: number;
  proof: number;
  date: string;
  method: GaugeMethod;
}

export interface LifecycleEvent {
  caskId: number;
  fromState: LifecycleState;
  toState: LifecycleState;
  timestamp: string;
  gaugeProofGallons: number;
  gaugeWineGallons: number;
  gaugeProof: number;
  reason: "fill" | "regauge" | "transfer" | "bottling" | "reconcile";
}

export interface CaskRecord {
  caskId: number;
  packageId: string;
  spiritType: SpiritType;
  caskType: CaskType;
  dspNumber: string;
  warehouseId: string;
  fillDate: string;
  entryGauge: GaugeSnapshot;
  lastGauge: GaugeSnapshot;
  state: LifecycleState;
  angelShareRate: number;
  qualityFactor: number;
  lifecycle: LifecycleEvent[];
  updatedAt: string;
}

export interface PortfolioData {
  schemaVersion: "warehouse-mock-v1";
  generatedAt: string;
  casks: CaskRecord[];
}

export interface InventoryResponse {
  schema_version: "por-v1";
  as_of: string;
  active_cask_ids_sorted: number[];
  physical_cask_count: number;
  ttb_form_reference: "TTB-F-5110.11";
  totals: {
    proof_gallons: number;
    wine_gallons: number;
  };
  attestation_hash: `0x${string}`;
}

export interface GaugeRecordResponse {
  caskId: number;
  packageId: string;
  spiritType: SpiritType;
  caskType: CaskType;
  dspNumber: string;
  warehouseId: string;
  fillDate: string;
  entryProofGallons: number;
  entryWineGallons: number;
  entryProof: number;
  lastGaugeProofGallons: number;
  lastGaugeWineGallons: number;
  lastGaugeProof: number;
  lastGaugeDate: string;
  lastGaugeMethod: GaugeMethod;
  state: LifecycleState;
  updatedAt: string;
}

export interface EstimateResponse {
  caskId: number;
  estimatedCurrentProofGallons: number;
  estimatedBottleYield: number;
  modelVersion: "angels_share_v1";
  angelShareRate: number;
  daysSinceLastGauge: number;
}

export interface PortfolioSummaryResponse {
  asOf: string;
  totalCasks: number;
  totalLastGaugeProofGallons: number;
  totalEstimatedProofGallons: number;
  ageBucketsMonths: {
    "0_24": number;
    "24_36": number;
    "36_48": number;
    "48_plus": number;
  };
  recentlyChangedCaskIds: number[];
}

export interface MarketDataResponse {
  source: string;
  asOf: string;
  indexReference: {
    rw101QuarterlyDeltaPct: number;
    knightFrankAnnualDeltaPct: number;
  };
  notes: string;
}

export interface ReferenceValuationResponse {
  caskId: number;
  estimatedValueUsd: number;
  methodology: "age_curve_v1";
  confidence: "low" | "medium";
  asOf: string;
}

export interface LifecycleWebhookPayload {
  caskId: number;
  toState: LifecycleState;
  gaugeProofGallons?: number;
  gaugeWineGallons?: number;
  gaugeProof?: number;
  reason?: "regauge" | "transfer" | "bottling";
  timestamp?: string;
}
