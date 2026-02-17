import "server-only";

import {
  createPublicClient,
  http,
  parseAbi,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import { sepolia } from "viem/chains";
import {
  AttestationLogEntry,
  AttestationMode,
  ContractReserveState,
  ReserveAttestationPrivate,
  ReserveAttestationPublic,
} from "@/lib/types";

const VAULT_ABI = parseAbi([
  "function latestPublicReserveAttestation() view returns ((uint256 physicalCaskCount,uint256 totalTokenSupply,uint256 tokensPerCask,uint256 reserveRatio,uint256 timestamp,bytes32 attestationHash))",
  "function latestPrivateReserveAttestation() view returns ((bool isFullyReserved,uint256 timestamp,bytes32 attestationHash))",
  "function totalMinted() view returns (uint256)",
]);

const PRIVATE_EVENT = parseAbiItem(
  "event ReserveAttestationPrivateUpdated(bool isFullyReserved,uint256 timestamp,bytes32 attestationHash)",
);

const PUBLIC_EVENT = parseAbiItem(
  "event ReserveAttestationPublicUpdated(uint256 physicalCaskCount,uint256 totalTokenSupply,uint256 tokensPerCask,uint256 reserveRatio,uint256 timestamp,bytes32 attestationHash)",
);

const ZERO_TX_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function normalizeAddress(input: string | undefined): Address | undefined {
  if (!input) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(input)) return undefined;
  return input as Address;
}

function getVaultAddress(): Address | undefined {
  return normalizeAddress(process.env.NEXT_PUBLIC_VAULT_ADDRESS);
}

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
}

function getPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
}

function zeroPrivateAttestation(): ReserveAttestationPrivate {
  return {
    isFullyReserved: false,
    timestamp: 0n,
    attestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
}

function zeroPublicAttestation(): ReserveAttestationPublic {
  return {
    physicalCaskCount: 0n,
    totalTokenSupply: 0n,
    tokensPerCask: 0n,
    reserveRatio: 0n,
    timestamp: 0n,
    attestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
}

export async function readReserveState(): Promise<ContractReserveState> {
  const address = getVaultAddress();
  if (!address) {
    return {
      available: false,
      mode: "public",
      publicAttestation: zeroPublicAttestation(),
      privateAttestation: zeroPrivateAttestation(),
      totalMinted: 0n,
    };
  }

  const client = getPublicClient();

  try {
    const [publicAttestation, privateAttestation, totalMinted] = await Promise.all([
      client.readContract({
        address,
        abi: VAULT_ABI,
        functionName: "latestPublicReserveAttestation",
      }) as Promise<ReserveAttestationPublic>,
      client.readContract({
        address,
        abi: VAULT_ABI,
        functionName: "latestPrivateReserveAttestation",
      }) as Promise<ReserveAttestationPrivate>,
      client.readContract({
        address,
        abi: VAULT_ABI,
        functionName: "totalMinted",
      }) as Promise<bigint>,
    ]);

    const mode: AttestationMode =
      privateAttestation.timestamp >= publicAttestation.timestamp ? "confidential" : "public";

    return {
      available: true,
      address,
      mode,
      publicAttestation,
      privateAttestation,
      totalMinted,
    };
  } catch {
    return {
      available: false,
      mode: "public",
      publicAttestation: zeroPublicAttestation(),
      privateAttestation: zeroPrivateAttestation(),
      totalMinted: 0n,
    };
  }
}

async function resolveFromBlock(): Promise<bigint> {
  const configured = process.env.NEXT_PUBLIC_VAULT_DEPLOYMENT_BLOCK;
  if (configured && /^\d+$/.test(configured)) {
    return BigInt(configured);
  }

  const lookback = process.env.NEXT_PUBLIC_LOG_LOOKBACK_BLOCKS;
  const lookbackBlocks = lookback && /^\d+$/.test(lookback) ? BigInt(lookback) : 200_000n;

  const client = getPublicClient();
  const latestBlock = await client.getBlockNumber();
  return latestBlock > lookbackBlocks ? latestBlock - lookbackBlocks : 0n;
}

export async function readAttestationLog(
  mode: AttestationMode,
  limit = 25,
): Promise<AttestationLogEntry[]> {
  const address = getVaultAddress();
  if (!address) return [];

  const client = getPublicClient();
  const fromBlock = await resolveFromBlock();

  if (mode === "confidential") {
    const logs = await client.getLogs({
      address,
      event: PRIVATE_EVENT,
      fromBlock,
      toBlock: "latest",
    });

    return logs
      .map((log) => {
        const args = log.args as {
          isFullyReserved: boolean;
          timestamp: bigint;
          attestationHash: Hash;
        };

        return {
          mode,
          timestamp: args.timestamp,
          attestationHash: args.attestationHash,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? ZERO_TX_HASH,
          isFullyReserved: args.isFullyReserved,
        } satisfies AttestationLogEntry;
      })
      .sort((a, b) => Number(b.timestamp - a.timestamp))
      .slice(0, limit);
  }

  const logs = await client.getLogs({
    address,
    event: PUBLIC_EVENT,
    fromBlock,
    toBlock: "latest",
  });

  return logs
    .map((log) => {
      const args = log.args as {
        physicalCaskCount: bigint;
        totalTokenSupply: bigint;
        tokensPerCask: bigint;
        reserveRatio: bigint;
        timestamp: bigint;
        attestationHash: Hash;
      };

      return {
        mode,
        timestamp: args.timestamp,
        attestationHash: args.attestationHash,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? ZERO_TX_HASH,
        physicalCaskCount: args.physicalCaskCount,
        totalTokenSupply: args.totalTokenSupply,
        tokensPerCask: args.tokensPerCask,
        reserveRatio: args.reserveRatio,
      } satisfies AttestationLogEntry;
    })
    .sort((a, b) => Number(b.timestamp - a.timestamp))
    .slice(0, limit);
}
