import type { Hex } from "viem";
import { encodeAbiParameters } from "viem";
import type {
  ContractCaskAttributesInput,
  ContractLifecycleReport,
  ReportType,
} from "./contract-mapping.js";
import { REPORT_TYPE } from "./contract-mapping.js";

const UINT8_AND_BYTES = [{ type: "uint8" }, { type: "bytes" }] as const;

function wrapReport(reportType: ReportType, payload: Hex): Hex {
  return encodeAbiParameters(UINT8_AND_BYTES, [reportType, payload]);
}

function assertBytes32(hexValue: Hex, label: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hexValue)) {
    throw new Error(`${label} must be bytes32 hex`);
  }
}

export interface ReserveAttestationPublicPayload {
  physicalCaskCount: bigint;
  totalTokenSupply: bigint;
  tokensPerCask: bigint;
  reserveRatio: bigint;
  timestamp: bigint;
  attestationHash: Hex;
}

export interface ReserveAttestationPrivatePayload {
  isFullyReserved: boolean;
  timestamp: bigint;
  attestationHash: Hex;
}

export function encodeReservePublicReport(payload: ReserveAttestationPublicPayload): Hex {
  assertBytes32(payload.attestationHash, "attestationHash");

  const encodedPayload = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "physicalCaskCount" },
          { type: "uint256", name: "totalTokenSupply" },
          { type: "uint256", name: "tokensPerCask" },
          { type: "uint256", name: "reserveRatio" },
          { type: "uint256", name: "timestamp" },
          { type: "bytes32", name: "attestationHash" },
        ],
      },
    ],
    [payload],
  );

  return wrapReport(REPORT_TYPE.RESERVE_PUBLIC, encodedPayload);
}

export function encodeReservePrivateReport(payload: ReserveAttestationPrivatePayload): Hex {
  assertBytes32(payload.attestationHash, "attestationHash");

  const encodedPayload = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "bool", name: "isFullyReserved" },
          { type: "uint256", name: "timestamp" },
          { type: "bytes32", name: "attestationHash" },
        ],
      },
    ],
    [payload],
  );

  return wrapReport(REPORT_TYPE.RESERVE_PRIVATE, encodedPayload);
}

export function encodeCaskBatchReport(updates: ContractCaskAttributesInput[]): Hex {
  const encodedPayload = encodeAbiParameters(
    [
      {
        type: "tuple[]",
        components: [
          { type: "uint256", name: "caskId" },
          {
            type: "tuple",
            name: "attributes",
            components: [
              { type: "uint8", name: "caskType" },
              { type: "uint8", name: "spiritType" },
              { type: "uint256", name: "fillDate" },
              { type: "uint256", name: "entryProofGallons" },
              { type: "uint256", name: "entryWineGallons" },
              { type: "uint16", name: "entryProof" },
              { type: "uint256", name: "lastGaugeProofGallons" },
              { type: "uint256", name: "lastGaugeWineGallons" },
              { type: "uint16", name: "lastGaugeProof" },
              { type: "uint256", name: "lastGaugeDate" },
              { type: "uint8", name: "lastGaugeMethod" },
              { type: "uint256", name: "estimatedProofGallons" },
              { type: "uint8", name: "state" },
              { type: "bytes16", name: "warehouseCode" },
            ],
          },
        ],
      },
    ],
    [updates],
  );

  return wrapReport(REPORT_TYPE.CASK_BATCH, encodedPayload);
}

export function encodeLifecycleReport(event: ContractLifecycleReport): Hex {
  const encodedPayload = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "caskId" },
          { type: "uint8", name: "toState" },
          { type: "uint256", name: "timestamp" },
          { type: "uint256", name: "gaugeProofGallons" },
          { type: "uint256", name: "gaugeWineGallons" },
          { type: "uint16", name: "gaugeProof" },
        ],
      },
    ],
    [event],
  );

  return wrapReport(REPORT_TYPE.LIFECYCLE, encodedPayload);
}
