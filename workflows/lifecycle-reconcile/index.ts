import { z } from "zod";
import type { RecentLifecycleResponse } from "../../api/src/domain/types.js";
import { mapLifecycleEventToContractReport } from "../shared/contract-mapping.js";
import {
  baseCreConfigSchema,
  httpGetJson,
  loadCreSdk,
  sendErrorToCre,
  submitReport,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeLifecycleReport } from "../shared/report-encoding.js";

const configSchema = baseCreConfigSchema.extend({
  schedule: z.string().default("0 10 3 * * *"),
  scanLimit: z.number().int().positive().max(200).default(100),
});

type WorkflowConfig = z.infer<typeof configSchema>;

async function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const cron = new sdk.cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: config.schedule });

  return [
    sdk.cre.handler(trigger, (runtime: any) => {
      const recent = httpGetJson<RecentLifecycleResponse, WorkflowConfig>(
        sdk,
        runtime,
        `/lifecycle/recent?limit=${runtime.config.scanLimit}`,
      );

      if (recent.events.length === 0) {
        runtime.log("[lifecycle-reconcile] no lifecycle events found");
        return {
          workflow: "lifecycle-reconcile",
          scannedEvents: 0,
          submitted: false,
          reason: "no-events",
        };
      }

      const latestEvent = recent.events[recent.events.length - 1];
      const lifecycleReport = mapLifecycleEventToContractReport(latestEvent);
      const encodedReport = encodeLifecycleReport(lifecycleReport);
      const submission = submitReport(sdk, runtime, encodedReport);

      runtime.log(
        `[lifecycle-reconcile] scanned=${recent.count} latestCask=${latestEvent.caskId} to=${latestEvent.toState}`,
      );

      return {
        workflow: "lifecycle-reconcile",
        scannedEvents: recent.count,
        latestEvent: {
          caskId: latestEvent.caskId,
          toState: latestEvent.toState,
          timestamp: latestEvent.timestamp,
        },
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

