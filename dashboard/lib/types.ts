export type AttestationMode = "public" | "confidential";

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

export interface CaskBatchItem {
  gaugeRecord: GaugeRecordResponse;
  estimate: EstimateResponse;
}

export interface CaskBatchResponse {
  asOf: string;
  count: number;
  items: CaskBatchItem[];
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

export interface RecentLifecycleResponse {
  asOf: string;
  count: number;
  events: LifecycleEvent[];
}

export interface CaskLifecycleResponse {
  caskId: number;
  events: LifecycleEvent[];
}

export interface ReserveAttestationPrivate {
  isFullyReserved: boolean;
  timestamp: bigint;
  attestationHash: `0x${string}`;
}

export interface ReserveAttestationPublic {
  physicalCaskCount: bigint;
  totalTokenSupply: bigint;
  tokensPerCask: bigint;
  reserveRatio: bigint;
  timestamp: bigint;
  attestationHash: `0x${string}`;
}

export interface ContractReserveState {
  available: boolean;
  address?: `0x${string}`;
  mode: AttestationMode;
  publicAttestation: ReserveAttestationPublic;
  privateAttestation: ReserveAttestationPrivate;
  totalMinted: bigint;
}

export interface AttestationLogEntry {
  mode: AttestationMode;
  timestamp: bigint;
  attestationHash: `0x${string}`;
  blockNumber: bigint;
  txHash: `0x${string}`;
  isFullyReserved?: boolean;
  physicalCaskCount?: bigint;
  totalTokenSupply?: bigint;
  tokensPerCask?: bigint;
  reserveRatio?: bigint;
}

export interface DashboardReserveData {
  mode: AttestationMode;
  contractAvailable: boolean;
  tokenSupply: bigint;
  tokensPerCask: bigint;
  isFullyReserved: boolean;
  reserveRatio: bigint;
  physicalCaskCount: number;
  totalProofGallons: number;
  lastAttestationTimestamp: bigint;
  attestationHash: `0x${string}`;
  attestationLog: AttestationLogEntry[];
  asOf: string;
  warnings: string[];
}