import { CaskBatchResponse, PortfolioSummaryResponse } from "../../api/src/domain/types.js";
import { toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import {
  caskTypeEnum,
  gaugeMethodEnum,
  lifecycleStateEnum,
  spiritTypeEnum,
  unixSeconds,
  warehouseCodeHex,
} from "../shared/contract-mapping.js";
import { loadConfig } from "../shared/config.js";
import { getCreSdkStatus } from "../shared/cre-sdk.js";
import { getJson } from "../shared/http.js";

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
      fillDate: Number(unixSeconds(record.fillDate)),
      entryProofGallons: toScaled2(record.entryProofGallons).toString(),
      entryWineGallons: toScaled2(record.entryWineGallons).toString(),
      entryProof: toScaled1(record.entryProof).toString(),
      lastGaugeProofGallons: toScaled2(record.lastGaugeProofGallons).toString(),
      lastGaugeWineGallons: toScaled2(record.lastGaugeWineGallons).toString(),
      lastGaugeProof: toScaled1(record.lastGaugeProof).toString(),
      lastGaugeDate: Number(unixSeconds(record.lastGaugeDate)),
      lastGaugeMethod: gaugeMethodEnum(record.lastGaugeMethod),
      estimatedProofGallons: toScaled2(estimate.estimatedCurrentProofGallons).toString(),
      warehouseCode: warehouseCodeHex(record.warehouseId),
      state: lifecycleStateEnum(record.state),
    };
  });

  console.log("physical-attributes: summary", {
    totalCasks: summary.totalCasks,
    changedCasksHint: summary.recentlyChangedCaskIds.length,
    batchCount: batch.count,
    httpCalls: 2,
    chainSelector: config.chainSelector,
  });

  console.log("physical-attributes: batch payload preview (first 3)");
  console.log(JSON.stringify(payload.slice(0, 3), null, 2));
  console.log("physical-attributes: batch size", payload.length);
  console.log("physical-attributes: cre-sdk", creSdk);
}

main().catch((error) => {
  console.error("physical-attributes workflow failed", error);
  process.exit(1);
  return;
});
