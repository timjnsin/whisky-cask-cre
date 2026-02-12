import { z } from "zod";
import { mapLifecycleEventToContractReport } from "../shared/contract-mapping.js";
import {
  baseCreConfigSchema,
  loadCreSdk,
  resolveSnapshotAsOf,
  sendErrorToCre,
  submitReport,
  type CreRuntime,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeLifecycleReport } from "../shared/report-encoding.js";

const lifecycleWebhookPayloadSchema = z.object({
  caskId: z.number().int().positive(),
  toState: z.enum(["filled", "maturation", "regauged", "transfer", "bottling_ready", "bottled"]),
  gaugeProofGallons: z.number().nonnegative().optional(),
  gaugeWineGallons: z.number().nonnegative().optional(),
  gaugeProof: z.number().nonnegative().optional(),
  timestamp: z.string().datetime().optional(),
});

const authorizedKeySchema = z.object({
  type: z.enum(["KEY_TYPE_ECDSA_EVM"]).default("KEY_TYPE_ECDSA_EVM"),
  publicKey: z.string().min(1),
});

const configSchema = baseCreConfigSchema.extend({
  webhookAuthorizedKeys: z.array(authorizedKeySchema).default([]),
}).superRefine((config, ctx) => {
  if (config.submitReports && config.webhookAuthorizedKeys.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["webhookAuthorizedKeys"],
      message: "webhookAuthorizedKeys must be configured when submitReports=true",
    });
  }
});

type WorkflowConfig = z.infer<typeof configSchema>;

interface HttpTriggerPayload {
  input: Uint8Array;
}

function isHttpTriggerPayload(payload: unknown): payload is HttpTriggerPayload {
  if (typeof payload !== "object" || payload === null || !("input" in payload)) {
    return false;
  }
  const candidate = (payload as { input: unknown }).input;
  return candidate instanceof Uint8Array;
}

function parseIncomingPayload(payload: HttpTriggerPayload): z.infer<typeof lifecycleWebhookPayloadSchema> {
  const bodyText = new TextDecoder().decode(payload.input);
  if (!bodyText.trim()) {
    throw new Error("Lifecycle webhook payload input is empty");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bodyText);
  } catch (error) {
    throw new Error(`Lifecycle webhook payload is not valid JSON: ${String(error)}`);
  }

  return lifecycleWebhookPayloadSchema.parse(parsedJson);
}

function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const httpTrigger = new sdk.cre.capabilities.HTTPCapability();
  const trigger = httpTrigger.trigger({ authorizedKeys: config.webhookAuthorizedKeys });

  return [
    sdk.cre.handler(trigger, (runtime: CreRuntime<WorkflowConfig>, triggerPayload: unknown) => {
      if (!isHttpTriggerPayload(triggerPayload)) {
        throw new Error("Invalid HTTP trigger payload shape");
      }

      const incomingPayload = parseIncomingPayload(triggerPayload);
      const defaultTimestamp = resolveSnapshotAsOf(runtime, triggerPayload);

      const lifecycleReport = mapLifecycleEventToContractReport({
        caskId: incomingPayload.caskId,
        toState: incomingPayload.toState,
        timestamp: incomingPayload.timestamp ?? defaultTimestamp,
        gaugeProofGallons: incomingPayload.gaugeProofGallons ?? 0,
        gaugeWineGallons: incomingPayload.gaugeWineGallons ?? 0,
        gaugeProof: incomingPayload.gaugeProof ?? 0,
      });

      const encodedReport = encodeLifecycleReport(lifecycleReport);
      const submission = submitReport(sdk, runtime, encodedReport);

      runtime.log(
        `[lifecycle-webhook] cask=${incomingPayload.caskId} to=${incomingPayload.toState} source=trigger`,
      );

      return {
        workflow: "lifecycle-webhook",
        caskId: incomingPayload.caskId,
        toState: incomingPayload.toState,
        timestamp: incomingPayload.timestamp ?? defaultTimestamp,
        reportBytes: encodedReport.length / 2 - 1,
        ...submission,
      };
    }),
  ];
}

export async function main() {
  const sdk = await loadCreSdk();
  const runner = await sdk.Runner.newRunner<WorkflowConfig>({ configSchema });
  await runner.run((config) => initWorkflow(sdk, config));
}

main().catch(sendErrorToCre);
