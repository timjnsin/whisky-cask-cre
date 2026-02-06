import { toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import { loadConfig } from "../shared/config.js";
import { getCreSdkStatus } from "../shared/cre-sdk.js";
import { postJson } from "../shared/http.js";

interface LifecyclePostResponse {
  ok: boolean;
  event: {
    caskId: number;
    fromState: string;
    toState: string;
    timestamp: string;
    gaugeProofGallons: number;
    gaugeWineGallons: number;
    gaugeProof: number;
    reason: string;
  };
}

async function main() {
  const config = await loadConfig(import.meta.url);
  const creSdk = getCreSdkStatus();

  const caskId = Number(process.env.CASK_ID ?? 7);
  const gaugeProofGallons = Number(process.env.GAUGE_PROOF_GALLONS ?? 46.5);
  const gaugeWineGallons = Number(process.env.GAUGE_WINE_GALLONS ?? 39.25);
  const gaugeProof = Number(process.env.GAUGE_PROOF ?? 118.5);

  const payload = {
    caskId,
    toState: "regauged" as const,
    gaugeProofGallons,
    gaugeWineGallons,
    gaugeProof,
    reason: "regauge" as const,
    timestamp: new Date().toISOString(),
  };

  const response = await postJson<LifecyclePostResponse, typeof payload>(
    `${config.apiBaseUrl}/events/lifecycle`,
    payload,
  );

  const contractEventPayload = {
    caskId: response.event.caskId,
    fromState: response.event.fromState,
    toState: response.event.toState,
    timestamp: Math.floor(new Date(response.event.timestamp).getTime() / 1000),
    gaugeProofGallons: toScaled2(response.event.gaugeProofGallons).toString(),
    gaugeWineGallons: toScaled2(response.event.gaugeWineGallons).toString(),
    gaugeProof: toScaled1(response.event.gaugeProof).toString(),
  };

  console.log("[lifecycle-webhook] event accepted", response.ok);
  console.log("[lifecycle-webhook] contract payload");
  console.log(JSON.stringify(contractEventPayload, null, 2));
  console.log("[lifecycle-webhook] httpCalls", 1);
  console.log("[lifecycle-webhook] cre-sdk", creSdk);
}

main().catch((error) => {
  console.error("lifecycle-webhook workflow failed", error);
  process.exit(1);
});
