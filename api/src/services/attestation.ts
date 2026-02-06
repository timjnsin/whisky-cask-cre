import { keccak256, toHex } from "viem";
import { InventoryResponse } from "../domain/types.js";

export function computeInventoryAttestationHash(payload: {
  as_of: string;
  active_cask_ids_sorted: number[];
}): `0x${string}` {
  const canonical = {
    schema_version: "por-v1",
    as_of: payload.as_of,
    active_cask_ids_sorted: payload.active_cask_ids_sorted,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  return keccak256(toHex(bytes));
}

export function reserveRatio(
  physicalCaskCount: number,
  totalTokenSupply: number,
  tokensPerCask: number,
): number {
  if (totalTokenSupply <= 0) return 0;
  return (physicalCaskCount * tokensPerCask) / totalTokenSupply;
}

export function reserveStatus(
  physicalCaskCount: number,
  totalTokenSupply: number,
  tokensPerCask: number,
): boolean {
  return physicalCaskCount * tokensPerCask >= totalTokenSupply;
}

export function buildInventoryResponse(input: {
  asOf: string;
  activeIds: number[];
  totalProofGallons: number;
  totalWineGallons: number;
}): InventoryResponse {
  const activeIdsSorted = [...input.activeIds].sort((a, b) => a - b);
  return {
    schema_version: "por-v1",
    as_of: input.asOf,
    active_cask_ids_sorted: activeIdsSorted,
    physical_cask_count: activeIdsSorted.length,
    ttb_form_reference: "TTB-F-5110.11",
    totals: {
      proof_gallons: input.totalProofGallons,
      wine_gallons: input.totalWineGallons,
    },
    attestation_hash: computeInventoryAttestationHash({
      as_of: input.asOf,
      active_cask_ids_sorted: activeIdsSorted,
    }),
  };
}
