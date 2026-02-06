import {
  EstimateResponse,
  GaugeRecordResponse,
  InventoryResponse,
  PortfolioSummaryResponse,
} from "../../api/src/domain/types.js";
import { toScaled1, toScaled2 } from "../../api/src/domain/units.js";
import { loadConfig } from "../shared/config.js";
import { getJson } from "../shared/http.js";

function caskTypeEnum(caskType: GaugeRecordResponse["caskType"]): number {
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

function spiritTypeEnum(spiritType: GaugeRecordResponse["spiritType"]): number {
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

function gaugeMethodEnum(method: GaugeRecordResponse["lastGaugeMethod"]): number {
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

async function main() {
  const config = await loadConfig(import.meta.url);

  const summary = await getJson<PortfolioSummaryResponse>(`${config.apiBaseUrl}/portfolio/summary`);
  const inventory = await getJson<InventoryResponse>(`${config.apiBaseUrl}/inventory`);

  const candidateIds =
    summary.recentlyChangedCaskIds.length > 0
      ? summary.recentlyChangedCaskIds
      : inventory.active_cask_ids_sorted;

  const targetIds = candidateIds.slice(0, 20);

  const records = await Promise.all(
    targetIds.map((id) => getJson<GaugeRecordResponse>(`${config.apiBaseUrl}/cask/${id}/gauge-record`)),
  );

  const estimates = await Promise.all(
    targetIds.map((id) => getJson<EstimateResponse>(`${config.apiBaseUrl}/cask/${id}/estimate`)),
  );

  const estimateById = new Map(estimates.map((estimate) => [estimate.caskId, estimate]));

  const batchPayload = records.map((record) => {
    const estimate = estimateById.get(record.caskId);
    if (!estimate) throw new Error(`Missing estimate for cask ${record.caskId}`);

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
      warehouseId: record.warehouseId,
      state: record.state,
    };
  });

  console.log("[physical-attributes] summary", {
    totalCasks: summary.totalCasks,
    changedCasksConsidered: targetIds.length,
    chainSelector: config.chainSelector,
  });

  console.log("[physical-attributes] batch payload preview (first 3)");
  console.log(JSON.stringify(batchPayload.slice(0, 3), null, 2));
  console.log("[physical-attributes] batch size", batchPayload.length);
}

main().catch((error) => {
  console.error("physical-attributes workflow failed", error);
  process.exit(1);
});
