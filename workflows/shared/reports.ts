import { reserveRatio, reserveStatus } from "../../api/src/services/attestation.js";
import { InventoryResponse } from "../../api/src/domain/types.js";
import { AttestationMode } from "./config.js";

export interface PublicReserveReport {
  mode: "public";
  physicalCaskCount: number;
  totalTokenSupply: number;
  tokensPerCask: number;
  reserveRatio: number;
  timestamp: string;
  attestationHash: `0x${string}`;
}

export interface ConfidentialReserveReport {
  mode: "confidential";
  isFullyReserved: boolean;
  timestamp: string;
  attestationHash: `0x${string}`;
}

export function buildReserveReport(params: {
  mode: AttestationMode;
  inventory: InventoryResponse;
  totalTokenSupply: number;
  tokensPerCask: number;
  timestamp: string;
}): PublicReserveReport | ConfidentialReserveReport {
  const isFullyReserved = reserveStatus(
    params.inventory.physical_cask_count,
    params.totalTokenSupply,
    params.tokensPerCask,
  );

  if (params.mode === "confidential") {
    return {
      mode: "confidential",
      isFullyReserved,
      timestamp: params.timestamp,
      attestationHash: params.inventory.attestation_hash,
    };
  }

  return {
    mode: "public",
    physicalCaskCount: params.inventory.physical_cask_count,
    totalTokenSupply: params.totalTokenSupply,
    tokensPerCask: params.tokensPerCask,
    reserveRatio: reserveRatio(
      params.inventory.physical_cask_count,
      params.totalTokenSupply,
      params.tokensPerCask,
    ),
    timestamp: params.timestamp,
    attestationHash: params.inventory.attestation_hash,
  };
}
