import type {
  CaskBatchItem,
  CaskType,
  GaugeMethod,
  LifecycleEvent,
  LifecycleState,
  SpiritType,
} from "../../api/src/domain/types.js";
import { toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import type { Hex } from "viem";

export const REPORT_TYPE = {
  RESERVE_PUBLIC: 0,
  RESERVE_PRIVATE: 1,
  CASK_BATCH: 2,
  LIFECYCLE: 3,
} as const;

export type ReportType = (typeof REPORT_TYPE)[keyof typeof REPORT_TYPE];

export interface ContractCaskAttributes {
  caskType: number;
  spiritType: number;
  fillDate: bigint;
  entryProofGallons: bigint;
  entryWineGallons: bigint;
  entryProof: number;
  lastGaugeProofGallons: bigint;
  lastGaugeWineGallons: bigint;
  lastGaugeProof: number;
  lastGaugeDate: bigint;
  lastGaugeMethod: number;
  estimatedProofGallons: bigint;
  state: number;
  warehouseCode: Hex;
}

export interface ContractCaskAttributesInput {
  caskId: bigint;
  attributes: ContractCaskAttributes;
}

export interface ContractLifecycleReport {
  caskId: bigint;
  toState: number;
  timestamp: bigint;
  gaugeProofGallons: bigint;
  gaugeWineGallons: bigint;
  gaugeProof: number;
}

function toUint16(value: bigint, label: string): number {
  if (value < 0n || value > 65535n) {
    throw new Error(`${label} out of uint16 range: ${value.toString()}`);
  }
  return Number(value);
}

export function caskTypeEnum(caskType: CaskType): number {
  switch (caskType) {
    case "bourbon_barrel":
      return 0;
    case "sherry_butt":
      return 1;
    case "hogshead":
      return 2;
    case "port_pipe":
      return 3;
    default: {
      const neverType: never = caskType;
      throw new Error(`Unsupported cask type: ${neverType}`);
    }
  }
}

export function spiritTypeEnum(spiritType: SpiritType): number {
  switch (spiritType) {
    case "bourbon":
      return 0;
    case "rye":
      return 1;
    case "malt":
      return 2;
    case "wheat":
      return 3;
    default: {
      const neverType: never = spiritType;
      throw new Error(`Unsupported spirit type: ${neverType}`);
    }
  }
}

export function gaugeMethodEnum(method: GaugeMethod): number {
  switch (method) {
    case "entry":
      return 0;
    case "wet_dip":
      return 1;
    case "disgorge":
      return 2;
    case "transfer":
      return 3;
    default: {
      const neverType: never = method;
      throw new Error(`Unsupported gauge method: ${neverType}`);
    }
  }
}

export function lifecycleStateEnum(state: LifecycleState): number {
  switch (state) {
    case "filled":
      return 0;
    case "maturation":
      return 1;
    case "regauged":
      return 2;
    case "transfer":
      return 3;
    case "bottling_ready":
      return 4;
    case "bottled":
      return 5;
    default: {
      const neverType: never = state;
      throw new Error(`Unsupported lifecycle state: ${neverType}`);
    }
  }
}

export function unixSeconds(isoTimestamp: string): bigint {
  return BigInt(Math.floor(new Date(isoTimestamp).getTime() / 1000));
}

export function warehouseCodeHex(warehouseId: string): Hex {
  const encoded = Buffer.from(warehouseId, "utf8").toString("hex").slice(0, 32);
  return `0x${encoded.padEnd(32, "0")}` as Hex;
}

export function mapBatchItemToContractInput(item: CaskBatchItem): ContractCaskAttributesInput {
  const entryProofScaled = toScaled1(item.gaugeRecord.entryProof);
  const lastGaugeProofScaled = toScaled1(item.gaugeRecord.lastGaugeProof);

  return {
    caskId: BigInt(item.gaugeRecord.caskId),
    attributes: {
      caskType: caskTypeEnum(item.gaugeRecord.caskType),
      spiritType: spiritTypeEnum(item.gaugeRecord.spiritType),
      fillDate: unixSeconds(item.gaugeRecord.fillDate),
      entryProofGallons: toScaled2(item.gaugeRecord.entryProofGallons),
      entryWineGallons: toScaled2(item.gaugeRecord.entryWineGallons),
      entryProof: toUint16(entryProofScaled, "entryProof"),
      lastGaugeProofGallons: toScaled2(item.gaugeRecord.lastGaugeProofGallons),
      lastGaugeWineGallons: toScaled2(item.gaugeRecord.lastGaugeWineGallons),
      lastGaugeProof: toUint16(lastGaugeProofScaled, "lastGaugeProof"),
      lastGaugeDate: unixSeconds(item.gaugeRecord.lastGaugeDate),
      lastGaugeMethod: gaugeMethodEnum(item.gaugeRecord.lastGaugeMethod),
      estimatedProofGallons: toScaled2(item.estimate.estimatedCurrentProofGallons),
      state: lifecycleStateEnum(item.gaugeRecord.state),
      warehouseCode: warehouseCodeHex(item.gaugeRecord.warehouseId),
    },
  };
}

export function mapLifecycleEventToContractReport(
  event: Pick<
    LifecycleEvent,
    "caskId" | "toState" | "timestamp" | "gaugeProofGallons" | "gaugeWineGallons" | "gaugeProof"
  >,
): ContractLifecycleReport {
  return {
    caskId: BigInt(event.caskId),
    toState: lifecycleStateEnum(event.toState),
    timestamp: unixSeconds(event.timestamp),
    gaugeProofGallons: toScaled2(event.gaugeProofGallons),
    gaugeWineGallons: toScaled2(event.gaugeWineGallons),
    gaugeProof: toUint16(toScaled1(event.gaugeProof), "gaugeProof"),
  };
}

