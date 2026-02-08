import { z } from "zod";
import type { RecentLifecycleResponse } from "../../api/src/domain/types.js";
import { mapLifecycleEventToContractReport } from "../shared/contract-mapping.js";
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
import { encodeLifecycleReport } from "../shared/report-encoding.js";

const configSchema = baseCreConfigSchema.extend({
  schedule: z.string().default("0 10 3 * * *"),
  scanLimit: z.number().int().positive().max(200).default(100),
  reconcileWindowHours: z.number().int().positive().max(24 * 30).default(48),
});

type WorkflowConfig = z.infer<typeof configSchema>;

async function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const cron = new sdk.cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: config.schedule });

  return [
    sdk.cre.handler(trigger, (runtime: CreRuntime<WorkflowConfig>, triggerPayload: unknown) => {
      const snapshotAsOf = resolveSnapshotAsOf(runtime, triggerPayload);
      const recent = httpGetJson<RecentLifecycleResponse, WorkflowConfig>(
        sdk,
        runtime,
        withAsOf(`/lifecycle/recent?limit=${runtime.config.scanLimit}`, snapshotAsOf),
      );

      if (recent.events.length === 0) {
        runtime.log("[lifecycle-reconcile] no lifecycle events found");
        return {
          workflow: "lifecycle-reconcile",
          asOf: snapshotAsOf,
          scannedEvents: 0,
          submitted: false,
          reason: "no-events",
        };
      }

      const orderedEvents = [...recent.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const snapshotMs = new Date(snapshotAsOf).getTime();
      const windowStartMs = snapshotMs - runtime.config.reconcileWindowHours * 60 * 60 * 1000;
      const windowedEvents = orderedEvents.filter(
        (event) => new Date(event.timestamp).getTime() >= windowStartMs,
      );
      const selectionMode = windowedEvents.length > 0 ? "window-oldest" : "latest-fallback";
      const selectedEvents = windowedEvents.length > 0 ? windowedEvents : orderedEvents.slice(-1);
      const nextEvent = selectedEvents[0];
      const lifecycleReport = mapLifecycleEventToContractReport(nextEvent);
      const encodedReport = encodeLifecycleReport(lifecycleReport);
      const submission = submitReport(sdk, runtime, encodedReport);

      runtime.log(
        `[lifecycle-reconcile] scanned=${recent.count} mode=${selectionMode} nextCask=${nextEvent.caskId} to=${nextEvent.toState}`,
      );

      return {
        workflow: "lifecycle-reconcile",
        asOf: snapshotAsOf,
        scannedEvents: recent.count,
        nextEvent: {
          caskId: nextEvent.caskId,
          toState: nextEvent.toState,
          timestamp: nextEvent.timestamp,
        },
        selectionMode,
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
