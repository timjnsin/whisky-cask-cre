import { z } from "zod";
import type { Address, Hex } from "viem";
import { decodeFunctionResult, encodeFunctionData, zeroAddress } from "viem";

const TOTAL_MINTED_ABI = [
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const CHAIN_SELECTOR_ALIASES: Record<string, string> = {
  "ethereum-sepolia": "ethereum-testnet-sepolia",
};

export const baseCreConfigSchema = z.object({
  // CRE WASM runtime does not expose URL(), so avoid z.string().url().
  apiBaseUrl: z
    .string()
    .regex(/^https?:\/\/[^\s]+$/i, "Invalid URL"),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainSelector: z.string().min(1),
  tokensPerCask: z.number().int().positive().default(1000),
  attestationMode: z.enum(["public", "confidential"]).default("public"),
  tokenSupplyUnits: z.number().int().nonnegative().optional(),
  submitReports: z.boolean().default(true),
  reportGasLimit: z.number().int().positive().optional(),
});

export type BaseCreWorkflowConfig = z.infer<typeof baseCreConfigSchema>;

export interface CreRuntime<TConfig> {
  config: TConfig;
  now(): Date;
  log(message: string): void;
  runInNodeMode<TArgs extends unknown[], TOutput>(
    fn: (nodeRuntime: unknown, ...args: TArgs) => TOutput,
    aggregation: unknown,
  ): (...args: TArgs) => { result(): TOutput };
  report(input: unknown): { result(): unknown };
}

export interface CreSdkModule {
  Runner: {
    newRunner<TConfig>(params?: unknown): Promise<{
      run(
        initFn: (
          config: TConfig,
          secretsProvider: unknown,
        ) => Promise<ReadonlyArray<unknown>> | ReadonlyArray<unknown>,
      ): Promise<void>;
    }>;
  };
  sendErrorResponse(error: unknown): void;
  cre: {
    capabilities: {
      CronCapability: new () => { trigger(config: unknown): unknown };
      HTTPCapability: new () => { trigger(config: unknown): unknown };
      HTTPClient: new () => {
        sendRequest(
          runtime: unknown,
          input: unknown,
        ): {
          result(): {
            statusCode: number;
            body: Uint8Array;
          };
        };
      };
      EVMClient: new (chainSelector: bigint) => {
        callContract(runtime: unknown, input: unknown): { result(): { data: Uint8Array } };
        writeReport(
          runtime: unknown,
          input: unknown,
        ): {
          result(): {
            txStatus: number;
            receiverContractExecutionStatus?: number;
            txHash?: Uint8Array;
          };
        };
      };
    };
    handler<TConfig, TTriggerOutput, TResult>(
      trigger: unknown,
      fn: (runtime: CreRuntime<TConfig>, triggerOutput: TTriggerOutput) => TResult,
    ): unknown;
  };
  consensusIdenticalAggregation<T>(): unknown;
  ok(response: unknown): boolean;
  text(response: unknown): string;
  encodeCallMsg(payload: { from: Address; to: Address; data: Hex }): unknown;
  LAST_FINALIZED_BLOCK_NUMBER: unknown;
  bytesToHex(bytes: Uint8Array): Hex;
  prepareReportRequest(hexPayload: Hex): unknown;
  getNetwork(options: {
    chainFamily?: string;
    chainSelectorName?: string;
    isTestnet?: boolean;
  }):
    | {
        chainSelector: {
          selector: bigint;
        };
      }
    | undefined;
}

let cachedSdk: Promise<CreSdkModule> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertHasFunction(target: Record<string, unknown>, key: string, label: string): void {
  if (typeof target[key] !== "function") {
    throw new Error(`Invalid @chainlink/cre-sdk export: missing ${label}`);
  }
}

function assertCreSdkModule(module: unknown): asserts module is CreSdkModule {
  if (!isRecord(module)) {
    throw new Error("Invalid @chainlink/cre-sdk export: module is not an object");
  }

  const runner = module.Runner;
  const sendErrorResponse = module.sendErrorResponse;
  const cre = module.cre;
  const prepareReportRequest = module.prepareReportRequest;
  const getNetwork = module.getNetwork;

  if ((typeof runner !== "function" && !isRecord(runner)) || !isRecord(cre)) {
    throw new Error("Invalid @chainlink/cre-sdk export: missing Runner or cre");
  }

  assertHasFunction(runner as Record<string, unknown>, "newRunner", "Runner.newRunner");
  if (typeof sendErrorResponse !== "function") {
    throw new Error("Invalid @chainlink/cre-sdk export: missing sendErrorResponse");
  }
  assertHasFunction(cre, "handler", "cre.handler");
  if (!isRecord(cre.capabilities)) {
    throw new Error("Invalid @chainlink/cre-sdk export: missing cre.capabilities");
  }

  const capabilities = cre.capabilities as Record<string, unknown>;
  for (const cap of ["CronCapability", "HTTPCapability", "HTTPClient", "EVMClient"]) {
    if (typeof capabilities[cap] !== "function") {
      throw new Error(`Invalid @chainlink/cre-sdk export: missing cre.capabilities.${cap}`);
    }
  }

  if (typeof prepareReportRequest !== "function" || typeof getNetwork !== "function") {
    throw new Error("Invalid @chainlink/cre-sdk export: missing prepareReportRequest or getNetwork");
  }
}

export async function loadCreSdk(): Promise<CreSdkModule> {
  if (!cachedSdk) {
    cachedSdk = import("@chainlink/cre-sdk").then((module) => {
      assertCreSdkModule(module);
      return module;
    });
  }
  return cachedSdk;
}

export async function sendErrorToCre(error: unknown): Promise<void> {
  try {
    const sdk = await loadCreSdk();
    sdk.sendErrorResponse(error);
  } catch (sdkError) {
    console.error("CRE error dispatch failed", sdkError);
    console.error(error);
    process.exitCode = 1;
  }
}

function normalizeChainSelectorName(selectorName: string): string {
  return CHAIN_SELECTOR_ALIASES[selectorName] ?? selectorName;
}

function isZeroAddress(address: string): boolean {
  return /^0x0{40}$/i.test(address);
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${String(error)}`);
  }
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function parseProtoTimestamp(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  const seconds = value.seconds;
  const nanos = value.nanos;
  if (
    (typeof seconds !== "string" && typeof seconds !== "number" && typeof seconds !== "bigint") ||
    (nanos !== undefined && typeof nanos !== "number")
  ) {
    return undefined;
  }

  const secondsBigInt = BigInt(seconds);
  const nanosNumber = typeof nanos === "number" ? nanos : 0;
  const millis = Number(secondsBigInt * 1000n) + Math.floor(nanosNumber / 1_000_000);
  const parsed = new Date(millis);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function floorToMinute(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCSeconds(0, 0);
  return copy;
}

export function resolveSnapshotAsOf<TConfig>(
  runtime: Pick<CreRuntime<TConfig>, "now">,
  triggerPayload: unknown,
): string {
  if (isRecord(triggerPayload)) {
    const candidates = [
      triggerPayload.scheduledExecutionTime,
      triggerPayload.scheduled_execution_time,
      triggerPayload.timestamp,
      triggerPayload.asOf,
      triggerPayload.as_of,
    ];

    for (const candidate of candidates) {
      const iso = parseIsoTimestamp(candidate) ?? parseProtoTimestamp(candidate);
      if (iso) return iso;
    }
  }

  return floorToMinute(runtime.now()).toISOString();
}

export function withAsOf(path: string, asOf: string): string {
  const [pathname, queryString] = path.split("?", 2);
  // CRE WASM runtime does not expose URLSearchParams.
  const pairs: string[] = [];
  if (queryString) {
    for (const segment of queryString.split("&")) {
      if (!segment) continue;
      const key = segment.split("=", 2)[0];
      if (key === "asOf") continue;
      pairs.push(segment);
    }
  }

  pairs.push(`asOf=${encodeURIComponent(asOf)}`);
  return `${pathname}?${pairs.join("&")}`;
}

function getEvmClient(sdk: CreSdkModule, chainSelectorName: string): {
  evmClient: InstanceType<CreSdkModule["cre"]["capabilities"]["EVMClient"]>;
  normalizedChainSelectorName: string;
} {
  const normalizedChainSelectorName = normalizeChainSelectorName(chainSelectorName);
  const network = sdk.getNetwork({
    chainFamily: "evm",
    chainSelectorName: normalizedChainSelectorName,
  });

  if (!network) {
    throw new Error(`Unsupported chain selector: ${chainSelectorName}`);
  }

  return {
    evmClient: new sdk.cre.capabilities.EVMClient(network.chainSelector.selector),
    normalizedChainSelectorName,
  };
}

export function httpGetJson<T, TConfig extends { apiBaseUrl: string }>(
  sdk: CreSdkModule,
  runtime: Pick<CreRuntime<TConfig>, "config" | "runInNodeMode">,
  path: string,
): T {
  const url = buildUrl(runtime.config.apiBaseUrl, path);

  const raw = runtime
    .runInNodeMode(
      (nodeRuntime, requestUrl: string) => {
        const httpClient = new sdk.cre.capabilities.HTTPClient();
        const response = httpClient
          .sendRequest(nodeRuntime, {
            url: requestUrl,
            method: "GET",
            headers: { Accept: "application/json" },
          })
          .result();

        const responseBody = sdk.text(response);
        if (!sdk.ok(response)) {
          throw new Error(
            `GET ${requestUrl} failed: ${response.statusCode} ${responseBody.slice(0, 200)}`,
          );
        }

        return responseBody;
      },
      sdk.consensusIdenticalAggregation<string>(),
    )(url)
    .result();

  return parseJson<T>(raw, `GET ${url}`);
}

export function resolveTotalTokenSupply(
  sdk: CreSdkModule,
  runtime: Pick<CreRuntime<BaseCreWorkflowConfig>, "config" | "log">,
): bigint {
  const fallback = runtime.config.tokenSupplyUnits;

  if (isZeroAddress(runtime.config.contractAddress)) {
    if (fallback === undefined) {
      throw new Error(
        "contractAddress is zero and tokenSupplyUnits fallback is not configured for proof-of-reserve",
      );
    }
    runtime.log("contractAddress is zero; using tokenSupplyUnits fallback for proof-of-reserve");
    return BigInt(fallback);
  }

  try {
    const totalMintedCallData = encodeFunctionData({
      abi: TOTAL_MINTED_ABI,
      functionName: "totalMinted",
    });

    const { evmClient } = getEvmClient(sdk, runtime.config.chainSelector);
    const response = evmClient
      .callContract(runtime, {
        call: sdk.encodeCallMsg({
          from: zeroAddress,
          to: runtime.config.contractAddress as Address,
          data: totalMintedCallData,
        }),
        blockNumber: sdk.LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result();

    const onchainTotalMinted = decodeFunctionResult({
      abi: TOTAL_MINTED_ABI,
      functionName: "totalMinted",
      data: sdk.bytesToHex(response.data),
    });

    if (onchainTotalMinted === 0n && fallback !== undefined) {
      runtime.log("totalMinted() is zero; using tokenSupplyUnits fallback");
      return BigInt(fallback);
    }

    return onchainTotalMinted;
  } catch (error) {
    if (fallback !== undefined) {
      runtime.log(`totalMinted() read failed; using tokenSupplyUnits fallback: ${String(error)}`);
      return BigInt(fallback);
    }
    throw error;
  }
}

export interface ReportSubmissionResult {
  submitted: boolean;
  chainSelectorName: string;
  txStatus?: number;
  receiverExecutionStatus?: number;
  txHash?: Hex;
}

export function submitReport(
  sdk: CreSdkModule,
  runtime: Pick<CreRuntime<BaseCreWorkflowConfig>, "config" | "log" | "report">,
  encodedReport: Hex,
): ReportSubmissionResult {
  const { normalizedChainSelectorName, evmClient } = getEvmClient(sdk, runtime.config.chainSelector);

  if (!runtime.config.submitReports) {
    runtime.log("submitReports=false; report prepared but not broadcast");
    return {
      submitted: false,
      chainSelectorName: normalizedChainSelectorName,
    };
  }

  if (isZeroAddress(runtime.config.contractAddress)) {
    throw new Error("submitReports=true requires a non-zero contractAddress");
  }

  const report = runtime.report(sdk.prepareReportRequest(encodedReport)).result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.contractAddress,
      report,
      gasConfig:
        runtime.config.reportGasLimit === undefined
          ? undefined
          : { gasLimit: runtime.config.reportGasLimit.toString() },
    })
    .result();

  return {
    submitted: true,
    chainSelectorName: normalizedChainSelectorName,
    txStatus: writeResult.txStatus,
    receiverExecutionStatus: writeResult.receiverContractExecutionStatus,
    txHash: writeResult.txHash ? sdk.bytesToHex(writeResult.txHash) : undefined,
  };
}
