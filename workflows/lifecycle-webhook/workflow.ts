import { GaugeRecordResponse } from "../../api/src/domain/types.js";
import { proofGallons, round1, round2, toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import { loadConfig } from "../shared/config.js";
import { getCreSdkStatus } from "../shared/cre-sdk.js";
import { getJson, postJson } from "../shared/http.js";

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

interface LifecycleRequestPayload {
  caskId: number;
  toState: "filled" | "maturation" | "regauged" | "transfer" | "bottling_ready" | "bottled";
  gaugeProofGallons?: number;
  gaugeWineGallons?: number;
  gaugeProof?: number;
  reason?: "regauge" | "transfer" | "bottling";
  timestamp: string;
}

function nextGauge(record: GaugeRecordResponse, wineScale: number, proofDelta: number) {
  const gaugeWineGallons = round2(Math.max(0, record.lastGaugeWineGallons * wineScale));
  const gaugeProof = round1(Math.max(95, record.lastGaugeProof - proofDelta));

  return {
    gaugeWineGallons,
    gaugeProof,
    gaugeProofGallons: proofGallons(gaugeWineGallons, gaugeProof),
  };
}

function buildLifecyclePayload(
  record: GaugeRecordResponse,
): Omit<LifecycleRequestPayload, "caskId" | "timestamp"> {
  switch (record.state) {
    case "filled":
      return { toState: "maturation" };
    case "maturation":
      return {
        toState: "regauged",
        reason: "regauge",
        ...nextGauge(record, 0.985, 0.2),
      };
    case "regauged":
      return {
        toState: "transfer",
        reason: "transfer",
        ...nextGauge(record, 0.98, 0.1),
      };
    case "transfer":
      return {
        toState: "maturation",
        reason: "transfer",
        ...nextGauge(record, 1, 0),
      };
    case "bottling_ready":
      return {
        toState: "bottled",
        reason: "bottling",
      };
    case "bottled":
      throw new Error(`cask ${record.caskId} is already bottled; choose a non-terminal cask`);
  }
}

async function main() {
  const config = await loadConfig(import.meta.url);
  const creSdk = getCreSdkStatus();

  const caskId = Number(process.env.CASK_ID ?? 7);
  const currentRecord = await getJson<GaugeRecordResponse>(
    `${config.apiBaseUrl}/cask/${caskId}/gauge-record`,
  );
  const payload: LifecycleRequestPayload = {
    caskId,
    timestamp: new Date().toISOString(),
    ...buildLifecyclePayload(currentRecord),
  };

  if (process.env.GAUGE_PROOF_GALLONS !== undefined) {
    payload.gaugeProofGallons = Number(process.env.GAUGE_PROOF_GALLONS);
  }
  if (process.env.GAUGE_WINE_GALLONS !== undefined) {
    payload.gaugeWineGallons = Number(process.env.GAUGE_WINE_GALLONS);
  }
  if (process.env.GAUGE_PROOF !== undefined) {
    payload.gaugeProof = Number(process.env.GAUGE_PROOF);
  }

  const response = await postJson<LifecyclePostResponse, typeof payload>(
    `${config.apiBaseUrl}/events/lifecycle`,
    payload,
  );

  const contractEventPayload = {
    caskId: response.event.caskId,
    fromState: response.event.fromState,
    toState: response.event.toState,
    timestamp: Math.floor(new Date(response.event.timestamp).getTime() / 1_000),
    gaugeProofGallons: toScaled2(response.event.gaugeProofGallons).toString(),
    gaugeWineGallons: toScaled2(response.event.gaugeWineGallons).toString(),
    gaugeProof: toScaled1(response.event.gaugeProof).toString(),
  };

  console.log("lifecycle-webhook: event accepted", response.ok);
  console.log("lifecycle-webhook: transition", {
    caskId,
    fromState: currentRecord.state,
    toState: payload.toState,
  });
  console.log("lifecycle-webhook: contract payload");
  console.log(JSON.stringify(contractEventPayload, null, 2));
  console.log("lifecycle-webhook: httpCalls", 1);
  console.log("lifecycle-webhook: cre-sdk", creSdk);
}

main().catch((error) => {
  console.error("lifecycle-webhook workflow failed", error);
  process.exit(1);
  return;
});
