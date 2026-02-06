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
  apiBaseUrl: z.string().url(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainSelector: z.string().min(1),
  tokensPerCask: z.number().int().positive().default(1000),
  attestationMode: z.enum(["public", "confidential"]).default("public"),
  tokenSupplyUnits: z.number().int().nonnegative().optional(),
  submitReports: z.boolean().default(true),
  reportGasLimit: z.number().int().positive().optional(),
});

export type BaseCreWorkflowConfig = z.infer<typeof baseCreConfigSchema>;

export interface CreSdkModule {
  Runner: {
    newRunner(params?: unknown): Promise<{
      run(
        initFn: (
          config: unknown,
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
        callContract(
          runtime: unknown,
          input: unknown,
        ): { result(): { data: Uint8Array } };
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
    handler(trigger: unknown, fn: (runtime: unknown, triggerOutput: unknown) => unknown): unknown;
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

export async function loadCreSdk(): Promise<CreSdkModule> {
  if (!cachedSdk) {
    cachedSdk = import("@chainlink/cre-sdk").then((module) => module as unknown as CreSdkModule);
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
  runtime: {
    config: TConfig;
    runInNodeMode(
      fn: (nodeRuntime: unknown, ...args: unknown[]) => unknown,
      aggregation: unknown,
    ): (...args: unknown[]) => { result(): unknown };
  },
  path: string,
): T {
  const url = buildUrl(runtime.config.apiBaseUrl, path);

  const raw = runtime
    .runInNodeMode(
      (nodeRuntime, requestUrl) => {
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
            `GET ${String(requestUrl)} failed: ${response.statusCode} ${responseBody.slice(0, 200)}`,
          );
        }

        return responseBody;
      },
      sdk.consensusIdenticalAggregation<string>(),
    )(url)
    .result() as string;

  return parseJson<T>(raw, `GET ${url}`);
}

export function httpPostJson<
  TResponse,
  TBody,
  TConfig extends {
    apiBaseUrl: string;
  },
>(
  sdk: CreSdkModule,
  runtime: {
    config: TConfig;
    runInNodeMode(
      fn: (nodeRuntime: unknown, ...args: unknown[]) => unknown,
      aggregation: unknown,
    ): (...args: unknown[]) => { result(): unknown };
  },
  path: string,
  body: TBody,
): TResponse {
  const url = buildUrl(runtime.config.apiBaseUrl, path);
  const bodyText = JSON.stringify(body);

  const raw = runtime
    .runInNodeMode(
      (nodeRuntime, requestUrl, requestBodyText) => {
        const httpClient = new sdk.cre.capabilities.HTTPClient();
        const response = httpClient
          .sendRequest(nodeRuntime, {
            url: requestUrl,
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: Buffer.from(String(requestBodyText), "utf8").toString("base64"),
          })
          .result();

        const responseBody = sdk.text(response);
        if (!sdk.ok(response)) {
          throw new Error(
            `POST ${String(requestUrl)} failed: ${response.statusCode} ${responseBody.slice(0, 200)}`,
          );
        }

        return responseBody;
      },
      sdk.consensusIdenticalAggregation<string>(),
    )(url, bodyText)
    .result() as string;

  return parseJson<TResponse>(raw, `POST ${url}`);
}

export function resolveTotalTokenSupply(
  sdk: CreSdkModule,
  runtime: {
    config: BaseCreWorkflowConfig;
    log(message: string): void;
  },
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
  runtime: {
    config: BaseCreWorkflowConfig;
    log(message: string): void;
    report(input: unknown): { result(): unknown };
  },
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

