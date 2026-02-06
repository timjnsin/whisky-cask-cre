import { z } from "zod";
import type { InventoryResponse } from "../../api/src/domain/types.js";
import {
  baseCreConfigSchema,
  httpGetJson,
  loadCreSdk,
  resolveTotalTokenSupply,
  sendErrorToCre,
  submitReport,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeReservePrivateReport, encodeReservePublicReport } from "../shared/report-encoding.js";

const RESERVE_RATIO_SCALE = 10n ** 18n;

const configSchema = baseCreConfigSchema.extend({
  schedule: z.string().default("0 0 * * * *"),
});

type WorkflowConfig = z.infer<typeof configSchema>;

function nowUnixSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

function reserveRatioScaled(
  physicalCaskCount: number,
  tokensPerCask: number,
  totalTokenSupply: bigint,
): bigint {
  if (totalTokenSupply <= 0n) {
    return 0n;
  }
  return (BigInt(physicalCaskCount) * BigInt(tokensPerCask) * RESERVE_RATIO_SCALE) / totalTokenSupply;
}

async function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const cron = new sdk.cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: config.schedule });

  return [
    sdk.cre.handler(trigger, (runtime: any) => {
      const inventory = httpGetJson<InventoryResponse, WorkflowConfig>(sdk, runtime, "/inventory");
      const totalTokenSupply = resolveTotalTokenSupply(sdk, runtime);
      const timestamp = nowUnixSeconds();

      runtime.log(
        `[proof-of-reserve] active=${inventory.physical_cask_count} attestation=${inventory.attestation_hash}`,
      );

      if (runtime.config.attestationMode === "confidential") {
        const isFullyReserved =
          BigInt(inventory.physical_cask_count) * BigInt(runtime.config.tokensPerCask) >=
          totalTokenSupply;

        const encodedReport = encodeReservePrivateReport({
          isFullyReserved,
          timestamp,
          attestationHash: inventory.attestation_hash,
        });

        const submission = submitReport(sdk, runtime, encodedReport);
        return {
          workflow: "proof-of-reserve",
          mode: "confidential",
          isFullyReserved,
          physicalCaskCount: inventory.physical_cask_count,
          totalTokenSupply: totalTokenSupply.toString(),
          attestationHash: inventory.attestation_hash,
          reportBytes: encodedReport.length / 2 - 1,
          ...submission,
        };
      }

      const scaledReserveRatio = reserveRatioScaled(
        inventory.physical_cask_count,
        runtime.config.tokensPerCask,
        totalTokenSupply,
      );

      const encodedReport = encodeReservePublicReport({
        physicalCaskCount: BigInt(inventory.physical_cask_count),
        totalTokenSupply,
        tokensPerCask: BigInt(runtime.config.tokensPerCask),
        reserveRatio: scaledReserveRatio,
        timestamp,
        attestationHash: inventory.attestation_hash,
      });

      const submission = submitReport(sdk, runtime, encodedReport);
      return {
        workflow: "proof-of-reserve",
        mode: "public",
        physicalCaskCount: inventory.physical_cask_count,
        totalTokenSupply: totalTokenSupply.toString(),
        tokensPerCask: runtime.config.tokensPerCask,
        reserveRatioScaled1e18: scaledReserveRatio.toString(),
        attestationHash: inventory.attestation_hash,
        reportBytes: encodedReport.length / 2 - 1,
        ...submission,
      };
    }),
  ];
}

export async function main() {
  const sdk = await loadCreSdk();
  const runner = await sdk.Runner.newRunner({ configSchema });
  await runner.run((config) => initWorkflow(sdk, config as WorkflowConfig));
}

main().catch(sendErrorToCre);

