import "server-only";

import { getInventory, nowAsOf } from "@/lib/api";
import { readAttestationLog, readReserveState } from "@/lib/contract";
import { AttestationMode, DashboardReserveData } from "@/lib/types";

const ZERO_HASH: `0x${string}` =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const RATIO_SCALE = 10n ** 18n;

function defaultMode(): AttestationMode {
  return process.env.NEXT_PUBLIC_DEFAULT_MODE === "confidential" ? "confidential" : "public";
}

function defaultTokenSupply(): bigint {
  const value = process.env.NEXT_PUBLIC_TOKEN_SUPPLY_UNITS;
  if (value && /^\d+$/.test(value)) return BigInt(value);
  return 47_000n;
}

function defaultTokensPerCask(): bigint {
  const value = process.env.NEXT_PUBLIC_TOKENS_PER_CASK;
  if (value && /^\d+$/.test(value)) return BigInt(value);
  return 1_000n;
}

function isoToUnixSeconds(iso: string): bigint {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0n;
  return BigInt(Math.floor(ms / 1000));
}

export async function getDashboardReserveData(): Promise<DashboardReserveData> {
  const warnings: string[] = [];
  const asOf = nowAsOf();

  const inventoryPromise = getInventory(asOf).catch(() => null);
  const contractStatePromise = readReserveState();

  const [inventory, contractState] = await Promise.all([inventoryPromise, contractStatePromise]);

  if (!inventory) {
    warnings.push("Warehouse API unavailable; reserve aggregates may be incomplete.");
  }
  if (!contractState.available) {
    warnings.push("Contract reads unavailable; dashboard is using local fallback values.");
  }

  const mode = contractState.available ? contractState.mode : defaultMode();

  const fallbackTokenSupply = defaultTokenSupply();
  const fallbackTokensPerCask = defaultTokensPerCask();

  let tokenSupply = contractState.totalMinted > 0n ? contractState.totalMinted : fallbackTokenSupply;
  let tokensPerCask = fallbackTokensPerCask;
  let reserveRatio = 0n;
  let isFullyReserved = false;
  let physicalCaskCount = inventory?.physical_cask_count ?? 0;
  let totalProofGallons = inventory?.totals.proof_gallons ?? 0;
  let lastAttestationTimestamp = 0n;
  let attestationHash = ZERO_HASH;

  if (mode === "confidential") {
    if (contractState.available && contractState.privateAttestation.timestamp > 0n) {
      isFullyReserved = contractState.privateAttestation.isFullyReserved;
      lastAttestationTimestamp = contractState.privateAttestation.timestamp;
      attestationHash = contractState.privateAttestation.attestationHash;
    } else {
      isFullyReserved =
        tokenSupply > 0n && BigInt(physicalCaskCount) * tokensPerCask >= tokenSupply;
      lastAttestationTimestamp = inventory ? isoToUnixSeconds(inventory.as_of) : 0n;
      attestationHash = inventory?.attestation_hash ?? ZERO_HASH;
    }

    reserveRatio = isFullyReserved ? RATIO_SCALE : 0n;
  } else {
    if (contractState.available && contractState.publicAttestation.timestamp > 0n) {
      const publicAttestation = contractState.publicAttestation;
      physicalCaskCount = Number(publicAttestation.physicalCaskCount);
      tokenSupply = publicAttestation.totalTokenSupply > 0n ? publicAttestation.totalTokenSupply : tokenSupply;
      tokensPerCask =
        publicAttestation.tokensPerCask > 0n ? publicAttestation.tokensPerCask : tokensPerCask;
      reserveRatio = publicAttestation.reserveRatio;
      lastAttestationTimestamp = publicAttestation.timestamp;
      attestationHash = publicAttestation.attestationHash;
      isFullyReserved = reserveRatio >= RATIO_SCALE;
    } else {
      const numerator = BigInt(physicalCaskCount) * tokensPerCask * RATIO_SCALE;
      reserveRatio = tokenSupply > 0n ? numerator / tokenSupply : 0n;
      isFullyReserved = reserveRatio >= RATIO_SCALE;
      lastAttestationTimestamp = inventory ? isoToUnixSeconds(inventory.as_of) : 0n;
      attestationHash = inventory?.attestation_hash ?? ZERO_HASH;
    }
  }

  let attestationLog = contractState.available ? await readAttestationLog(mode, 25) : [];

  if (attestationLog.length === 0 && lastAttestationTimestamp > 0n) {
    attestationLog = [
      {
        mode,
        timestamp: lastAttestationTimestamp,
        attestationHash,
        blockNumber: 0n,
        txHash: ZERO_HASH,
        ...(mode === "confidential"
          ? { isFullyReserved }
          : {
              physicalCaskCount: BigInt(physicalCaskCount),
              totalTokenSupply: tokenSupply,
              tokensPerCask,
              reserveRatio,
            }),
      },
    ];
  }

  return {
    mode,
    contractAvailable: contractState.available,
    tokenSupply,
    tokensPerCask,
    isFullyReserved,
    reserveRatio,
    physicalCaskCount,
    totalProofGallons,
    lastAttestationTimestamp,
    attestationHash,
    attestationLog,
    asOf,
    warnings,
  };
}

export async function getDashboardMode(): Promise<AttestationMode> {
  const state = await readReserveState();
  return state.available ? state.mode : defaultMode();
}
