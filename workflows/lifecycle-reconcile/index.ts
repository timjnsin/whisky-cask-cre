import { z } from "zod";
import type { RecentLifecycleResponse } from "../../api/src/domain/types.js";
import { mapLifecycleEventToContractReport, unixSeconds } from "../shared/contract-mapping.js";
import {
  baseCreConfigSchema,
  httpGetJson,
  loadCreSdk,
  resolveLastLifecycleTimestamps,
  resolveSnapshotAsOf,
  sendErrorToCre,
  submitReport,
  withAsOf,
  type CreRuntime,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeLifecycleBatchReport } from "../shared/report-encoding.js";

const configSchema = baseCreConfigSchema.extend({
  schedule: z.string().default("0 10 3 * * *"),
  scanLimit: z.number().int().positive().max(200).default(100),
  reconcileWindowHours: z.number().int().positive().max(24 * 30).default(48),
  maxReportsPerRun: z.number().int().positive().max(50).default(10),
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

      const orderedEvents = [...recent.events].sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) ||
          a.caskId - b.caskId ||
          a.toState.localeCompare(b.toState),
      );
      const snapshotMs = new Date(snapshotAsOf).getTime();
      const windowStartMs = snapshotMs - runtime.config.reconcileWindowHours * 60 * 60 * 1000;
      const windowedEvents = orderedEvents.filter(
        (event) => new Date(event.timestamp).getTime() >= windowStartMs,
      );
      const selectionMode = windowedEvents.length > 0 ? "window-oldest" : "latest-fallback";
      const candidateEvents = windowedEvents.length > 0 ? windowedEvents : orderedEvents.slice(-1);
      const checkpointByCaskId = resolveLastLifecycleTimestamps(
        sdk,
        runtime,
        candidateEvents.map((event) => event.caskId),
      );
      const latestQueuedTimestampByCask = new Map<number, bigint>();
      let checkpointFilteredEvents = 0;
      let duplicateFilteredEvents = 0;
      const eligibleEvents = candidateEvents.filter((event) => {
        const eventTimestamp = unixSeconds(event.timestamp);
        const checkpointTimestamp = checkpointByCaskId.get(event.caskId) ?? 0n;
        const latestQueuedTimestamp =
          latestQueuedTimestampByCask.get(event.caskId) ?? checkpointTimestamp;

        if (eventTimestamp <= latestQueuedTimestamp) {
          if (eventTimestamp <= checkpointTimestamp) {
            checkpointFilteredEvents += 1;
          } else {
            duplicateFilteredEvents += 1;
          }
          return false;
        }

        latestQueuedTimestampByCask.set(event.caskId, eventTimestamp);
        return true;
      });

      if (eligibleEvents.length === 0) {
        runtime.log(
          `[lifecycle-reconcile] scanned=${recent.count} mode=${selectionMode} reason=no-new-events`,
        );
        return {
          workflow: "lifecycle-reconcile",
          asOf: snapshotAsOf,
          scannedEvents: recent.count,
          candidateEvents: candidateEvents.length,
          eligibleEvents: 0,
          checkpointFilteredEvents,
          duplicateFilteredEvents,
          submitted: false,
          reason: "no-new-events",
          selectionMode,
        };
      }

      const selectedEvents = eligibleEvents.slice(0, runtime.config.maxReportsPerRun);
      const lifecycleReports = selectedEvents.map((event) => mapLifecycleEventToContractReport(event));
      const encodedReport = encodeLifecycleBatchReport(lifecycleReports);
      const submission = submitReport(sdk, runtime, encodedReport);
      const firstEvent = selectedEvents[0];
      const lastEvent = selectedEvents[selectedEvents.length - 1];

      runtime.log(
        `[lifecycle-reconcile] scanned=${recent.count} mode=${selectionMode} submitting=${selectedEvents.length} firstCask=${firstEvent.caskId} lastCask=${lastEvent.caskId}`,
      );

      return {
        workflow: "lifecycle-reconcile",
        asOf: snapshotAsOf,
        scannedEvents: recent.count,
        candidateEvents: candidateEvents.length,
        eligibleEvents: eligibleEvents.length,
        checkpointFilteredEvents,
        duplicateFilteredEvents,
        submittedEvents: selectedEvents.length,
        firstSubmittedEvent: {
          caskId: firstEvent.caskId,
          toState: firstEvent.toState,
          timestamp: firstEvent.timestamp,
        },
        lastSubmittedEvent: {
          caskId: lastEvent.caskId,
          toState: lastEvent.toState,
          timestamp: lastEvent.timestamp,
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
