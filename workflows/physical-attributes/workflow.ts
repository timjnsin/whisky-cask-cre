import {
  CaskBatchItem,
  CaskBatchResponse,
  PortfolioSummaryResponse,
} from "../../api/src/domain/types.js";
import { toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import { loadConfig } from "../shared/config.js";
import { getCreSdkStatus } from "../shared/cre-sdk.js";
import { getJson } from "../shared/http.js";

function caskTypeEnum(caskType: CaskBatchItem["gaugeRecord"]["caskType"]): number {
  switch (caskType) {
    case "bourbon_barrel":
      return 0;
    case "sherry_butt":
      return 1;
    case "hogshead":
      return 2;
    case "port_pipe":
      return 3;
    default:
      return 255;
  }
}

function spiritTypeEnum(spiritType: CaskBatchItem["gaugeRecord"]["spiritType"]): number {
  switch (spiritType) {
    case "bourbon":
      return 0;
    case "rye":
      return 1;
    case "malt":
      return 2;
    case "wheat":
      return 3;
    default:
      return 255;
  }
}

function gaugeMethodEnum(method: CaskBatchItem["gaugeRecord"]["lastGaugeMethod"]): number {
  switch (method) {
    case "entry":
      return 0;
    case "wet_dip":
      return 1;
    case "disgorge":
      return 2;
    case "transfer":
      return 3;
    default:
      return 255;
  }
}

function warehouseCodeHex(warehouseId: string): string {
  const encoded = Buffer.from(warehouseId, "utf8").toString("hex").slice(0, 32);
  return `0x${encoded.padEnd(32, "0")}`;
}

async function main() {
  const config = await loadConfig(import.meta.url);
  const creSdk = getCreSdkStatus();

  const summary = await getJson<PortfolioSummaryResponse>(`${config.apiBaseUrl}/portfolio/summary`);

  const targetIds = summary.recentlyChangedCaskIds.slice(0, 20);
  const batchUrl =
    targetIds.length > 0
      ? `${config.apiBaseUrl}/casks/batch?ids=${targetIds.join(",")}&limit=20`
      : `${config.apiBaseUrl}/casks/batch?limit=20`;

  const batch = await getJson<CaskBatchResponse>(batchUrl);

  const payload = batch.items.map((item) => {
    const record = item.gaugeRecord;
    const estimate = item.estimate;

    return {
      caskId: record.caskId,
      caskType: caskTypeEnum(record.caskType),
      spiritType: spiritTypeEnum(record.spiritType),
      fillDate: Math.floor(new Date(record.fillDate).getTime() / 1000),
      entryProofGallons: toScaled2(record.entryProofGallons).toString(),
      entryWineGallons: toScaled2(record.entryWineGallons).toString(),
      entryProof: toScaled1(record.entryProof).toString(),
      lastGaugeProofGallons: toScaled2(record.lastGaugeProofGallons).toString(),
      lastGaugeWineGallons: toScaled2(record.lastGaugeWineGallons).toString(),
      lastGaugeProof: toScaled1(record.lastGaugeProof).toString(),
      lastGaugeDate: Math.floor(new Date(record.lastGaugeDate).getTime() / 1000),
      lastGaugeMethod: gaugeMethodEnum(record.lastGaugeMethod),
      estimatedProofGallons: toScaled2(estimate.estimatedCurrentProofGallons).toString(),
      warehouseCode: warehouseCodeHex(record.warehouseId),
      state: record.state,
    };
  });

  console.log("[physical-attributes] summary", {
    totalCasks: summary.totalCasks,
    changedCasksHint: summary.recentlyChangedCaskIds.length,
    batchCount: batch.count,
    httpCalls: 2,
    chainSelector: config.chainSelector,
  });

  console.log("[physical-attributes] batch payload preview (first 3)");
  console.log(JSON.stringify(payload.slice(0, 3), null, 2));
  console.log("[physical-attributes] batch size", payload.length);
  console.log("[physical-attributes] cre-sdk", creSdk);
}

main().catch((error) => {
  console.error("physical-attributes workflow failed", error);
  process.exit(1);
});
