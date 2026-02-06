import { z } from "zod";
import { mapLifecycleEventToContractReport } from "../shared/contract-mapping.js";
import {
  baseCreConfigSchema,
  httpPostJson,
  loadCreSdk,
  sendErrorToCre,
  submitReport,
  type CreSdkModule,
} from "../shared/cre-runtime.js";
import { encodeLifecycleReport } from "../shared/report-encoding.js";

const lifecycleWebhookPayloadSchema = z.object({
  caskId: z.number().int().positive(),
  toState: z.enum(["filled", "maturation", "regauged", "transfer", "bottling_ready", "bottled"]),
  gaugeProofGallons: z.number().nonnegative().optional(),
  gaugeWineGallons: z.number().nonnegative().optional(),
  gaugeProof: z.number().nonnegative().optional(),
  reason: z.enum(["regauge", "transfer", "bottling"]).optional(),
  timestamp: z.string().datetime().optional(),
});

const lifecyclePostResponseSchema = z.object({
  ok: z.boolean(),
  event: z.object({
    caskId: z.number().int().positive(),
    fromState: z.enum(["filled", "maturation", "regauged", "transfer", "bottling_ready", "bottled"]),
    toState: z.enum(["filled", "maturation", "regauged", "transfer", "bottling_ready", "bottled"]),
    timestamp: z.string().datetime(),
    gaugeProofGallons: z.number().nonnegative(),
    gaugeWineGallons: z.number().nonnegative(),
    gaugeProof: z.number().nonnegative(),
    reason: z.enum(["fill", "regauge", "transfer", "bottling", "reconcile"]),
  }),
});

const authorizedKeySchema = z.object({
  type: z.enum(["KEY_TYPE_ECDSA_EVM"]).default("KEY_TYPE_ECDSA_EVM"),
  publicKey: z.string().min(1),
});

const configSchema = baseCreConfigSchema.extend({
  webhookAuthorizedKeys: z.array(authorizedKeySchema).default([]),
});

type WorkflowConfig = z.infer<typeof configSchema>;

interface HttpTriggerPayload {
  input: Uint8Array;
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

async function initWorkflow(sdk: CreSdkModule, config: WorkflowConfig) {
  const httpTrigger = new sdk.cre.capabilities.HTTPCapability();
  const trigger = httpTrigger.trigger({ authorizedKeys: config.webhookAuthorizedKeys });

  return [
    sdk.cre.handler(trigger, (runtime: any, triggerPayload: unknown) => {
      const incomingPayload = parseIncomingPayload(triggerPayload as HttpTriggerPayload);
      const lifecycleResponse = lifecyclePostResponseSchema.parse(
        httpPostJson<unknown, typeof incomingPayload, WorkflowConfig>(
          sdk,
          runtime,
          "/events/lifecycle",
          incomingPayload,
        ),
      );

      if (!lifecycleResponse.ok) {
        throw new Error("Warehouse lifecycle API returned ok=false");
      }

      const lifecycleReport = mapLifecycleEventToContractReport(lifecycleResponse.event);
      const encodedReport = encodeLifecycleReport(lifecycleReport);
      const submission = submitReport(sdk, runtime, encodedReport);

      runtime.log(
        `[lifecycle-webhook] cask=${lifecycleResponse.event.caskId} to=${lifecycleResponse.event.toState}`,
      );

      return {
        workflow: "lifecycle-webhook",
        caskId: lifecycleResponse.event.caskId,
        fromState: lifecycleResponse.event.fromState,
        toState: lifecycleResponse.event.toState,
        timestamp: lifecycleResponse.event.timestamp,
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
