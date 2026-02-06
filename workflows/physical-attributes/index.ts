import { z } from "zod";
import type {
  CaskBatchResponse,
  PortfolioSummaryResponse,
} from "../../api/src/domain/types.js";
import { mapBatchItemToContractInput } from "../shared/contract-mapping.js";
import {
  baseCreConfigSchema,
  httpGetJson,
  loadCreSdk,
  resolveSnapshotAsOf,
  sendErrorToCre,
  submitReport,
  withAsOf,
  type CreRuntime,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeCaskBatchReport } from "../shared/report-encoding.js";

const configSchema = baseCreConfigSchema.extend({
  schedule: z.string().default("0 0 3 * * *"),
  maxBatchSize: z.number().int().positive().max(50).default(20),
});

type WorkflowConfig = z.infer<typeof configSchema>;

function buildBatchPath(targetIds: number[], maxBatchSize: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(maxBatchSize));
  if (targetIds.length > 0) {
    params.set("ids", targetIds.join(","));
  }
  return `/casks/batch?${params.toString()}`;
}

async function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const cron = new sdk.cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: config.schedule });

  return [
    sdk.cre.handler(trigger, (runtime: CreRuntime<WorkflowConfig>, triggerPayload: unknown) => {
      const snapshotAsOf = resolveSnapshotAsOf(runtime, triggerPayload);
      const summary = httpGetJson<PortfolioSummaryResponse, WorkflowConfig>(
        sdk,
        runtime,
        withAsOf("/portfolio/summary", snapshotAsOf),
      );
      const targetIds = summary.recentlyChangedCaskIds.slice(0, runtime.config.maxBatchSize);
      const batchPath = withAsOf(buildBatchPath(targetIds, runtime.config.maxBatchSize), snapshotAsOf);

      const batch = httpGetJson<CaskBatchResponse, WorkflowConfig>(sdk, runtime, batchPath);
      const updates = batch.items.map(mapBatchItemToContractInput);

      if (updates.length === 0) {
        runtime.log("[physical-attributes] no casks returned by /casks/batch");
        return {
          workflow: "physical-attributes",
          asOf: snapshotAsOf,
          scannedSummaryCasks: summary.totalCasks,
          changedHintCount: summary.recentlyChangedCaskIds.length,
          selectedBatchCount: 0,
          submitted: false,
          reason: "no-updates",
        };
      }

      const encodedReport = encodeCaskBatchReport(updates);
      const submission = submitReport(sdk, runtime, encodedReport);

      runtime.log(
        `[physical-attributes] batch=${updates.length} httpCalls=2 chain=${submission.chainSelectorName}`,
      );

      return {
        workflow: "physical-attributes",
        asOf: snapshotAsOf,
        scannedSummaryCasks: summary.totalCasks,
        changedHintCount: summary.recentlyChangedCaskIds.length,
        selectedBatchCount: updates.length,
        batchCaskIds: updates.map((update) => update.caskId.toString()),
        reportBytes: encodedReport.length / 2 - 1,
        ...submission,
      };
    }),
  ];
}

export async function main() {
  const sdk = await loadCreSdk();
  const runner = await sdk.Runner.newRunner<WorkflowConfig>({ configSchema });
  await runner.run((config: WorkflowConfig) => initWorkflow(sdk, config));
}

main().catch(sendErrorToCre);
